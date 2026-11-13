// Conexão com o controle. Dois caminhos, com as MESMAS mensagens (veja js/protocol.js):
//
// 1) Cabo USB, pela Web Serial API (Chrome/Edge no computador). Precisa do driver do chip USB.
//    Autodetecção:
//     - Ao carregar, navigator.serial.getPorts() devolve portas JÁ autorizadas: conecta sozinho.
//     - Evento 'connect': plugou uma porta já autorizada, conecta sozinho.
//     - Evento 'disconnect': o cabo saiu; espera o próximo 'connect'.
//     - A PRIMEIRA vez exige um clique (regra de segurança do navegador): requestPort().
//
// 2) Bluetooth (BLE), pela Web Bluetooth API (Chrome/Edge). NÃO precisa de driver nenhum:
//    o cabo USB só dá energia para a placa. A primeira vez também exige um clique.
//    Se a conexão cair, tentamos reconectar sozinhos. Se o navegador permitir
//    (navigator.bluetooth.getDevices), reconectamos até depois de recarregar a página.

import { BAUD_RATE, USB_FILTERS, BLE, LineSplitter, parseLine, cmd } from './protocol.js';

export const serialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const bleSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Controller extends EventTarget {
  constructor() {
    super();
    this.link = null;       // 'usb' | 'ble' | null
    this.port = null;       // porta serial (USB)
    this.reader = null;
    this.writer = null;
    this.bleDevice = null;  // aparelho Bluetooth
    this.bleRx = null;      // característica onde escrevemos comandos
    this.bleWanted = false; // o usuário quer ficar no Bluetooth (para reconectar sozinho)
    this.status = serialSupported() || bleSupported() ? 'disconnected' : 'unsupported';
    this.board = null;
    this._opening = false;
    this._helloTimer = null;
    this._splitter = new LineSplitter();
    this._decoder = new TextDecoder();
    this._bleQueue = Promise.resolve();
  }

  _setStatus(status, detail = '') {
    this.status = status;
    this.dispatchEvent(new CustomEvent('status', { detail: { status, detail, board: this.board, link: this.link } }));
  }

  /** true quando há um canal aberto (mesmo antes do HELLO chegar). */
  get connected() {
    return this.status === 'ready' || this.status === 'opened';
  }

  /** Chamar uma vez ao carregar a página. */
  async init() {
    if (this.status === 'unsupported') return this._setStatus('unsupported');
    if (serialSupported()) {
      navigator.serial.addEventListener('connect', (e) => {
        if (!this.link) this.open(e.target);
      });
      navigator.serial.addEventListener('disconnect', (e) => {
        if (e.target === this.port) this._lostUsb('O controle foi desligado do USB.');
      });
      if (await this.tryAutoConnect()) return;
    }
    if (bleSupported() && navigator.bluetooth.getDevices) {
      // Aparelhos Bluetooth autorizados antes (nem todo navegador libera isso)
      try {
        const devices = await navigator.bluetooth.getDevices();
        const dev = devices.find((d) => (d.name || '').startsWith(BLE.NAME));
        if (dev && !this.link) {
          this.bleWanted = true;
          this._setStatus('disconnected', 'Procurando o controle Bluetooth...');
          this._watchAndConnect(dev);
          return;
        }
      } catch (_) { /* sem permissão persistente: tudo bem */ }
    }
    if (!this.link) this._setStatus('disconnected');
  }

  // ======================= USB (Web Serial) =======================

  async tryAutoConnect() {
    const ports = await navigator.serial.getPorts();
    for (const port of ports) {
      if (await this.open(port)) return true;
    }
    return false;
  }

  /** Abre o seletor de portas. Precisa ser chamado dentro de um clique. */
  async requestAndConnect(showAll = false) {
    if (!serialSupported()) return false;
    try {
      const port = await navigator.serial.requestPort(showAll ? {} : { filters: USB_FILTERS });
      return await this.open(port);
    } catch (err) {
      if (err && err.name === 'NotFoundError') {
        this._setStatus('disconnected', 'Nenhuma porta escolhida. Se a placa não aparece, o computador está sem o driver USB: use o Bluetooth.');
      } else this._setStatus('error', String((err && err.message) || err));
      return false;
    }
  }

  async open(port) {
    if (this._opening || this.link) return false;
    this._opening = true;
    this._setStatus('connecting');
    try {
      await port.open({ baudRate: BAUD_RATE });
    } catch (err) {
      this._opening = false;
      this._setStatus('error', 'Não consegui abrir a porta. Feche o Monitor Serial da Arduino IDE ou outra aba do jogo e tente de novo.');
      return false;
    }
    this._opening = false;
    this.port = port;
    this.link = 'usb';
    this.board = null;
    this._splitter = new LineSplitter();
    this.writer = port.writable.getWriter();
    this._setStatus('opened');
    this._readLoop(port);
    this._askHello(() => this.port === port);
    return true;
  }

  async _readLoop(port) {
    while (port.readable && this.port === port) {
      try {
        this.reader = port.readable.getReader();
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          this._feed(value);
        }
      } catch (_) {
        // Erro de leitura (ruído no boot, por exemplo). Se a porta continuar aberta, lemos de novo.
      } finally {
        try { this.reader && this.reader.releaseLock(); } catch (_) { /* nada */ }
        this.reader = null;
      }
      if (this.port !== port) return;
    }
    if (this.port === port) this._lostUsb('A conexão caiu.');
  }

  async _lostUsb(reason) {
    const port = this.port;
    if (!port) return;
    this.port = null;
    this.link = null;
    clearTimeout(this._helloTimer);
    try { this.reader && (await this.reader.cancel()); } catch (_) { /* nada */ }
    try { this.writer && this.writer.releaseLock(); } catch (_) { /* nada */ }
    this.writer = null;
    try { await port.close(); } catch (_) { /* nada */ }
    this.board = null;
    this._setStatus('disconnected', reason + ' Ligue o cabo de novo: o jogo reconecta sozinho.');
  }

  // ======================= Bluetooth (Web Bluetooth) =======================

  /** Abre o seletor de aparelhos Bluetooth. Precisa ser chamado dentro de um clique. */
  async requestBle() {
    if (!bleSupported()) return false;
    let device;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: BLE.NAME }, { services: [BLE.SERVICE] }],
        optionalServices: [BLE.SERVICE],
      });
    } catch (err) {
      if (err && err.name === 'NotFoundError') this._setStatus('disconnected', 'Nenhum controle escolhido. Confira se a placa está ligada e perto do computador.');
      else this._setStatus('error', 'Bluetooth: ' + ((err && err.message) || err) + ' Confira se o Bluetooth do computador está ligado.');
      return false;
    }
    if (this.link === 'usb') await this._lostUsb('Trocando para Bluetooth.');
    this.bleWanted = true;
    return this._connectBle(device);
  }

  async _connectBle(device) {
    if (this.link) return false;
    this._setStatus('connecting', 'Conectando por Bluetooth...');
    try {
      if (this.bleDevice !== device) {
        device.addEventListener('gattserverdisconnected', () => this._lostBle(device));
      }
      this.bleDevice = device;
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE.SERVICE);
      const tx = await service.getCharacteristic(BLE.TX);
      this.bleRx = await service.getCharacteristic(BLE.RX);
      tx.addEventListener('characteristicvaluechanged', (e) => {
        const v = e.target.value;
        this._feed(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      });
      await tx.startNotifications();
    } catch (err) {
      this._setStatus('error', 'Não consegui conectar por Bluetooth: ' + ((err && err.message) || err));
      return false;
    }
    this.link = 'ble';
    this.board = null;
    this._splitter = new LineSplitter();
    this._setStatus('opened');
    this._askHello(() => this.link === 'ble' && this.bleDevice === device);
    return true;
  }

  async _lostBle(device) {
    if (this.bleDevice !== device || this.link !== 'ble') return;
    this.link = null;
    this.bleRx = null;
    this.board = null;
    clearTimeout(this._helloTimer);
    this._setStatus('disconnected', 'O Bluetooth caiu. Tentando reconectar...');
    // Tenta de novo algumas vezes, cada vez esperando mais
    for (let i = 0, wait = 1000; i < 6 && this.bleWanted && !this.link; i++, wait = Math.min(wait * 2, 15000)) {
      await sleep(wait);
      if (this.link) return;
      if (await this._connectBle(device)) return;
    }
    if (!this.link) this._setStatus('disconnected', 'Não achei o controle Bluetooth. Clique em "Conectar por Bluetooth" de novo.');
  }

  /** Espera o aparelho aparecer (anunciar) e conecta. Usado depois de recarregar a página. */
  async _watchAndConnect(device) {
    if (device.watchAdvertisements) {
      const onAdv = async () => {
        device.removeEventListener('advertisementreceived', onAdv);
        if (!this.link) await this._connectBle(device);
      };
      device.addEventListener('advertisementreceived', onAdv);
      try {
        await device.watchAdvertisements();
        return;
      } catch (_) { /* cai para a tentativa direta */ }
    }
    if (!(await this._connectBle(device))) this._setStatus('disconnected', 'Clique em "Conectar por Bluetooth" para escolher o controle.');
  }

  // ======================= Comum =======================

  _askHello(stillSame) {
    // Ao abrir a porta USB, o ESP32 reinicia. Esperamos e pedimos HELLO algumas vezes.
    clearTimeout(this._helloTimer);
    let tries = 0;
    const ask = () => {
      if (!stillSame() || this.status === 'ready') return;
      if (tries++ < 6) {
        this.send(cmd.hello());
        this._helloTimer = setTimeout(ask, 1000);
      }
    };
    this._helloTimer = setTimeout(ask, this.link === 'ble' ? 200 : 1200);
  }

  _feed(bytes) {
    for (const line of this._splitter.push(this._decoder.decode(bytes, { stream: true }))) this._handleLine(line);
  }

  _handleLine(line) {
    const msg = parseLine(line);
    this.dispatchEvent(new CustomEvent('line', { detail: { line, msg } }));
    if (msg.type === 'hello') {
      this.board = msg.board;
      if (this.status !== 'ready') this._setStatus('ready');
      return;
    }
    if ((msg.type === 'dist' || msg.type === 'btn') && this.status !== 'ready') {
      // Dados válidos antes do HELLO: já serve
      this.board = this.board || '?';
      this._setStatus('ready');
    }
    if (msg.type === 'dist') this.dispatchEvent(new CustomEvent('dist', { detail: msg }));
    if (msg.type === 'btn') this.dispatchEvent(new CustomEvent('button', { detail: msg }));
  }

  async send(text) {
    const bytes = new TextEncoder().encode(text);
    if (this.link === 'usb' && this.writer) {
      try { await this.writer.write(bytes); } catch (_) { /* a porta caiu: o evento 'disconnect' resolve */ }
    } else if (this.link === 'ble' && this.bleRx) {
      // O Bluetooth não aceita duas escritas ao mesmo tempo: enfileiramos
      const rx = this.bleRx;
      this._bleQueue = this._bleQueue
        .then(() => (rx.writeValueWithoutResponse ? rx.writeValueWithoutResponse(bytes) : rx.writeValue(bytes)))
        .catch(() => {});
      return this._bleQueue;
    }
  }

  sonar(on) { return this.send(cmd.sonar(on)); }
  setDelay(ms) { return this.send(cmd.delay(ms)); }
  led(on) { return this.send(cmd.led(on)); }
  blink(n) { return this.send(cmd.blink(n)); }
  reset() { return this.send(cmd.reset()); }
}
