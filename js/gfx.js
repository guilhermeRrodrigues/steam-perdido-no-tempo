// Funções de desenho reaproveitadas por todas as telas.

export const W = 960;
export const H = 540;

export const COLORS = {
  bg: '#0f1226',
  panel: '#1b1f3b',
  panel2: '#262b52',
  text: '#f4f1e8',
  muted: '#a9a6c4',
  accent: '#ffcc4d',
  good: '#3ddc84',
  bad: '#ff5c6c',
  neon1: '#4de1ff',
  neon2: '#ff4df0',
  paper: '#efe6cf',
  ink: '#2b2418',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

export function rrect(g, x, y, w, h, r, fill, stroke, lineWidth = 2) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lineWidth;
    g.stroke();
  }
}

export function text(g, str, x, y, { size = 20, color = COLORS.text, align = 'left', weight = 'normal', baseline = 'alphabetic' } = {}) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = baseline;
  g.fillText(str, x, y);
}

/** Escreve texto quebrando linhas para caber em maxWidth. Retorna o y final. */
export function wrap(g, str, x, y, maxWidth, { size = 20, color = COLORS.text, lineHeight = 1.4, align = 'left', weight = 'normal' } = {}) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  const words = String(str).split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxWidth && line) {
      g.fillText(line, x, y);
      line = word;
      y += size * lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    g.fillText(line, x, y);
    y += size * lineHeight;
  }
  return y;
}

/** Fundo de cidade futurista (prédios com janelas neon). Determinístico pela "seed". */
export function cityBackdrop(g, t, seed = 1, tint = COLORS.neon1) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#120c2e');
  grad.addColorStop(1, '#2a1240');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  let s = seed * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    while (x < W) {
      const bw = 50 + rnd() * 80;
      const bh = 120 + rnd() * (layer ? 220 : 320);
      const y = H - bh;
      g.fillStyle = layer ? '#1a1638' : '#0c0a22';
      g.fillRect(x, y, bw, bh);
      for (let wy = y + 12; wy < H - 10; wy += 18) {
        for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
          if (rnd() > 0.55) {
            const on = Math.sin(t * 0.8 + wx * 0.37 + wy) > -0.6;
            g.fillStyle = on ? (rnd() > 0.7 ? COLORS.neon2 : tint) : '#2c2650';
            g.globalAlpha = layer ? 0.55 : 0.3;
            g.fillRect(wx, wy, 6, 8);
          }
        }
      }
      g.globalAlpha = 1;
      x += bw + 6;
    }
  }
}

/** Desenha o Seu Antônio (boné, bigode, bengala). */
export function drawAntonio(g, x, y, scale = 1, mood = 0) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  // corpo
  rrect(g, -28, -40, 56, 90, 14, '#6b4f3a');
  // camisa xadrez
  rrect(g, -24, -36, 48, 50, 8, '#c94f4f');
  g.strokeStyle = '#8f2f2f';
  g.lineWidth = 2;
  for (let i = -20; i < 24; i += 10) {
    g.beginPath(); g.moveTo(i, -36); g.lineTo(i, 14); g.stroke();
  }
  // cabeça
  g.beginPath(); g.arc(0, -64, 26, 0, Math.PI * 2); g.fillStyle = '#e0b48c'; g.fill();
  // boné
  rrect(g, -26, -94, 52, 22, 10, '#2f4a7a');
  rect(g, 2, -78, 34, 6, '#2f4a7a');
  // olhos
  rect(g, -12, -68, 5, 5, '#222');
  rect(g, 7, -68, 5, 5, '#222');
  // bigode
  rrect(g, -14, -56, 28, 7, 4, '#e8e8e8');
  // boca (humor)
  g.beginPath();
  g.strokeStyle = '#5a3020';
  g.lineWidth = 2.5;
  if (mood > 0) g.arc(0, -50, 7, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood < 0) g.arc(0, -40, 7, 1.15 * Math.PI, 1.85 * Math.PI);
  else { g.moveTo(-6, -46); g.lineTo(6, -46); }
  g.stroke();
  // óculos
  g.strokeStyle = '#333'; g.lineWidth = 2;
  g.strokeRect(-17, -72, 13, 11); g.strokeRect(4, -72, 13, 11);
  // bengala
  g.strokeStyle = '#8b5a2b'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(36, -10); g.lineTo(36, 50); g.stroke();
  g.beginPath(); g.arc(28, -10, 8, Math.PI, 0); g.stroke();
  // pernas
  rect(g, -20, 50, 16, 28, '#3b3b4f');
  rect(g, 4, 50, 16, 28, '#3b3b4f');
  g.restore();
}

/** Barra de progresso simples. */
export function bar(g, x, y, w, h, value, color, bgColor = '#00000066') {
  rrect(g, x, y, w, h, h / 2, bgColor);
  const v = Math.max(0, Math.min(1, value));
  if (v > 0) rrect(g, x, y, Math.max(h, w * v), h, h / 2, color);
}

export function money(v) {
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
