// O "cérebro" do jogo: telas, história, saldo, paciência e finais.

import { W, H, COLORS, rect, rrect, text, wrap, bar, money, cityBackdrop, drawAntonio } from './gfx.js';
import { HandMenu, drawRuler } from './handmenu.js';
import { SCENES, START_SALDO, START_PACIENCIA, pickEnding } from './story.js';
import { KioskGame } from './minigames/kiosk.js';
import { PixGame } from './minigames/pix.js';
import { QrGame } from './minigames/qr.js';
import { VoiceGame } from './minigames/voice.js';

const MINIGAMES = { kiosk: KioskGame, pix: PixGame, qr: QrGame, voice: VoiceGame };

export class Game {
  constructor(canvas, input, fx, controller) {
    this.g = canvas.getContext('2d');
    this.input = input;
    this.fx = fx;
    this.controller = controller;
    this.t = 0;
    this.toasts = [];
    this.goTitle();
  }

  // ---------------- Estado ----------------
  newRun() {
    this.state = { saldo: START_SALDO, paciencia: START_PACIENCIA, flags: new Set(), log: [] };
  }

  apply({ saldo = 0, paciencia = 0, flags = [] } = {}) {
    const s = this.state;
    s.saldo = Math.round((s.saldo + saldo) * 100) / 100;
    s.paciencia = Math.max(0, Math.min(100, s.paciencia + paciencia));
    flags.forEach((f) => s.flags.add(f));
  }

  toast(msg) {
    this.toasts.push({ msg, until: this.t + 2.8 });
  }

  // ---------------- Telas ----------------
  setScreen(name, data = {}) {
    this.screen = name;
    Object.assign(this, data);
    this.input.clear();
  }

  goTitle() {
    this.setScreen('title', { menu: new HandMenu(this, ['Jogar', 'Testar controle', 'Como jogar']) });
  }

  goScene(id) {
    const scene = SCENES[id];
    if (id === 'final' || !scene) return this.goEnding();
    this.sceneId = id;
    this.setScreen('scene', { scene, menu: new HandMenu(this, scene.choices.map((c) => c.label)) });
  }

  goResult(message, delta, next) {
    this.setScreen('result', {
      resultMsg: message,
      resultDelta: delta,
      resultNext: next,
      menu: new HandMenu(this, ['Continuar'], { zone: 40 }),
    });
  }

  goEnding() {
    const ending = pickEnding(this.state);
    this.setScreen('ending', { ending, menu: new HandMenu(this, ['Jogar de novo', 'Voltar ao menu']) });
  }

  choose(choice) {
    if (choice.minigame) {
      const mg = new MINIGAMES[choice.minigame](this);
      this.pendingNext = choice.next;
      this.setScreen('mgIntro', { minigame: mg, menu: new HandMenu(this, ['Começar!'], { zone: 40 }) });
      return;
    }
    const delta = { saldo: choice.effects?.saldo || 0, paciencia: choice.effects?.paciencia || 0, flags: choice.flags || [] };
    this.apply(delta);
    if (choice.result) this.goResult(choice.result, delta, choice.next);
    else this.goScene(choice.next);
  }

  afterResult(next) {
    if (this.state.paciencia <= 0) return this.goEnding();
    this.goScene(next);
  }

  // ---------------- Loop ----------------
  update(dt) {
    this.t += dt;
    this.toasts = this.toasts.filter((x) => x.until > this.t);
    const presses = this.input.consume();

    switch (this.screen) {
      case 'title': {
        const r = this.menu.update(dt, presses);
        if (r && r.pick === 0) { this.newRun(); this.goScene('intro'); }
        if (r && r.pick === 1) this.setScreen('test', { menu: new HandMenu(this, ['Opção 1', 'Opção 2', 'Opção 3', 'Voltar ao menu'], { allowBack: true }), testLog: [] });
        if (r && r.pick === 2) this.setScreen('howto', { menu: new HandMenu(this, ['Voltar'], { zone: 40, allowBack: true }) });
        break;
      }
      case 'howto': {
        const r = this.menu.update(dt, presses);
        if (r) this.goTitle();
        break;
      }
      case 'test': {
        const r = this.menu.update(dt, presses);
        if (presses.includes('B')) this.testLog.unshift('✋ Toquinho no ar (VOLTAR) reconhecido!');
        if (presses.includes('A')) this.testLog.unshift('Confirmar (Enter/BOOT) recebido');
        if (r && r.pick === 3) return this.goTitle();
        if (r && r.pick != null) {
          this.testLog.unshift(`Opção ${r.pick + 1} confirmada`);
          this.fx.success();
        }
        this.testLog = this.testLog.slice(0, 6);
        break;
      }
      case 'scene': {
        const r = this.menu.update(dt, presses);
        if (r && r.pick != null) this.choose(this.scene.choices[r.pick]);
        break;
      }
      case 'result': {
        const r = this.menu.update(dt, presses);
        if (r && r.pick != null) this.afterResult(this.resultNext);
        break;
      }
      case 'mgIntro': {
        const r = this.menu.update(dt, presses);
        if (r && r.pick != null) {
          this.minigame.start();
          this.setScreen('minigame');
        }
        break;
      }
      case 'minigame': {
        const mg = this.minigame;
        mg.update(dt, presses);
        if (mg.result) {
          this.apply(mg.result);
          this.goResult(mg.result.message, mg.result, this.pendingNext);
          this.resultWin = mg.result.win;
        }
        break;
      }
      case 'ending': {
        const r = this.menu.update(dt, presses);
        if (r && r.pick === 0) { this.newRun(); this.goScene('intro'); }
        if (r && r.pick === 1) this.goTitle();
        break;
      }
    }
  }

  // ---------------- Desenho ----------------
  draw() {
    const g = this.g;
    g.clearRect(0, 0, W, H);
    switch (this.screen) {
      case 'title': this.drawTitle(g); break;
      case 'howto': this.drawHowto(g); break;
      case 'test': this.drawTest(g); break;
      case 'scene': this.drawScene(g); break;
      case 'result': this.drawResult(g); break;
      case 'mgIntro': this.drawMgIntro(g); break;
      case 'minigame': this.minigame.draw(g); this.drawHud(g, true); break;
      case 'ending': this.drawEnding(g); break;
    }
    this.drawToasts(g);
  }

  drawHud(g, compact = false) {
    if (!this.state) return;
    const y = compact ? H - 34 : 14;
    rrect(g, 14, y, 330, 26, 13, '#000000aa');
    text(g, `💰 ${money(this.state.saldo)}`, 26, y + 19, { size: 15, weight: 'bold', color: COLORS.accent });
    text(g, '🧠 paciência', 168, y + 19, { size: 13, color: COLORS.text });
    const p = this.state.paciencia / 100;
    bar(g, 258, y + 7, 76, 12, p, p > 0.5 ? COLORS.good : p > 0.25 ? COLORS.accent : COLORS.bad);
  }

  drawToasts(g) {
    this.toasts.forEach((x, i) => {
      g.font = `bold 17px sans-serif`;
      const w = Math.min(W - 80, g.measureText(x.msg).width + 40);
      rrect(g, W / 2 - w / 2, H - 92 - i * 44, w, 36, 18, '#000000dd', COLORS.accent, 2);
      text(g, x.msg, W / 2, H - 68 - i * 44, { size: 16, align: 'center', weight: 'bold' });
    });
  }

  drawTitle(g) {
    cityBackdrop(g, this.t, 5);
    drawAntonio(g, 160, 400, 1.6, 0);
    text(g, 'PERDIDO', 600, 140, { size: 72, weight: 'bold', align: 'center', color: COLORS.accent });
    text(g, 'NO TEMPO', 600, 200, { size: 48, weight: 'bold', align: 'center', color: COLORS.neon1 });
    text(g, 'A jornada do Seu Antônio pela cidade do futuro', 600, 236, { size: 17, align: 'center', color: COLORS.text });
    this.menu.draw(g, 430, 270, 340, 50, { size: 20 });
    drawRuler(g, this, 880, 120, 360, this.menu.picker, this.menu.options.length);
    text(g, 'Mão parada = escolher   •   ↑ ↓ + Enter no teclado', 600, 500, { size: 14, align: 'center', color: COLORS.muted });
  }

  drawHowto(g) {
    rect(g, 0, 0, W, H, COLORS.bg);
    text(g, 'Como jogar', 60, 70, { size: 34, weight: 'bold', color: COLORS.accent });
    const lines = [
      'O controle é a sua mão na frente do sensor ultrassônico.',
      '• Cada faixa de distância é uma opção. A de cima da lista é a mais perto do sensor.',
      '• Deixe a mão parada por cerca de 1 segundo para confirmar.',
      '• Aproxime bem rápido do sensor e tire (toquinho no ar) para VOLTAR ou fechar.',
      '• O botão BOOT da placa também confirma.',
      'Sem placa? Use o teclado: ↑ ↓ escolhem, Enter confirma, Esc volta. Q/E simulam a mão.',
      'Cada escolha muda o seu SALDO e a sua PACIÊNCIA. Se a paciência zerar, o jogo acaba.',
      'Algumas fases têm controle lento de propósito: é assim que muita gente se sente com a tecnologia.',
    ];
    let y = 120;
    lines.forEach((l) => { y = wrap(g, l, 60, y, 760, { size: 18 }) + 6; });
    this.menu.draw(g, 60, 450, 260, 48);
    drawRuler(g, this, 880, 120, 360, this.menu.picker, 1);
  }

  drawTest(g) {
    rect(g, 0, 0, W, H, COLORS.bg);
    text(g, 'Testar controle', 40, 60, { size: 30, weight: 'bold', color: COLORS.accent });
    const st = this.controller.status;
    const statusText = {
      ready: `Controle conectado ${this.controller.link === 'ble' ? 'por Bluetooth' : 'pelo USB'} (${this.controller.board || '?'})`,
      opened: 'Porta aberta, esperando a placa responder...',
      connecting: 'Conectando...',
      disconnected: 'Controle desconectado: usando teclado',
      unsupported: 'Navegador sem USB/Bluetooth: usando teclado',
      error: 'Erro na conexão',
    }[st] || st;
    text(g, statusText, 40, 92, { size: 16, color: st === 'ready' ? COLORS.good : COLORS.muted });
    const cm = this.input.handCm();
    text(g, cm == null ? 'Mão: —' : `Mão: ${Math.round(cm)} cm`, 40, 140, { size: 42, weight: 'bold' });
    text(g, this.input.sensorSeen ? 'Recebendo distâncias do sensor.' : 'Nenhuma distância do sensor ainda (Q/E simulam).',
      40, 170, { size: 14, color: COLORS.muted });
    this.menu.draw(g, 40, 200, 420, 50);
    text(g, 'Eventos', 520, 210, { size: 18, color: COLORS.accent });
    this.testLog.forEach((l, i) => text(g, l, 520, 240 + i * 26, { size: 15 }));
    drawRuler(g, this, 880, 120, 380, this.menu.picker, this.menu.options.length);
  }

  drawScene(g) {
    const sc = this.scene;
    cityBackdrop(g, this.t, sc.seed);
    drawAntonio(g, 110, 430, 1.25, sc.mood);
    this.drawHud(g);
    rrect(g, 210, 52, 620, 470, 18, '#0f1226e6', '#ffffff22', 1);
    text(g, sc.place, 232, 88, { size: 24, weight: 'bold', color: COLORS.accent });
    let y = 122;
    sc.text.forEach((p) => { y = wrap(g, p, 232, y, 576, { size: 17 }) + 6; });
    this.menu.draw(g, 232, Math.max(y + 4, 300), 576, 50, { size: 17 });
    drawRuler(g, this, 880, 120, 380, this.menu.picker, this.menu.options.length);
  }

  drawResult(g) {
    cityBackdrop(g, this.t, 31);
    const d = this.resultDelta || {};
    drawAntonio(g, 120, 430, 1.3, (d.paciencia || 0) > 0 || this.resultWin ? 1 : -1);
    this.drawHud(g);
    rrect(g, 230, 90, 600, 380, 18, '#0f1226ee', COLORS.accent, 2);
    let y = wrap(g, this.resultMsg, 260, 140, 540, { size: 20 });
    y += 16;
    if (d.saldo) text(g, `Saldo: ${d.saldo > 0 ? '+' : '−'} ${money(Math.abs(d.saldo))}`, 260, y, { size: 18, color: d.saldo > 0 ? COLORS.good : COLORS.bad });
    if (d.paciencia) text(g, `Paciência: ${d.paciencia > 0 ? '+' : ''}${d.paciencia}`, 520, y, { size: 18, color: d.paciencia > 0 ? COLORS.good : COLORS.bad });
    this.menu.draw(g, 260, 390, 300, 50);
    drawRuler(g, this, 880, 120, 380, this.menu.picker, 1);
  }

  drawMgIntro(g) {
    rect(g, 0, 0, W, H, COLORS.bg);
    this.drawHud(g);
    const mg = this.minigame;
    text(g, 'MINIGAME', 60, 90, { size: 16, color: COLORS.neon2, weight: 'bold' });
    text(g, mg.title, 60, 128, { size: 34, weight: 'bold', color: COLORS.accent });
    let y = 180;
    mg.instructions.forEach((l) => { y = wrap(g, '• ' + l, 60, y, 760, { size: 19 }) + 8; });
    text(g, `Tempo: ${mg.timeLimit} s${mg.lagMs ? `   •   controle com atraso de ${mg.lagMs} ms` : ''}`, 60, y + 14, { size: 15, color: COLORS.muted });
    this.menu.draw(g, 60, 430, 300, 52, { size: 20 });
    drawRuler(g, this, 880, 120, 380, this.menu.picker, 1);
  }

  drawEnding(g) {
    const e = this.ending;
    cityBackdrop(g, this.t, 41, e.mood > 0 ? COLORS.good : COLORS.neon1);
    drawAntonio(g, 110, 440, 1.3, e.mood);
    rrect(g, 210, 30, 640, 490, 18, '#0f1226ee', COLORS.accent, 2);
    text(g, 'FINAL', 236, 66, { size: 15, weight: 'bold', color: COLORS.neon2 });
    text(g, e.title, 236, 102, { size: 32, weight: 'bold', color: COLORS.accent });
    let y = 140;
    e.text.forEach((p) => { y = wrap(g, p, 236, y, 590, { size: 17 }) + 6; });
    if (this.state.flags.has('semRemedio') && e.id !== 'perdido') {
      y = wrap(g, 'E o remédio da pressão? Ficou para amanhã.', 236, y, 590, { size: 15, color: COLORS.muted }) + 4;
    }
    y = wrap(g, '💭 ' + e.reflection, 236, y + 6, 590, { size: 16, color: COLORS.neon1 }) + 4;
    text(g, `Saldo final: ${money(this.state.saldo)}   •   Paciência: ${this.state.paciencia}`, 236, y + 8, { size: 16, color: COLORS.text });
    this.menu.draw(g, 236, 410, 300, 46, { size: 18 });
    drawRuler(g, this, 880, 120, 380, this.menu.picker, this.menu.options.length);
  }
}
