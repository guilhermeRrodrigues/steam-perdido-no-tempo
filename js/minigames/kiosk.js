import { W, H, COLORS, rect, rrect, text, wrap, money } from '../gfx.js';
import { HandMenu, drawRuler } from '../handmenu.js';
import { Minigame, shuffle } from './base.js';

// Minigame 1: totem de autoatendimento.
// Muitas opções parecidas, letra pequena, faixas de distância estreitas (4 cm) e o totem lento.
// Passo 1: achar "Bilhetes e Recarga". Passo 2: achar "Unitário R$ 6,00".
// Propagandas aparecem: o "toquinho no ar" (ou Esc) fecha; se deixar a mão parada, ASSINA.

const STEPS = [
  {
    ask: 'Passo 1: encontre a opção de BILHETES',
    target: 'Bilhetes e Recarga',
    decoys: ['Bilhete Premium+', 'Recarga de Celular', 'Cadastro Facial', 'Cripto-Passe', 'Seguro Viagem',
      'Clube de Vantagens', 'Bilhetagem Corporativa', 'Ofertas do Dia', 'Pesquisa de Satisfação', 'Termos de Uso'],
  },
  {
    ask: 'Passo 2: compre UM bilhete unitário de R$ 6,00',
    target: 'Unitário  R$ 6,00',
    decoys: ['Unitário + Seguro  R$ 9,90', 'Pacote Mensal  R$ 189,00', 'Unitário Digital (só app)',
      'Unitário Expresso  R$ 8,50', 'Pacote 10x  R$ 57,00', 'Unitário  R$ 6,00 + taxa', 'Turista 24h  R$ 30,00',
      'Integração  R$ 10,40', 'Ajuda (R$ 2,00)'],
  },
];
const N_OPTIONS = 7;

export class KioskGame extends Minigame {
  constructor(game) {
    super(game, {
      title: 'Totem de autoatendimento',
      instructions: [
        'Mexa a mão perto e longe do sensor para passar pelas opções. Mão parada = aperta.',
        'As faixas são estreitas e o totem responde devagar. Leia com calma!',
        'Se aparecer propaganda, dê um toquinho rápido no ar (ou Esc) para fechar.',
        'Se deixar a mão parada na propaganda, você ASSINA sem querer.',
      ],
      timeLimit: 45,
      lagMs: 300,
    });
    this.step = 0;
    this.errors = 0;
    this.extraCost = 0;
    this.popup = null;
    this.nextPopup = 7;
    this.flash = 0;
    this.menu = new HandMenu(game, [], { zone: 4, dwell: 1200 });
    this.popupMenu = null;
    this.buildOptions();
  }

  buildOptions() {
    const s = STEPS[this.step];
    const list = shuffle(s.decoys).slice(0, N_OPTIONS - 1);
    list.splice(Math.floor(Math.random() * N_OPTIONS), 0, s.target);
    this.menu.setOptions(list);
  }

  update(dt, presses) {
    if (this.tickClock(dt)) {
      this.finish({
        win: false,
        saldo: -21 - this.extraCost,
        paciencia: -15,
        flags: this.extraCost ? ['assinatura'] : [],
        message: 'O tempo acabou e a tela voltou ao começo. Antônio desistiu e pagou o "Atendimento Assistido": R$ 21.' +
          (this.extraCost ? ' E ainda saiu com uma assinatura que não queria.' : ''),
      });
      return;
    }
    if (this.result) return;
    this.flash = Math.max(0, this.flash - dt);

    if (!this.popup && this.time > this.nextPopup) {
      this.popup = { x: 150 + Math.random() * 200, y: 130 + Math.random() * 90 };
      // A propaganda inteira é UMA opção gigante: qualquer distância "aperta" se ficar parada
      this.popupMenu = new HandMenu(this.game, ['ASSINAR'], { zone: 60, dwell: 1500 });
      this.popupMenu.picker.near = 0;
      this.popupMenu.picker.reset(this.input.handCm(), 1);
      this.popupMenu.picker.armed = true;
      this.fx.alarm();
    }

    if (this.popup) {
      if (presses.includes('B')) {
        this.popup = null;
        this.nextPopup = this.time + 8 + Math.random() * 5;
        this.fx.select();
        this.menu.picker.reset(this.input.handCm(), this.menu.options.length);
        return;
      }
      const r = this.popupMenu.update(dt, presses.filter((p) => p !== 'UP' && p !== 'DOWN'));
      if (r && r.pick === 0) {
        this.popup = null;
        this.nextPopup = this.time + 9;
        this.extraCost += 29.9;
        this.fx.error();
        this.game.toast('Ops! Assinou o "Metrô Premium" sem querer: R$ 29,90');
        this.menu.picker.reset(this.input.handCm(), this.menu.options.length);
      }
      return;
    }

    const r = this.menu.update(dt, presses);
    if (r && r.pick != null) this.press(r.pick);
  }

  press(i) {
    const s = STEPS[this.step];
    if (this.menu.options[i] === s.target) {
      if (this.step === 0) {
        this.step = 1;
        this.fx.select();
        this.buildOptions();
      } else {
        this.finish({
          win: true,
          saldo: -6 - this.extraCost,
          paciencia: -4 * this.errors,
          flags: this.extraCost ? ['assinatura'] : [],
          message: this.errors === 0
            ? 'Bilhete comprado! Antônio guarda o papelzinho com orgulho.'
            : `Bilhete comprado, depois de ${this.errors} erro(s). O totem não perdoa.`,
        });
      }
    } else {
      this.errors++;
      this.flash = 0.5;
      this.fx.error();
      this.game.toast('Opção errada! A tela voltou ao começo.');
      this.step = 0;
      this.buildOptions();
    }
  }

  draw(g) {
    rect(g, 0, 0, W, H, '#0b0d1c');
    rrect(g, 150, 66, 620, 440, 26, '#d9dde8');
    rrect(g, 168, 84, 584, 404, 14, this.flash > 0 ? '#3a0d18' : '#101935');
    this.drawHeader(g);

    const s = STEPS[this.step];
    text(g, 'METRÔ NOVA AURORA  •  Bem-vindo!', 460, 110, { size: 14, color: COLORS.neon1, align: 'center' });
    text(g, s.ask, 460, 134, { size: 17, color: COLORS.accent, align: 'center', weight: 'bold' });
    // letra pequena de propósito
    this.menu.draw(g, 190, 148, 540, 38, { size: 14, showRanges: true });

    if (this.extraCost) {
      text(g, `Assinaturas indesejadas: ${money(this.extraCost)}`, 460, 482, { size: 13, color: COLORS.bad, align: 'center' });
    }
    drawRuler(g, this.game, 860, 120, 380, this.menu.picker, this.menu.options.length);

    if (this.popup) {
      const { x, y } = this.popup;
      rrect(g, x, y, 400, 220, 16, '#ff4df0', '#fff', 3);
      text(g, '🎉 OFERTA IMPERDÍVEL! 🎉', x + 200, y + 48, { size: 24, weight: 'bold', align: 'center', color: '#fff' });
      wrap(g, 'Assine o Metrô Premium por apenas R$ 29,90/mês e ganhe 1 viagem grátis!', x + 200, y + 84, 340, { size: 16, align: 'center', color: '#fff' });
      rrect(g, x + 90, y + 140, 220, 46, 23, '#ffcc4d');
      text(g, 'ASSINAR', x + 200, y + 171, { size: 20, weight: 'bold', align: 'center', color: '#3a2a00' });
      const p = this.popupMenu.picker.progress;
      if (p > 0) rrect(g, x + 90, y + 192, 220 * p, 6, 3, '#fff');
      text(g, 'fechar: toquinho no ar / Esc', x + 392, y + 212, { size: 10, align: 'right', color: '#ffffffbb' });
    }
  }
}
