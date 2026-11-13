// Conexão com o controle pela Web Serial API (Chrome/Edge no computador).
//
// Autodetecção:
//  1. Ao carregar a página, navigator.serial.getPorts() devolve as portas que o usuário JÁ autorizou
//     antes. Se houver alguma, conectamos sem pedir nada.
//  2. O evento 'connect' dispara quando uma porta já autorizada é plugada no USB: conectamos sozinhos.
//  3. O evento 'disconnect' avisa quando o cabo sai. Aí esperamos o próximo 'connect'.
//  4. A PRIMEIRA vez exige um clique (regra de segurança do navegador): requestPort().

import { BAUD_RATE, USB_FILTERS, LineSplitter, parseLine, cmd } from './protocol.js';

export const serialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;

export class Controller extends EventTarget {
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.status = serialSupported() ? 'disconnected' : 'unsupported';
    this.board = null;
    this._opening = false;
    this._helloTimer = null;
  }

  _setStatus(status, detail = '') {
    this.status = status;
    this.dispatchEvent(new CustomEvent('status', { detail: { status, detail, board: this.board } }));
  }

  /** true quando a porta está aberta (mesmo antes do HELLO chegar). */
  get connected() {
    return this.status === 'ready' || this.status === 'opened';
  }

  /** Chamar uma vez ao carregar a página. */
  async init() {
    if (!serialSupported()) {
      this._setStatus('unsupported');
      return;
    }
    navigator.serial.addEventListener('connect', (e) => {
      if (!this.port) this.open(e.target);
    });
    navigator.serial.addEventListener('disconnect', (e) => {
      if (e.target === this.port) this._lost('O controle foi desligado do USB.');
    });
    await this.tryAutoConnect();
  }

  async tryAutoConnect() {
    const ports = await navigator.serial.getPorts();
    for (const port of ports) {
      if (await this.open(port)) return true;
    }
    if (!this.port) this._setStatus('disconnected');
    return false;
  }

  /** Abre o seletor de portas do navegador. Precisa ser chamado dentro de um clique. */
  async requestAndConnect(showAll = false) {
    if (!serialSupported()) return false;
    try {
      const port = await navigator.serial.requestPort(showAll ? {} : { filters: USB_FILTERS });
      return await this.open(port);
    } catch (err) {
      if (err && err.name === 'NotFoundError') this._setStatus('disconnected', 'Nenhuma porta escolhida.');
      else this._setStatus('error', String((err && err.message) || err));
      return false;
    }
  }

  async open(port) {
    if (this._opening || this.port) return false;
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
    this.board = null;
    this.writer = port.writable.getWriter();
    this._setStatus('opened');
    this._readLoop(port);

    // Ao abrir a porta, o ESP32 reinicia. Esperamos ele ligar e pedimos HELLO algumas vezes.
    clearTimeout(this._helloTimer);
    let tries = 0;
    const askHello = () => {
      if (this.port !== port || this.status === 'ready') return;
      if (tries++ < 6) {
        this.send(cmd.hello());
        this._helloTimer = setTimeout(askHello, 1000);
      }
    };
    this._helloTimer = setTimeout(askHello, 1200);
    return true;
  }

  async _readLoop(port) {
    const splitter = new LineSplitter();
    const decoder = new TextDecoder();
    while (port.readable && this.port === port) {
      try {
        this.reader = port.readable.getReader();
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          for (const line of splitter.push(decoder.decode(value, { stream: true }))) this._handleLine(line);
        }
      } catch (_) {
        // Erro de leitura (ruído no boot, por exemplo). Se a porta continuar aberta, lemos de novo.
      } finally {
        try { this.reader && this.reader.releaseLock(); } catch (_) { /* nada */ }
        this.reader = null;
      }
      if (this.port !== port) return;
    }
    if (this.port === port) this._lost('A conexão caiu.');
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
      // Recebeu dados válidos antes do HELLO: já serve
      this.board = this.board || '?';
      this._setStatus('ready');
    }
    if (msg.type === 'dist') this.dispatchEvent(new CustomEvent('dist', { detail: msg }));
    if (msg.type === 'btn') this.dispatchEvent(new CustomEvent('button', { detail: msg }));
  }

  async _lost(reason) {
    const port = this.port;
    if (!port) return;
    this.port = null;
    clearTimeout(this._helloTimer);
    try { this.reader && (await this.reader.cancel()); } catch (_) { /* nada */ }
    try { this.writer && this.writer.releaseLock(); } catch (_) { /* nada */ }
    this.writer = null;
    try { await port.close(); } catch (_) { /* nada */ }
    this.board = null;
    this._setStatus('disconnected', reason + ' Ligue o cabo de novo: o jogo reconecta sozinho.');
  }

  async send(text) {
    if (!this.writer) return;
    try {
      await this.writer.write(new TextEncoder().encode(text));
    } catch (_) {
      /* a porta caiu no meio do envio: o evento 'disconnect' resolve */
    }
  }

  sonar(on) { return this.send(cmd.sonar(on)); }
  setDelay(ms) { return this.send(cmd.delay(ms)); }
  led(on) { return this.send(cmd.led(on)); }
  blink(n) { return this.send(cmd.blink(n)); }
  reset() { return this.send(cmd.reset()); }
}
