import { W, H, COLORS, rect, rrect, text, wrap } from '../gfx.js';
import { Minigame } from './base.js';

// Minigame: carregador de manivela.
// O celular está com 2%. Cada vez que a mão vai de PERTO até LONGE (ou volta), a manivela dá meia volta
// e a bateria sobe. Movimentos grandes e no seu ritmo; parado demais, a bateria volta a cair um pouco.

export const NEAR_CM = 13;   // mão mais perto que isso = "perto"
export const FAR_CM = 25;    // mão mais longe que isso = "longe"
export const PER_STROKE = 7; // % de bateria por meia volta
const START = 2;
const DRAIN_AFTER = 2.5;     // s parado antes de começar a cair
const DRAIN = 1;             // %/s

export class PumpGame extends Minigame {
  constructor(game) {
    super(game, {
      title: 'Carregador de manivela',
      instructions: [
        'Gire a manivela: leve a mão PERTO do sensor e depois LONGE, várias vezes.',
        'Cada ida ou volta completa enche um pouco a bateria. Vá no seu ritmo.',
        'Se parar muito tempo, a bateria volta a cair devagar.',
        'Encha até 100%! (Teclado: segure ↑ e ↓, alternando.)',
      ],
      timeLimit: 45,
      lagMs: 0,
    });
    this.charge = START;
    this.side = null;      // 'near' | 'far': último lado que a mão tocou
    this.strokes = 0;
    this.idle = 0;
    this.angle = 0;
    this.spark = 0;
  }

  update(dt, presses) {
    if (this.tickClock(dt)) {
      const c = Math.round(this.charge);
      const low = c < 30;
      this.finish({
        win: false,
        paciencia: low ? -10 : -5,
        flags: low ? ['semBateria'] : [],
        message: low
          ? `O braço cansou e o celular ficou com ${c}%. Não vai dar para usar o celular por um bom tempo.`
          : `O tempo do carregador acabou, mas o celular ficou com ${c}%. Dá para o gasto.`,
      });
      return;
    }
    if (this.result) return;
    this.keyboardHand(dt, 24);

    const cm = this.input.handCm();
    this.spark = Math.max(0, this.spark - dt);
    this.idle += dt;
    let side = null;
    if (cm != null && cm <= NEAR_CM) side = 'near';
    if (cm != null && cm >= FAR_CM) side = 'far';
    if (side && side !== this.side) {
      if (this.side) {
        this.strokes++;
        this.charge = Math.min(100, this.charge + PER_STROKE);
        this.idle = 0;
        this.spark = 0.4;
        this.fx.move();
      }
      this.side = side;
    }
    // a manivela acompanha a mão: cada meia volta é uma ida (ou volta) completa
    if (cm != null && this.side) {
      const k = Math.max(0, Math.min(1, (cm - NEAR_CM) / (FAR_CM - NEAR_CM)));
      this.angle = (this.strokes + (this.side === 'near' ? k : 1 - k)) * Math.PI;
    }
    if (this.idle > DRAIN_AFTER) this.charge = Math.max(START, this.charge - DRAIN * dt);

    if (this.charge >= 100) {
      this.finish({
        win: true,
        paciencia: 4,
        message: `Bateria cheia em ${Math.ceil(this.time)} segundos! "Isso aqui é igual bomba de bicicleta", ri Antônio.`,
      });
    }
  }

  draw(g) {
    rect(g, 0, 0, W, H, '#0e1a22');
    this.drawHeader(g);
    // poste do carregador
    rrect(g, 120, 90, 220, 400, 20, '#2b3b47', '#4de1ff55', 2);
    text(g, '⚡ ENERGIA', 230, 128, { size: 20, weight: 'bold', align: 'center', color: COLORS.neon1 });
    text(g, 'sustentável', 230, 150, { size: 14, align: 'center', color: COLORS.muted });
    // manivela
    const cx = 230, cy = 290, r = 70;
    g.beginPath(); g.arc(cx, cy, r + 10, 0, Math.PI * 2); g.fillStyle = '#1b262f'; g.fill();
    g.strokeStyle = '#9aa7b0'; g.lineWidth = 10;
    const hx = cx + Math.cos(this.angle - Math.PI / 2) * r;
    const hy = cy + Math.sin(this.angle - Math.PI / 2) * r;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(hx, hy); g.stroke();
    g.beginPath(); g.arc(hx, hy, 16, 0, Math.PI * 2); g.fillStyle = COLORS.accent; g.fill();
    g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fillStyle = '#9aa7b0'; g.fill();
    if (this.spark > 0) text(g, '⚡', cx + 80, cy - 70, { size: 44, color: COLORS.accent });
    text(g, `${this.strokes} meias-voltas`, 230, 440, { size: 16, align: 'center', color: COLORS.text });

    // celular
    rrect(g, 400, 90, 230, 400, 30, '#111', '#555', 4);
    rrect(g, 414, 112, 202, 356, 18, '#1d2430');
    const c = this.charge / 100;
    const col = c < 0.2 ? COLORS.bad : c < 0.6 ? COLORS.accent : COLORS.good;
    rrect(g, 470, 160, 90, 200, 12, null, '#fff', 4);
    rect(g, 497, 148, 36, 12, '#fff');
    rrect(g, 478, 168 + 184 * (1 - c), 74, 184 * c, 6, col);
    text(g, `${Math.round(this.charge)}%`, 515, 410, { size: 40, weight: 'bold', align: 'center', color: col });

    // guia da mão: perto / longe
    const cm = this.input.handCm();
    const gx = 690, gy = 110, gh = 360;
    const toY = (v) => gy + Math.min(1, Math.max(0, (v - 5) / 32)) * gh;
    rrect(g, gx, gy, 240, gh, 14, '#00000055', '#ffffff22', 1);
    const nearOn = this.side === 'near', farOn = this.side === 'far';
    rrect(g, gx + 10, gy + 6, 220, toY(NEAR_CM) - gy - 6, 10, nearOn ? '#3ddc8455' : '#ffffff10');
    rrect(g, gx + 10, toY(FAR_CM), 220, gy + gh - toY(FAR_CM) - 6, 10, farOn ? '#3ddc8455' : '#ffffff10');
    text(g, 'PERTO', gx + 120, (gy + toY(NEAR_CM)) / 2 + 8, { size: 22, weight: 'bold', align: 'center', color: nearOn ? COLORS.good : COLORS.text });
    text(g, 'LONGE', gx + 120, (toY(FAR_CM) + gy + gh) / 2 + 8, { size: 22, weight: 'bold', align: 'center', color: farOn ? COLORS.good : COLORS.text });
    const next = this.side === 'near' ? 'agora LONGE ↓' : this.side === 'far' ? 'agora PERTO ↑' : 'comece PERTO ↑';
    if (cm != null) {
      const y = toY(cm);
      rect(g, gx + 4, y - 2, 232, 4, COLORS.accent);
      text(g, `✋ ${Math.round(cm)} cm`, gx - 8, y + 6, { size: 14, align: 'right', color: COLORS.accent });
    } else {
      wrap(g, 'Ponha a mão na frente do sensor', gx + 120, gy + gh + 30, 240, { size: 14, align: 'center', color: COLORS.muted });
    }
    const my = (toY(NEAR_CM) + toY(FAR_CM)) / 2;
    rrect(g, gx + 30, my - 18, 180, 34, 17, '#000000cc', COLORS.accent, 2);
    text(g, next, gx + 120, my + 6, { size: 18, align: 'center', color: COLORS.accent, weight: 'bold' });
  }
}
