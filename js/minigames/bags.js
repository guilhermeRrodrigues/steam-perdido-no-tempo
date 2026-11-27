import { W, H, COLORS, rect, rrect, text } from '../gfx.js';
import { Minigame } from './base.js';

// Minigame: esteira de bagagens do ônibus.
// A esteira tem 3 trilhos. A distância da mão escolhe o trilho (perto = de cima, longe = de baixo).
// As coisas vêm da direita. Quando chegam na mão do Antônio, ele pega o que estiver no trilho da mão.
// Pegue as 3 coisas dele e desvie das malas parecidas (mão em outro trilho).

export const LANES = [
  { from: 0, to: 15.5, label: 'perto' },
  { from: 15.5, to: 24.5, label: 'meio' },
  { from: 24.5, to: 99, label: 'longe' },
];
export const GRAB_X = 250;          // onde fica a mão do Antônio
const SPEED = 105;                  // px/s: devagar, dá tempo de ler
const SPAWN_EVERY = 1.9;            // s entre um item e outro
const TARGET_CHANCE = 0.45;

export const TARGETS = [
  { id: 'mala', kind: 'mala', color: '#7a4a24', ribbon: '#e53935', label: 'Mala marrom, fita vermelha' },
  { id: 'presente', kind: 'sacola', color: '#1e88e5', ribbon: '#ffcc4d', label: 'Presente da Júlia' },
  { id: 'chapeu', kind: 'chapeu', color: '#e6c36a', ribbon: '#6d4c41', label: 'Chapéu de palha' },
];
export const DECOYS = [
  { kind: 'mala', color: '#7a4a24', ribbon: null, label: 'Mala marrom (sem fita)' },
  { kind: 'mala', color: '#222831', ribbon: '#e53935', label: 'Mala preta, fita vermelha' },
  { kind: 'mala', color: '#8e3b3b', ribbon: '#e53935', label: 'Mala vinho, fita vermelha' },
  { kind: 'sacola', color: '#d81b60', ribbon: '#ffcc4d', label: 'Sacola rosa' },
  { kind: 'chapeu', color: '#455a64', ribbon: '#222', label: 'Chapéu cinza' },
];

export function laneFor(cm) {
  if (cm == null) return -1;
  return LANES.findIndex((l) => cm >= l.from && cm < l.to);
}

export class BagsGame extends Minigame {
  constructor(game) {
    super(game, {
      title: 'Esteira de bagagens',
      instructions: [
        'A distância da mão escolhe o trilho da esteira: perto = de cima, meio, longe = de baixo.',
        'Quando a coisa chega na mão do Antônio (linha amarela), ele pega o que estiver no trilho da mão.',
        'Pegue as 3 coisas dele (veja a lista). Tire a mão do trilho das malas que não são dele!',
        'No teclado: segure ↑ e ↓.',
      ],
      timeLimit: 50,
      lagMs: 0,
    });
    this.items = [];
    this.got = new Set();
    this.wrong = 0;
    this.spawnIn = 0.6;
    this.lastLane = -1;
    this.grabFlash = null;
  }

  get missing() {
    return TARGETS.filter((t) => !this.got.has(t.id));
  }

  spawn() {
    const missing = this.missing.filter((t) => !this.items.some((i) => i.id === t.id));
    const isTarget = missing.length && Math.random() < TARGET_CHANCE;
    const proto = isTarget ? missing[Math.floor(Math.random() * missing.length)] : DECOYS[Math.floor(Math.random() * DECOYS.length)];
    let lane = Math.floor(Math.random() * 3);
    if (lane === this.lastLane) lane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
    this.lastLane = lane;
    this.items.push({ ...proto, lane, x: W + 60 });
  }

  update(dt, presses) {
    if (this.tickClock(dt)) {
      const n = this.got.size;
      this.finish({
        win: false,
        paciencia: -12 - 2 * this.wrong,
        message: n
          ? `A esteira parou com ${n} de 3 coisas na mão. O resto foi para o "Achados e Perdidos digital"... que só funciona pelo app.`
          : 'A esteira parou e levou tudo para o "Achados e Perdidos digital". Antônio passa meia hora numa fila para recuperar.',
      });
      return;
    }
    if (this.result) return;
    this.keyboardHand(dt);

    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawn();
      this.spawnIn = SPAWN_EVERY;
    }

    const hand = laneFor(this.input.handCm());
    this.handLane = hand;
    this.grabFlash = this.grabFlash && this.grabFlash.until > this.t ? this.grabFlash : null;
    for (const it of this.items) {
      const before = it.x;
      it.x -= SPEED * dt;
      if (before > GRAB_X && it.x <= GRAB_X && it.lane === hand) this.grab(it);
    }
    this.items = this.items.filter((it) => !it.taken && it.x > -80);

    if (this.got.size === TARGETS.length) {
      this.finish({
        win: true,
        paciencia: this.wrong ? -2 * this.wrong : 4,
        message: this.wrong
          ? `Pegou tudo, depois de devolver ${this.wrong} mala(s) que não eram dele. "Por que todo mundo tem mala igual?"`
          : 'Pegou as três coisas de primeira! Antônio ajeita o chapéu e segue confiante.',
      });
    }
  }

  grab(it) {
    it.taken = true;
    if (it.id && !this.got.has(it.id)) {
      this.got.add(it.id);
      this.fx.select();
      this.game.toast(`Pegou: ${it.label}!`);
      this.grabFlash = { ok: true, lane: it.lane, until: this.t + 0.6 };
    } else {
      this.wrong++;
      this.fx.error();
      this.game.toast('Essa não é do Antônio! Ele devolve, sem graça.');
      this.grabFlash = { ok: false, lane: it.lane, until: this.t + 0.6 };
    }
  }

  draw(g) {
    rect(g, 0, 0, W, H, '#14161f');
    this.drawHeader(g);
    const top = 120, laneH = 110;
    // esteira
    for (let i = 0; i < 3; i++) {
      const y = top + i * laneH;
      const active = i === this.handLane;
      rrect(g, 150, y, W - 170, laneH - 14, 12, active ? '#3a3f5c' : '#262a3a', active ? COLORS.accent : '#ffffff18', active ? 3 : 1);
      // roletes andando
      g.fillStyle = '#ffffff14';
      const off = (this.t * SPEED) % 40;
      for (let x = 160 + (40 - off); x < W - 30; x += 40) g.fillRect(x, y + laneH - 24, 18, 4);
      text(g, LANES[i].label, 160, y + 22, { size: 14, color: active ? COLORS.accent : COLORS.muted, weight: 'bold' });
      if (this.grabFlash && this.grabFlash.lane === i) {
        rrect(g, 150, y, W - 170, laneH - 14, 12, this.grabFlash.ok ? '#3ddc8433' : '#ff5c6c44');
      }
    }
    // linha da mão
    g.fillStyle = COLORS.accent;
    g.fillRect(GRAB_X - 2, top - 10, 4, laneH * 3 - 4);
    // mão do Antônio
    if (this.handLane >= 0) {
      const y = top + this.handLane * laneH + (laneH - 14) / 2;
      text(g, '✋', GRAB_X - 34, y + 14, { size: 40 });
    }
    for (const it of this.items) drawItem(g, it, it.x, top + it.lane * laneH + 48);

    // lista do que falta
    rrect(g, 14, 120, 128, 316, 12, COLORS.paper);
    text(g, 'Pegar:', 78, 146, { size: 16, weight: 'bold', align: 'center', color: COLORS.ink });
    TARGETS.forEach((t, i) => {
      const y = 170 + i * 92;
      drawItem(g, t, 78, y + 22, 0.7);
      const ok = this.got.has(t.id);
      text(g, ok ? '✔ pegou' : t.label.split(',')[0], 78, y + 74, { size: 12, align: 'center', color: ok ? '#1a7a3a' : COLORS.ink, weight: ok ? 'bold' : 'normal' });
    });
    const cm = this.input.handCm();
    text(g, cm == null ? 'Ponha a mão na frente do sensor' : `✋ ${Math.round(cm)} cm`, W / 2, H - 50, { size: 16, align: 'center', color: COLORS.muted });
  }
}

function drawItem(g, it, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (it.kind === 'mala') {
    rrect(g, -12, -36, 24, 10, 4, null, '#111', 4);
    rrect(g, -32, -28, 64, 50, 8, it.color, '#00000088', 2);
    if (it.ribbon) rect(g, -4, -28, 8, 50, it.ribbon);
  } else if (it.kind === 'sacola') {
    g.strokeStyle = '#333'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, -24, 12, Math.PI, 0); g.stroke();
    rrect(g, -26, -24, 52, 48, 6, it.color, '#00000088', 2);
    rect(g, -26, -6, 52, 7, it.ribbon);
    rect(g, -3, -24, 7, 48, it.ribbon);
  } else {
    g.beginPath(); g.ellipse(0, 8, 38, 11, 0, 0, Math.PI * 2); g.fillStyle = it.color; g.fill();
    rrect(g, -18, -22, 36, 32, 14, it.color, '#00000055', 1);
    rect(g, -18, 0, 36, 6, it.ribbon);
  }
  g.restore();
  if (s === 1) text(g, it.label, x, y + 44, { size: 15, align: 'center', color: '#fff' });
}
