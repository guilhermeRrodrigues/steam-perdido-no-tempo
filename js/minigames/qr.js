import { W, H, COLORS, rect, rrect, text, bar } from '../gfx.js';
import { Minigame } from './base.js';

// Minigame 3: ler o QR code do cardápio.
// A mão é o celular: a distância até o sensor é a distância do celular até a plaquinha.
// A câmera só foca numa faixa estreita, e essa faixa fica mudando (a mão treme, o garçom mexe na mesa).
// Segure dentro da faixa até a barra encher.

const NEED = 3.0;       // segundos de foco acumulado
const BAND = 3.5;       // cm para cada lado do ponto de foco

export class QrGame extends Minigame {
  constructor(game) {
    super(game, {
      title: 'QR code do cardápio',
      instructions: [
        'Sua mão é o celular. Aproxime ou afaste até a imagem ficar nítida (faixa verde).',
        'O foco fica mudando de lugar: acompanhe com calma.',
        'Mantenha no foco até encher a barra.',
        'No teclado: segure ↑ (aproxima) e ↓ (afasta).',
      ],
      timeLimit: 30,
      lagMs: 200,
    });
    this.progress = 0;
    this.seed = Math.random() * 100;
    this.qr = makeQr();
  }

  focusCm() {
    const t = this.time + this.seed;
    return 24 + 8 * Math.sin(t * 0.45) + 3 * Math.sin(t * 1.3 + 1);
  }

  update(dt, presses) {
    if (this.tickClock(dt)) {
      this.finish({
        win: false,
        saldo: -12,
        paciencia: -15,
        message: 'O celular não focou. Antônio desiste e come um salgado frio da máquina: R$ 12.',
      });
      return;
    }
    if (this.result) return;
    if (this.input.held.UP) this.input.nudgeHand(-12 * dt);
    if (this.input.held.DOWN) this.input.nudgeHand(12 * dt);

    const cm = this.input.handCm();
    const inFocus = cm != null && Math.abs(cm - this.focusCm()) <= BAND;
    this.inFocus = inFocus;
    if (inFocus) this.progress += dt;
    else this.progress = Math.max(0, this.progress - dt * 0.6);

    if (this.progress >= NEED) {
      this.finish({
        win: true,
        saldo: -32,
        paciencia: 0,
        message: 'Leu! O cardápio abre e Antônio pede um PF de R$ 32. Mas a letra do cardápio... é minúscula.',
      });
    }
  }

  draw(g) {
    rect(g, 0, 0, W, H, '#1d140c');
    this.drawHeader(g);
    // mesa e plaquinha com QR
    rrect(g, 60, 110, 380, 380, 20, '#3b2a1a');
    const cm = this.input.handCm();
    const focus = this.focusCm();
    const err = cm == null ? 99 : Math.abs(cm - focus);
    const blur = cm == null ? 14 : err <= BAND ? 0 : Math.min(14, 2 + (err - BAND) * 2);
    const shake = Math.sin(this.t * 23) * 3 + Math.cos(this.t * 17) * 2;
    // "Fora de foco": desenhamos o QR pequeno num canvas escondido e ampliamos (fica borrado).
    // É bem mais leve que filtro de blur.
    const size = 220 * (cm == null ? 1 : Math.max(0.55, Math.min(1.5, 24 / cm)));
    const res = Math.max(10, Math.round(size / (1 + blur * 0.9)));
    if (!this.off) this.off = document.createElement('canvas');
    this.off.width = res + 4;
    this.off.height = res + 4;
    const og = this.off.getContext('2d');
    drawQr(og, this.qr, 2, 2, res);
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.off, 250 - size / 2 + shake, 300 - size / 2, size, size);
    g.restore();
    rrect(g, 120, 170, 260, 260, 18, null, this.inFocus ? COLORS.good : '#ffffff55', 4);
    text(g, 'Escaneie para ver o cardápio', 250, 470, { size: 15, align: 'center', color: COLORS.paper });

    // régua de foco
    const x = 560, y = 110, h = 380;
    const maxCm = 50;
    const toY = (v) => y + (Math.min(v, maxCm) / maxCm) * h;
    rrect(g, x, y, 70, h, 12, '#00000066', '#ffffff22', 1);
    g.fillStyle = '#3ddc8455';
    g.fillRect(x + 4, toY(focus - BAND), 62, toY(focus + BAND) - toY(focus - BAND));
    text(g, 'foco', x + 35, toY(focus) + 5, { size: 13, align: 'center', color: COLORS.good });
    text(g, 'sensor', x + 35, y - 8, { size: 12, align: 'center', color: COLORS.muted });
    if (cm != null) {
      const yy = toY(cm);
      rect(g, x - 10, yy - 2, 90, 4, COLORS.accent);
      text(g, `📱 ${Math.round(cm)} cm`, x + 96, yy + 5, { size: 15, color: COLORS.accent });
    } else {
      text(g, 'Coloque a mão na frente do sensor', x + 35, y + h + 24, { size: 14, align: 'center', color: COLORS.bad });
    }

    text(g, 'Leitura do QR', 700, 160, { size: 18, color: COLORS.text });
    bar(g, 700, 172, 220, 22, this.progress / NEED, this.inFocus ? COLORS.good : COLORS.neon1);
    text(g, this.inFocus ? 'Focado! Segure...' : cm == null ? 'Sem mão' : cm < focus ? 'Perto demais' : 'Longe demais',
      700, 224, { size: 16, color: this.inFocus ? COLORS.good : COLORS.muted });
  }
}

function makeQr() {
  const n = 21;
  const cells = [];
  for (let i = 0; i < n * n; i++) cells.push(Math.random() > 0.5);
  return { n, cells };
}

function drawQr(g, qr, x, y, size) {
  const c = size / qr.n;
  rect(g, x - c, y - c, size + 2 * c, size + 2 * c, '#fff');
  const finder = (fx, fy) => {
    rect(g, x + fx * c, y + fy * c, 7 * c, 7 * c, '#000');
    rect(g, x + (fx + 1) * c, y + (fy + 1) * c, 5 * c, 5 * c, '#fff');
    rect(g, x + (fx + 2) * c, y + (fy + 2) * c, 3 * c, 3 * c, '#000');
  };
  for (let r = 0; r < qr.n; r++) {
    for (let k = 0; k < qr.n; k++) {
      const inFinder = (r < 8 && k < 8) || (r < 8 && k > qr.n - 9) || (r > qr.n - 9 && k < 8);
      if (!inFinder && qr.cells[r * qr.n + k]) rect(g, x + k * c, y + r * c, c + 0.5, c + 0.5, '#000');
    }
  }
  finder(0, 0);
  finder(qr.n - 7, 0);
  finder(0, qr.n - 7);
}
