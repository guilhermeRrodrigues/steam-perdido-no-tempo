import { W, H, COLORS, rect, rrect, text, wrap } from '../gfx.js';
import { HandMenu, drawRuler } from '../handmenu.js';
import { Minigame, shuffle } from './base.js';

// Minigame 4: a assistente de voz AURA, na portaria.
// Antônio fala do jeito dele, mas a AURA só entende frases "no formato certo".
// Em cada rodada, escolha a frase que a máquina entende. Errar faz ela entender tudo torto.

const ROUNDS = [
  {
    aura: 'Olá! Eu sou a AURA. Como posso ajudar?',
    right: 'Abrir portaria.',
    wrong: [
      ['Ô moça, abre aí pra mim, faz favor', 'Entendi: "abrir app de música". Tocando Moça Bonita.'],
      ['Quero falar com uma pessoa!', 'Atendimento humano disponível em dias úteis, das 9h às 9h05.'],
      ['Cadê o porteiro, menina?', 'Desculpe, "Cadê o Porteiro" não está na sua lista de contatos.'],
    ],
  },
  {
    aura: 'Para qual apartamento?',
    right: 'Apartamento oitocentos e dois.',
    wrong: [
      ['É da minha neta, a Júlia', 'Não encontrei o apartamento "Minha Neta". Tente novamente.'],
      ['O de cima, perto da escada', 'Escadas são acessadas pelo bloco B. Posso ajudar com mais algo?'],
      ['Oito... zero... dois... é isso?', 'Entendi: apartamento "zero doze". Esse apartamento não existe.'],
    ],
  },
  {
    aura: 'Confirme sua identidade: diga seu nome completo.',
    right: 'Antônio Ferreira da Silva.',
    wrong: [
      ['Antônio', 'Há 14 Antônios cadastrados. Diga o nome completo.'],
      ['Sou eu, uai!', 'Entendi: "Suéu Wai". Usuário não reconhecido.'],
      ['A Júlia me conhece!', 'Para segurança, não posso confirmar terceiros.'],
    ],
  },
];
const MAX_WRONG = 4;

export class VoiceGame extends Minigame {
  constructor(game) {
    super(game, {
      title: 'Assistente de voz AURA',
      instructions: [
        'A AURA só entende frases curtas e "no formato dela".',
        'Escolha a frase com a mão (cada distância é uma frase) e deixe parada para falar.',
        'Cada erro faz a AURA entender tudo errado e gasta paciência.',
      ],
      timeLimit: 50,
      lagMs: 300,
    });
    this.round = 0;
    this.wrong = 0;
    this.reply = null;
    this.replyTime = 0;
    this.listening = 0;
    this.buildMenu();
  }

  buildMenu() {
    const r = ROUNDS[this.round];
    this.menu = new HandMenu(this.game, shuffle([r.right, ...r.wrong.map((w) => w[0])]));
  }

  update(dt, presses) {
    if (this.tickClock(dt)) {
      this.finish({
        win: false,
        paciencia: -20,
        message: 'A AURA desliga: "Tempo esgotado. Tente mais tarde." Antônio espera alguém abrir a porta.',
      });
      return;
    }
    if (this.result) return;
    this.listening = Math.max(0, this.listening - dt);
    if (this.listening > 0) return; // AURA "processando"

    const res = this.menu.update(dt, presses);
    if (!res || res.pick == null) return;
    const said = this.menu.options[res.pick];
    const round = ROUNDS[this.round];
    this.listening = 1.0;
    if (said === round.right) {
      this.reply = { ok: true, text: 'Entendido.' };
      this.fx.success();
      this.round++;
      if (this.round >= ROUNDS.length) {
        this.finish({
          win: true,
          paciencia: 5 - this.wrong * 6,
          message: this.wrong === 0
            ? 'A porta abre na primeira tentativa! "Bem-vindo, Antônio Ferreira da Silva."'
            : `A porta abre, depois de ${this.wrong} mal-entendido(s). "Bem-vindo, Antônio."`,
        });
        return;
      }
    } else {
      this.wrong++;
      const w = round.wrong.find((x) => x[0] === said);
      this.reply = { ok: false, text: w ? w[1] : 'Desculpe, não entendi.' };
      this.fx.error();
      if (this.wrong >= MAX_WRONG) {
        this.finish({
          win: false,
          paciencia: -22,
          message: 'AURA: "Transferindo para atendimento humano. Tempo de espera estimado: 47 minutos."',
        });
        return;
      }
    }
    this.buildMenu();
  }

  draw(g) {
    rect(g, 0, 0, W, H, '#10131f');
    this.drawHeader(g);
    // alto-falante da AURA
    const pulse = 1 + 0.08 * Math.sin(this.t * (this.listening > 0 ? 18 : 3));
    g.beginPath();
    g.arc(150, 230, 70 * pulse, 0, Math.PI * 2);
    g.fillStyle = '#4de1ff22';
    g.fill();
    g.beginPath();
    g.arc(150, 230, 46, 0, Math.PI * 2);
    g.fillStyle = this.listening > 0 ? COLORS.neon2 : COLORS.neon1;
    g.fill();
    text(g, 'AURA', 150, 237, { size: 18, weight: 'bold', align: 'center', color: '#001018' });

    const r = ROUNDS[Math.min(this.round, ROUNDS.length - 1)];
    rrect(g, 250, 80, 560, 70, 16, '#1b2440', COLORS.neon1, 2);
    wrap(g, '“' + r.aura + '”', 270, 112, 520, { size: 19, color: COLORS.text });
    text(g, `Rodada ${Math.min(this.round + 1, ROUNDS.length)} de ${ROUNDS.length}   •   mal-entendidos: ${this.wrong}/${MAX_WRONG}`,
      270, 142, { size: 13, color: COLORS.muted });

    if (this.reply) {
      rrect(g, 40, 330, 210, 150, 14, this.reply.ok ? '#123a26' : '#3a1220', this.reply.ok ? COLORS.good : COLORS.bad, 2);
      wrap(g, this.reply.text, 52, 356, 186, { size: 14, color: COLORS.text });
    }

    text(g, this.listening > 0 ? 'AURA está processando...' : 'Antônio diz:', 270, 186, { size: 16, color: COLORS.accent });
    this.menu.draw(g, 270, 200, 540, 54, { size: 17 });
    drawRuler(g, this.game, 880, 120, 380, this.menu.picker, this.menu.options.length);
  }
}
