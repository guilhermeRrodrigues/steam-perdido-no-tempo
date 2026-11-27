import { W, H, COLORS, rect, rrect, text, drawAntonio } from '../gfx.js';
import { Minigame } from './base.js';

// Minigame: atravessar a Avenida do Futuro.
// A mão mostra para onde o Antônio quer ir: perto do sensor = calçada de cá, longe = calçada de lá.
// Ele anda devagar até lá. Patinetes e robôs de entrega passam nas faixas da rua, sempre avisando antes
// (a faixa pisca). Se ele estiver na faixa quando passar, leva um susto e recua. Pare antes e espere passar!

export const HAND_FROM = 9;  // cm = posição 0 (calçada de cá)
export const HAND_TO = 31;   // cm = posição 1 (calçada de lá)
export const WALK = 0.11;    // posição por segundo (atravessa em ~9 s)
// Duas pistas com um canteiro no meio (lugar seguro para esperar).
export const LANES = [
  { from: 0.2, to: 0.42 },
  { from: 0.58, to: 0.8 },
];
export const WARN = 2.4;     // s de aviso antes de passar
const PASS = 0.9;            // s passando pela faixa
const GAP = [2.6, 3.8];      // s entre um aviso e outro

export function targetFor(cm) {
  if (cm == null) return null;
  return Math.max(0, Math.min(1, (cm - HAND_FROM) / (HAND_TO - HAND_FROM)));
}

export function laneAt(pos) {
  return LANES.findIndex((l) => pos > l.from && pos < l.to);
}

export class CrossGame extends Minigame {
  constructor(game) {
    super(game, {
      title: 'Atravessar a avenida',
      instructions: [
        'Mão PERTO do sensor = calçada de cá. Mão LONGE = calçada de lá. O Antônio anda devagar até onde a mão aponta.',
        'Patinetes e robôs passam pelas duas pistas. A pista PISCA antes: espere na calçada ou no canteiro do meio!',
        'Chegue do outro lado antes de o sinal fechar.',
        'No teclado: segure ↓ para ir e ↑ para voltar.',
      ],
      timeLimit: 40,
      lagMs: 0,
    });
    this.pos = 0;
    this.bumps = 0;
    this.events = []; // { lane, at (início da passagem), kind }
    this.nextEvent = 1.2;
    this.lastLane = -1;
    this.hurt = 0;
  }

  schedule() {
    let lane = Math.floor(Math.random() * LANES.length);
    if (lane === this.lastLane && Math.random() < 0.7) lane = (lane + 1) % LANES.length;
    this.lastLane = lane;
    this.events.push({ lane, at: this.time + WARN, kind: Math.random() < 0.5 ? '🛴' : '🤖', hit: false });
    this.nextEvent = this.time + GAP[0] + Math.random() * (GAP[1] - GAP[0]);
  }

  update(dt, presses) {
    if (this.tickClock(dt)) {
      this.finish({
        win: false,
        paciencia: -15,
        message: 'O sinal fechou com o Antônio no meio da rua. Os carros autônomos buzinam em coro. Ele volta, assustado, e sobe a passarela.',
      });
      return;
    }
    if (this.result) return;
    this.keyboardHand(dt, 10);
    this.hurt = Math.max(0, this.hurt - dt);

    if (this.time >= this.nextEvent) this.schedule();
    this.events = this.events.filter((e) => this.time < e.at + PASS);

    const target = targetFor(this.input.handCm());
    this.target = target;
    if (target != null && this.hurt <= 0) {
      const step = WALK * dt;
      if (Math.abs(target - this.pos) <= step) this.pos = target;
      else this.pos += Math.sign(target - this.pos) * step;
    }

    const lane = laneAt(this.pos);
    for (const e of this.events) {
      if (!e.hit && e.lane === lane && this.time >= e.at && this.time < e.at + PASS) {
        e.hit = true;
        this.bumps++;
        this.hurt = 1.0;
        this.pos = lane === 0 ? 0.1 : 0.5; // recua para a calçada ou para o canteiro
        this.fx.error();
        this.game.toast(e.kind === '🛴' ? 'Um patinete passou raspando! Antônio recua.' : 'Um robô de entrega quase atropelou! Antônio recua.');
      }
    }

    if (this.pos >= 0.97) {
      this.finish({
        win: true,
        paciencia: this.bumps ? -3 * this.bumps : 3,
        message: this.bumps
          ? `Atravessou, depois de ${this.bumps} susto(s). "Antigamente o perigo era só o carro."`
          : 'Atravessou sem nenhum susto, esperando cada patinete passar. Paciência é tudo!',
      });
    }
  }

  draw(g) {
    rect(g, 0, 0, W, H, '#1a1d24');
    this.drawHeader(g);
    const x0 = 80, x1 = W - 80;
    const toX = (p) => x0 + p * (x1 - x0);
    const yTop = 110, yBot = 470;
    // calçadas e asfalto
    rect(g, toX(0) - 60, yTop, toX(0.2) - toX(0) + 60, yBot - yTop, '#5a5e66');
    rect(g, toX(0.8), yTop, toX(1) - toX(0.8) + 60, yBot - yTop, '#5a5e66');
    rect(g, toX(0.2), yTop, toX(0.8) - toX(0.2), yBot - yTop, '#2b2e35');
    rect(g, toX(0.42), yTop, toX(0.58) - toX(0.42), yBot - yTop, '#4c6b4a'); // canteiro
    text(g, 'canteiro', toX(0.5), yBot - 12, { size: 14, align: 'center', color: '#cfe8c8' });
    // faixa de pedestre
    for (const [a, b] of LANES.map((l) => [toX(l.from), toX(l.to)])) for (let x = a + 6; x < b - 10; x += 34) rect(g, x, 262, 20, 76, '#ffffffcc');

    // faixas da rua com aviso e passagem
    LANES.forEach((l, i) => {
      const ev = this.events.find((e) => e.lane === i);
      const xa = toX(l.from), xb = toX(l.to);
      if (ev && this.time < ev.at) {
        const blink = Math.floor(this.t * 5) % 2 === 0;
        if (blink) rect(g, xa, yTop, xb - xa, yBot - yTop, '#ff5c6c44');
        text(g, '⚠', (xa + xb) / 2, yTop + 40, { size: 34, align: 'center', color: COLORS.bad });
        text(g, `${Math.ceil(ev.at - this.time)}`, (xa + xb) / 2, yTop + 74, { size: 20, align: 'center', weight: 'bold', color: '#fff' });
      }
      if (ev && this.time >= ev.at) {
        const k = (this.time - ev.at) / PASS;
        rect(g, xa, yTop, xb - xa, yBot - yTop, '#ff5c6c22');
        text(g, ev.kind, (xa + xb) / 2, yTop + 30 + k * (yBot - yTop), { size: 46, align: 'center' });
      }
    });

    // semáforo
    const left = this.timeLeft;
    const sx = toX(0.9);
    rrect(g, sx - 30, yTop + 10, 60, 110, 10, '#111');
    text(g, left > 8 ? '🚶' : '✋', sx, yTop + 66, { size: 36, align: 'center' });
    text(g, `${Math.ceil(left)}`, sx, yTop + 104, { size: 20, align: 'center', weight: 'bold', color: left > 8 ? COLORS.good : COLORS.bad });

    // para onde a mão aponta
    if (this.target != null) {
      g.strokeStyle = COLORS.accent; g.setLineDash([6, 6]); g.lineWidth = 3;
      g.beginPath(); g.moveTo(toX(this.target), 240); g.lineTo(toX(this.target), 360); g.stroke();
      g.setLineDash([]);
      text(g, '✋', toX(this.target), 236, { size: 24, align: 'center' });
    }
    const wobble = this.hurt > 0 ? Math.sin(this.t * 40) * 4 : 0;
    drawAntonio(g, toX(this.pos) + wobble, 320, 0.9, this.hurt > 0 ? -1 : 0);

    text(g, 'cá', toX(0.04), yBot + 22, { size: 15, align: 'center', color: COLORS.muted });
    text(g, 'lá (chegada)', toX(0.94), yBot + 22, { size: 15, align: 'center', color: COLORS.good });
    if (this.target == null) text(g, 'Ponha a mão na frente do sensor', W / 2, yBot + 22, { size: 15, align: 'center', color: COLORS.muted });
  }
}
