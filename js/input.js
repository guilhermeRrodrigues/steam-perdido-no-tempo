// Junta a mão (sensor ultrassônico), o botão BOOT e o teclado num só lugar.
//
// O jogo recebe:
//  - handCm(): distância atual da mão (ou null)
//  - consume(): ações discretas do quadro: 'UP', 'DOWN', 'A' (confirmar), 'B' (voltar)
//      * teclado: setas/W/S, Enter/Espaço, Esc/Backspace
//      * placa: BOOT vira 'A'; o "toquinho no ar" vira 'B'
//
// Dificuldade do idoso: setLag(ms) atrasa tudo. Com o controle, quem atrasa é a própria placa
// (comando DELAY), como um aparelho lento de verdade. No teclado, o atraso é feito aqui.

import { TapDetector } from './protocol.js';

const KEYMAP = {
  ArrowUp: 'UP', KeyW: 'UP',
  ArrowDown: 'DOWN', KeyS: 'DOWN',
  ArrowLeft: 'LEFT', KeyA: 'LEFT',
  ArrowRight: 'RIGHT', KeyD: 'RIGHT',
  Enter: 'A', Space: 'A',
  Escape: 'B', Backspace: 'B',
};

export class Input {
  constructor(controller) {
    this.controller = controller;
    this.held = { UP: false, DOWN: false, LEFT: false, RIGHT: false, A: false, B: false };
    this.queue = [];
    this.lagMs = 0;
    this.hand = { cm: null, at: 0, source: 'none' };
    this.tap = new TapDetector();
    this.sensorSeen = false; // já recebemos alguma distância do sensor nesta sessão?

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'KeyR') {
        e.preventDefault();
        const base = this.hand.cm == null ? 25 : this.hand.cm;
        const cm = e.code === 'KeyR' ? null : Math.max(3, Math.min(60, base + (e.code === 'KeyQ' ? -2 : 2)));
        this._later(() => this._setHand(cm, 'keyboard'));
        return;
      }
      const action = KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (e.repeat) return;
      this._later(() => this._emit(action, true));
    });
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      this._later(() => this._emit(action, false));
    });

    controller.addEventListener('dist', (e) => {
      this.sensorSeen = true;
      this._setHand(e.detail.cm, 'sensor');
    });
    controller.addEventListener('button', (e) => this._emit(e.detail.button, e.detail.pressed));
    controller.addEventListener('status', (e) => {
      if (e.detail.status === 'ready') {
        controller.sonar(true);
        controller.setDelay(this.lagMs);
      }
    });
  }

  _later(fn) {
    if (this.lagMs > 0) setTimeout(fn, this.lagMs);
    else fn();
  }

  _emit(action, pressed) {
    this.held[action] = pressed;
    if (pressed) this.queue.push(action);
  }

  _setHand(cm, source) {
    const now = performance.now();
    this.hand = { cm, at: now, source };
    if (this.tap.feed(now, cm)) this.queue.push('B');
  }

  /** Move a mão "de mentira" (teclado) continuamente. Usado no minigame do QR code. */
  nudgeHand(deltaCm) {
    const base = this.hand.cm == null ? 25 : this.hand.cm;
    this._setHand(Math.max(3, Math.min(60, base + deltaCm)), 'keyboard');
  }

  /** Distância atual da mão, ou null. Leitura velha do sensor (mais de 1 s) conta como "sem mão". */
  handCm() {
    if (this.hand.cm == null) return null;
    if (this.hand.source === 'sensor' && performance.now() - this.hand.at > 1000 + this.lagMs) return null;
    return this.hand.cm;
  }

  /** Retorna e limpa as ações acumuladas desde o último quadro. */
  consume() {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  clear() {
    this.queue = [];
  }

  setLag(ms) {
    this.lagMs = ms;
    if (this.controller.connected) this.controller.setDelay(ms);
  }
}
