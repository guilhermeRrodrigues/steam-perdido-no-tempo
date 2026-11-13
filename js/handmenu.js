// Menu controlado pela mão (ou pelo teclado).
//  - Mão: a distância escolhe a opção; parada ~1 s confirma; "toquinho no ar" = voltar.
//  - Teclado: ↑/↓ escolhe, Enter confirma, Esc volta.
//  - BOOT da placa: confirma a opção destacada na hora.

import { HandPicker, HAND } from './protocol.js';
import { COLORS, rrect, text, wrap, bar } from './gfx.js';

export class HandMenu {
  constructor(game, options, { zone = HAND.ZONE, dwell = HAND.DWELL, allowBack = false } = {}) {
    this.game = game;
    this.options = options; // lista de textos
    this.picker = new HandPicker({ zone, dwell });
    this.allowBack = allowBack;
    this.cursor = 0;
    this.usingHand = false;
    this.picker.reset(game.input.handCm(), options.length);
  }

  setOptions(options) {
    this.options = options;
    this.cursor = Math.min(this.cursor, options.length - 1);
    this.picker.reset(this.game.input.handCm(), options.length);
  }

  /**
   * Atualiza com as ações do quadro. Retorna:
   *   { pick: índice } quando confirmou, { back: true } para voltar, ou null.
   */
  update(dt, presses) {
    const n = this.options.length;
    const cm = this.game.input.handCm();
    const before = this.cursor;
    const confirmed = this.picker.update(dt * 1000, cm, n);
    if (this.picker.index >= 0) {
      this.cursor = this.picker.index;
      this.usingHand = true;
    }
    if (this.cursor !== before) this.game.fx.move();
    if (confirmed >= 0) {
      this.game.fx.select();
      return { pick: confirmed };
    }
    for (const p of presses) {
      if (p === 'UP') { this.cursor = (this.cursor + n - 1) % n; this.usingHand = false; this.game.fx.move(); }
      if (p === 'DOWN') { this.cursor = (this.cursor + 1) % n; this.usingHand = false; this.game.fx.move(); }
      if (p === 'A') { this.game.fx.select(); return { pick: this.cursor }; }
      if (p === 'B' && this.allowBack) return { back: true };
    }
    return null;
  }

  /** Desenha as opções como cartões empilhados (a de cima é a mais perto do sensor). */
  draw(g, x, y, w, rowH = 52, { size = 20, showRanges = true } = {}) {
    this.options.forEach((label, i) => {
      const yy = y + i * (rowH + 8);
      const sel = i === this.cursor;
      rrect(g, x, yy, w, rowH, 12, sel ? '#2f3a7a' : '#1b1f3bcc', sel ? COLORS.accent : '#ffffff22', sel ? 3 : 1);
      if (sel && this.picker.index === i) bar(g, x + 10, yy + rowH - 8, w - 20, 4, this.picker.progress, COLORS.accent, '#ffffff11');
      if (showRanges) {
        const [a, b] = this.picker.range(i);
        text(g, `${a}–${b} cm`, x + w - 14, yy + rowH / 2 + 6, { size: 13, color: COLORS.muted, align: 'right' });
      }
      wrap(g, label, x + 18, yy + rowH / 2 + size * 0.35, w - (showRanges ? 110 : 36), { size, color: sel ? '#fff' : COLORS.text });
    });
  }
}

/** Régua vertical: mostra a mão e as faixas de distância. Topo = perto do sensor. */
export function drawRuler(g, game, x, y, h, picker, n) {
  const maxCm = picker ? picker.near + picker.zone * n + 6 : 50;
  const toY = (cm) => y + (Math.min(cm, maxCm) / maxCm) * h;
  rrect(g, x, y, 34, h, 10, '#00000066', '#ffffff22', 1);
  // zona do toque (voltar)
  g.fillStyle = '#ff5c6c33';
  g.fillRect(x + 2, y + 2, 30, toY(HAND.TAP_MAX) - y - 2);
  if (picker) {
    for (let i = 0; i < n; i++) {
      const [a, b] = picker.range(i);
      g.fillStyle = i === picker.index ? '#ffcc4d88' : i % 2 ? '#4de1ff22' : '#4de1ff3a';
      g.fillRect(x + 4, toY(a), 26, toY(b) - toY(a));
      text(g, String(i + 1), x + 17, (toY(a) + toY(b)) / 2 + 5, { size: 12, align: 'center', color: '#fff' });
    }
  }
  text(g, 'sensor', x + 17, y - 6, { size: 11, align: 'center', color: COLORS.muted });
  const cm = game.input.handCm();
  if (cm != null) {
    const yy = toY(cm);
    g.fillStyle = COLORS.accent;
    g.beginPath();
    g.moveTo(x - 4, yy);
    g.lineTo(x - 16, yy - 8);
    g.lineTo(x - 16, yy + 8);
    g.fill();
    text(g, `✋ ${Math.round(cm)} cm`, x - 20, yy + 5, { size: 13, align: 'right', color: COLORS.accent });
  } else {
    text(g, 'sem mão', x + 17, y + h + 16, { size: 11, align: 'center', color: COLORS.muted });
  }
}
