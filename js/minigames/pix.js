import { W, H, COLORS, rect, rrect, text, wrap, money } from '../gfx.js';
import { HandMenu, drawRuler } from '../handmenu.js';
import { Minigame, shuffle } from './base.js';

// Minigame 2: app do banco / Pix.
// 1) Escolher a chave Pix certa (comparando com a placa da farmácia; as outras são parecidas).
// 2) Escolher o valor certo (R$ 84,90), entre valores com vírgula no lugar errado.
// 3) Conferir o nome de quem vai receber antes de confirmar.
// No meio, chega uma mensagem de golpe "urgente". A opção perigosa fica na faixa mais fácil.

const RIGHT_KEY = 'farmacia@vidaboa.com.br';
const KEYS = [RIGHT_KEY, 'farmacia@vidaboa.com', 'farmacia@vida-boa.com.br', 'farmacia.vidaboa@gmail.com'];
const RIGHT_VALUE = 84.9;
const VALUES = [84.9, 8.49, 849.0, 48.9];

export class PixGame extends Minigame {
  constructor(game) {
    super(game, {
      title: 'App do banco: pagar com Pix',
      instructions: [
        'Pague o remédio: R$ 84,90 para a chave que está na placa da farmácia.',
        'As chaves e os valores são MUITO parecidos. Confira letra por letra.',
        'Antes de confirmar, veja o NOME de quem vai receber. Se estiver errado, cancele.',
        'Desconfie de mensagens urgentes!',
      ],
      timeLimit: 60,
      lagMs: 250,
    });
    this.stage = 'key'; // key -> scam -> value -> confirm
    this.chosenKey = null;
    this.chosenValue = null;
    this.paciencia = 0;
    this.scamShown = false;
    this.menu = new HandMenu(game, shuffle(KEYS));
  }

  setStage(stage) {
    this.stage = stage;
    if (stage === 'key') this.menu = new HandMenu(this.game, shuffle(KEYS));
    if (stage === 'scam') {
      // A opção perigosa fica na primeira faixa (a mais perto, a mais "natural")
      this.menu = new HandMenu(this.game, ['REGULARIZAR AGORA', 'Ignorar mensagem'], { zone: 10, allowBack: true });
      this.fx.alarm();
    }
    if (stage === 'value') this.menu = new HandMenu(this.game, shuffle(VALUES).map((v) => money(v)));
    if (stage === 'confirm') this.menu = new HandMenu(this.game, ['Confirmar pagamento', 'Cancelar e voltar']);
  }

  update(dt, presses) {
    if (this.tickClock(dt)) {
      this.finish({
        win: false,
        paciencia: -15 + this.paciencia,
        flags: ['semRemedio'],
        message: 'O app "expirou a sessão por inatividade". Antônio desiste e vai embora sem o remédio.',
      });
      return;
    }
    if (this.result) return;

    const r = this.menu.update(dt, presses);
    if (this.stage === 'scam' && r && r.back) return this.setStage('value');
    if (!r || r.pick == null) return;
    const label = this.menu.options[r.pick];

    if (this.stage === 'key') {
      this.chosenKey = label;
      if (!this.scamShown) {
        this.scamShown = true;
        this.setStage('scam');
      } else this.setStage('value');
    } else if (this.stage === 'scam') {
      if (label === 'REGULARIZAR AGORA') {
        this.finish({
          win: false,
          saldo: -297,
          paciencia: -20,
          flags: ['golpe', 'semRemedio'],
          message: 'Era golpe. R$ 297 foram para um desconhecido, e o remédio continua sem pagar.',
        });
      } else {
        this.fx.success();
        this.game.toast('Boa! Banco de verdade não cobra "taxa urgente" por mensagem.');
        this.setStage('value');
      }
    } else if (this.stage === 'value') {
      this.chosenValue = VALUES.find((v) => money(v) === label);
      this.setStage('confirm');
    } else if (this.stage === 'confirm') {
      if (label === 'Cancelar e voltar') {
        this.paciencia -= 3;
        this.setStage('key');
        return;
      }
      this.resolve();
    }
  }

  resolve() {
    const keyOk = this.chosenKey === RIGHT_KEY;
    const v = this.chosenValue;
    if (!keyOk) {
      this.finish({
        win: false,
        saldo: -v,
        paciencia: -15 + this.paciencia,
        flags: ['golpe', 'semRemedio'],
        message: `A chave era falsa: ${money(v)} foram para "JOSÉ R. SILVA". O nome na tela estava errado.`,
      });
    } else if (v < RIGHT_VALUE) {
      this.finish({
        win: false,
        saldo: -v,
        paciencia: -12 + this.paciencia,
        flags: ['semRemedio'],
        message: `Pagou só ${money(v)}. A farmácia não libera o remédio, e estorno "em até 7 dias úteis".`,
      });
    } else if (v > RIGHT_VALUE) {
      this.finish({
        win: false,
        saldo: -v, // pagou a mais; a farmácia promete devolver... depois
        paciencia: -10 + this.paciencia,
        message: `Pagou ${money(v)} por um remédio de R$ 84,90! A devolução vai levar dias.`,
      });
    } else {
      this.finish({
        win: true,
        saldo: -RIGHT_VALUE,
        paciencia: this.paciencia,
        message: 'Pagamento certo, para a chave certa. O remédio está garantido!',
      });
    }
  }

  draw(g) {
    rect(g, 0, 0, W, H, '#0d1a14');
    // placa da farmácia
    rrect(g, 30, 90, 270, 170, 14, COLORS.paper, '#7a6a4a', 3);
    text(g, 'FARMÁCIA VIDA BOA', 165, 124, { size: 18, weight: 'bold', align: 'center', color: COLORS.ink });
    text(g, 'Somente PIX', 165, 152, { size: 15, align: 'center', color: COLORS.ink });
    text(g, 'Chave:', 165, 184, { size: 14, align: 'center', color: COLORS.ink });
    text(g, RIGHT_KEY, 165, 206, { size: 15, weight: 'bold', align: 'center', color: '#1a5c2e' });
    text(g, 'Remédio: R$ 84,90', 165, 240, { size: 15, align: 'center', color: COLORS.ink });
    // celular
    rrect(g, 330, 70, 460, 460, 36, '#111', '#555', 4);
    rrect(g, 346, 92, 428, 420, 20, '#f2f4f7');
    this.drawHeader(g);

    const titles = {
      key: 'Pix > Pagar > Digite ou escolha a chave',
      scam: '',
      value: 'Pix > Quanto você quer pagar?',
      confirm: 'Confira antes de pagar',
    };
    text(g, 'BancoFácil', 560, 120, { size: 16, weight: 'bold', align: 'center', color: '#6a1b9a' });
    text(g, titles[this.stage], 560, 146, { size: 14, align: 'center', color: '#333' });

    if (this.stage === 'confirm') {
      const ok = this.chosenKey === RIGHT_KEY;
      rrect(g, 366, 160, 388, 110, 12, '#fff', '#ddd', 1);
      text(g, 'Para:', 380, 186, { size: 13, color: '#666' });
      text(g, ok ? 'FARMÁCIA VIDA BOA LTDA' : 'JOSÉ R. SILVA', 380, 208, { size: 16, weight: 'bold', color: '#222' });
      text(g, `Chave: ${this.chosenKey}`, 380, 230, { size: 12, color: '#444' });
      text(g, `Valor: ${money(this.chosenValue)}`, 380, 256, { size: 16, weight: 'bold', color: '#222' });
      this.menu.draw(g, 366, 290, 388, 46, { size: 17 });
    } else if (this.stage !== 'scam') {
      this.menu.draw(g, 366, 166, 388, 50, { size: 15 });
    }

    if (this.stage === 'scam') {
      rrect(g, 352, 150, 416, 340, 16, '#b00020', '#fff', 3);
      text(g, '⚠ URGENTE — BANCO', 560, 190, { size: 22, weight: 'bold', align: 'center', color: '#fff' });
      wrap(g, 'Seu benefício do INSS será BLOQUEADO HOJE. Pague a taxa de regularização de R$ 297,00 para evitar o bloqueio.', 560, 224, 370, { size: 15, align: 'center', color: '#fff' });
      this.menu.draw(g, 372, 330, 376, 50, { size: 17 });
      text(g, 'toquinho no ar / Esc = fechar', 560, 478, { size: 12, align: 'center', color: '#ffffffcc' });
    }
    drawRuler(g, this.game, 880, 120, 380, this.menu.picker, this.menu.options.length);
  }
}
