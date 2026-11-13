import { W, COLORS, rrect, text, bar } from '../gfx.js';

// Base de todo minigame.
// O jogo chama: start() -> update(dt, presses) e draw(g) a cada quadro -> lê this.result quando terminar.
// result = { win, saldo, paciencia, flags: [], message }
export class Minigame {
  constructor(game, { title, instructions, timeLimit = 30, lagMs = 0 }) {
    this.game = game;
    this.input = game.input;
    this.fx = game.fx;
    this.title = title;
    this.instructions = instructions; // lista de linhas mostradas antes de começar
    this.timeLimit = timeLimit;
    this.lagMs = lagMs;
    this.time = 0;
    this.result = null;
    this.t = 0;
  }

  start() {
    this.input.setLag(this.lagMs);
    this.input.clear();
  }

  finish(result) {
    if (this.result) return;
    this.result = { saldo: 0, paciencia: 0, flags: [], ...result };
    this.input.setLag(0);
    if (result.win) this.fx.success();
    else this.fx.error();
  }

  get timeLeft() {
    return Math.max(0, this.timeLimit - this.time);
  }

  /** Avança o relógio. Retorna true se o tempo acabou neste quadro. */
  tickClock(dt) {
    this.t += dt;
    if (this.result) return false;
    const before = this.timeLeft;
    this.time += dt;
    if (Math.ceil(this.timeLeft) !== Math.ceil(before) && this.timeLeft <= 5 && this.timeLeft > 0) this.fx.tick();
    return this.timeLeft <= 0;
  }

  drawHeader(g) {
    rrect(g, 20, 14, W - 40, 44, 12, '#00000088');
    text(g, this.title, 40, 44, { size: 22, weight: 'bold', color: COLORS.accent });
    const left = this.timeLeft;
    const color = left < 6 ? COLORS.bad : COLORS.neon1;
    text(g, `${Math.ceil(left)} s`, W - 180, 44, { size: 22, weight: 'bold', color, align: 'right' });
    bar(g, W - 168, 28, 128, 14, left / this.timeLimit, color);
    if (this.lagMs > 0) {
      text(g, '⚠ controle lento', W / 2 + 60, 44, { size: 15, color: COLORS.muted, align: 'center' });
    }
  }
}

/** Embaralha uma cópia da lista. */
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
