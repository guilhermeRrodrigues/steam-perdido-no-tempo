// Protocolo serial entre o controle (ESP32 + HC-SR04) e o jogo.
// Arquivo "puro": não usa nada do navegador, então dá para testar no Node (tools/test-protocol.mjs).
//
// Placa -> PC (uma mensagem por linha, terminada em \n), 115200 baud:
//   HELLO:PERDIDO:<versão>:<placa>   a placa se apresenta (ao ligar e ao receber HELLO)
//   DIST:<cm>                         distância da mão em cm; -1 = nada na frente
//   BTN:<botão>:<1|0>                 botão apertado/solto (o BOOT da placa é o botão A)
//   PONG                              resposta ao PING
//   OK:<comando>[:valor]              confirmação (SONAR, DELAY, RESET)
//   ERR:<comando>                     comando desconhecido
//
// PC -> Placa:
//   HELLO | PING | SONAR:<0|1> | DELAY:<ms> | LED:<0|1> | BLINK:<n> | RESET

export const BAUD_RATE = 115200;
export const PROTOCOL_VERSION = 2;
export const BUTTONS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B'];

// Filtros do seletor de portas do Chrome (chips USB-serial usados nos ESP32)
export const USB_FILTERS = [
  { usbVendorId: 0x10c4 }, // Silicon Labs CP210x (maioria dos ESP32 DevKit V1)
  { usbVendorId: 0x1a86 }, // WCH CH340 / CH9102
  { usbVendorId: 0x303a }, // Espressif USB nativo (ESP32-S2/S3/C3)
  { usbVendorId: 0x0403 }, // FTDI
];

// Bluetooth LE: serviço no estilo "Nordic UART". As mensagens são as mesmas do cabo.
// A placa manda as linhas em pedaços de até 20 bytes (notificações); o LineSplitter junta.
export const BLE = {
  NAME: 'PerdidoNoTempo',
  SERVICE: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  RX: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // o jogo escreve comandos aqui
  TX: '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // a placa notifica mensagens aqui
};

/** Quebra o fluxo de texto em linhas completas. Guarda o pedaço incompleto para o próximo pedaço. */
export class LineSplitter {
  constructor(maxLen = 200) {
    this.buffer = '';
    this.maxLen = maxLen;
  }
  push(chunk) {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r?\n/);
    this.buffer = parts.pop();
    if (this.buffer.length > this.maxLen) this.buffer = ''; // lixo sem \n (ex.: mensagens de boot do ESP32)
    return parts.map((l) => l.trim()).filter((l) => l.length > 0);
  }
}

/** Interpreta uma linha recebida. Nunca lança erro: linhas estranhas viram {type:'unknown'}. */
export function parseLine(line) {
  const text = String(line).trim();
  const parts = text.split(':');
  const head = parts[0];

  if (head === 'DIST' && parts.length === 2 && /^-?\d+$/.test(parts[1])) {
    const cm = Number(parts[1]);
    return { type: 'dist', cm: cm < 0 ? null : cm };
  }
  if (head === 'BTN' && parts.length === 3 && BUTTONS.includes(parts[1]) && (parts[2] === '1' || parts[2] === '0')) {
    return { type: 'btn', button: parts[1], pressed: parts[2] === '1' };
  }
  if (head === 'HELLO' && parts[1] === 'PERDIDO') {
    return { type: 'hello', version: Number(parts[2]) || 0, board: parts[3] || '?' };
  }
  if (text === 'PONG') return { type: 'pong' };
  if (head === 'OK') return { type: 'ok', command: parts[1] || '', value: parts[2] };
  if (head === 'ERR') return { type: 'err', command: parts[1] || '' };
  return { type: 'unknown', raw: text };
}

const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));

export const cmd = {
  hello: () => 'HELLO\n',
  ping: () => 'PING\n',
  reset: () => 'RESET\n',
  sonar: (on) => `SONAR:${on ? 1 : 0}\n`,
  delay: (ms) => `DELAY:${clampInt(ms, 0, 3000)}\n`,
  led: (on) => `LED:${on ? 1 : 0}\n`,
  blink: (n) => `BLINK:${clampInt(n, 1, 10)}\n`,
};

// ---------------------------------------------------------------------------
// Mão como controle: zonas de distância, "segurar para confirmar" e "toquinho para voltar".
// Também puro, para poder testar no Node.
// ---------------------------------------------------------------------------

export const HAND = {
  TAP_MAX: 7,      // cm: mais perto que isso é a "zona do toque"
  NEAR: 9,         // cm: começo da primeira opção
  ZONE: 8,         // cm: tamanho padrão de cada opção
  DWELL: 1300,     // ms com a mão parada na mesma opção para confirmar
  TAP_TIME: 700,   // ms: entrar e sair da zona do toque mais rápido que isso = VOLTAR
  REARM: 6,        // cm que a mão precisa se mexer para poder confirmar de novo na mesma opção
};

/** Detecta o "toquinho no ar": a mão chega bem perto do sensor e sai rápido. */
export class TapDetector {
  constructor() {
    this.closeSince = null;
  }
  /** Recebe cada leitura (tempo em ms, cm ou null). Retorna true quando reconhece um toque. */
  feed(tMs, cm) {
    const close = cm != null && cm <= HAND.TAP_MAX;
    if (close) {
      if (this.closeSince == null) this.closeSince = tMs;
      return false;
    }
    if (this.closeSince != null) {
      const dur = tMs - this.closeSince;
      this.closeSince = null;
      // Saiu da zona do toque: só conta se foi rápido e a mão foi para longe (ou sumiu)
      if (dur <= HAND.TAP_TIME && (cm == null || cm >= HAND.NEAR)) return true;
    }
    return false;
  }
}

/** Converte distância em opção e confirma quando a mão fica parada. */
export class HandPicker {
  constructor({ near = HAND.NEAR, zone = HAND.ZONE, dwell = HAND.DWELL } = {}) {
    this.near = near;
    this.zone = zone;
    this.dwell = dwell;
    this.index = -1;
    this.heldMs = 0;
    this.armed = true;
    this.refCm = null; // onde a mão estava quando o menu abriu (ou na última confirmação)
  }

  zoneOf(cm, n) {
    if (cm == null) return -1;
    const i = Math.floor((cm - this.near) / this.zone);
    return i >= 0 && i < n ? i : -1;
  }

  /** Chame ao abrir um menu: se a mão já estiver numa opção, ela precisa mudar antes de confirmar. */
  reset(cm = null, n = 0) {
    this.index = this.zoneOf(cm, n);
    this.heldMs = 0;
    this.armed = this.index < 0;
    this.refCm = cm;
  }

  /** Chame a cada quadro. Retorna o índice confirmado, ou -1. */
  update(dtMs, cm, n) {
    const i = this.zoneOf(cm, n);
    if (i !== this.index) {
      this.index = i;
      this.heldMs = 0;
      this.armed = true;
      return -1;
    }
    if (i < 0) return -1;
    // Desarmado: re-arma se a mão se mexer bastante (útil em menus de uma opção só, com faixa grande)
    if (!this.armed && this.refCm != null && Math.abs(cm - this.refCm) >= HAND.REARM) {
      this.armed = true;
      this.heldMs = 0;
    }
    if (!this.armed) return -1;
    this.heldMs += dtMs;
    if (this.heldMs >= this.dwell) {
      this.armed = false; // para escolher de novo, precisa mexer a mão ou tirá-la
      this.refCm = cm;
      return i;
    }
    return -1;
  }

  get progress() {
    return this.armed && this.index >= 0 ? Math.min(1, this.heldMs / this.dwell) : 0;
  }

  /** Faixa (em cm) de uma opção, para desenhar a régua. */
  range(i) {
    return [this.near + i * this.zone, this.near + (i + 1) * this.zone];
  }
}
