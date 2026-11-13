// Sons (no computador, com Web Audio) e luz (LED azul da placa, se o controle estiver ligado).

let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

function tone(hz, ms, type = 'triangle', volume = 0.07, delayMs = 0) {
  const ac = ctx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume();
  const t0 = ac.currentTime + delayMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.setTargetAtTime(0, t0 + ms / 1000 - 0.03, 0.01);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + ms / 1000);
}

export class Feedback {
  constructor(controller) {
    this.controller = controller;
    this.muted = false;
    this._ledTimer = null;
  }

  _play(...args) {
    if (!this.muted) tone(...args);
  }

  /** Mão mudou de opção */
  move() { this._play(560, 35, 'triangle', 0.035); }

  /** Confirmou algo */
  select() { this._play(780, 80); }

  success() {
    this._play(880, 120);
    this._play(1320, 180, 'triangle', 0.07, 130);
    if (this.controller.connected) {
      this.controller.led(true);
      clearTimeout(this._ledTimer);
      this._ledTimer = setTimeout(() => this.controller.led(false), 800);
    }
  }

  error() {
    this._play(196, 300, 'sawtooth', 0.06);
    if (this.controller.connected) this.controller.blink(3);
  }

  alarm() {
    this._play(1500, 90, 'square', 0.05);
    this._play(1500, 90, 'square', 0.05, 160);
    if (this.controller.connected) this.controller.blink(2);
  }

  tick() { this._play(1000, 25, 'square', 0.02); }
}
