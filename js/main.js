// Ponto de entrada: liga o controle, o teclado, o jogo e a barra de conexão.

import { Controller, serialSupported, bleSupported } from './serial.js';
import { Input } from './input.js';
import { Feedback } from './feedback.js';
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const controller = new Controller();
const input = new Input(controller);
const fx = new Feedback(controller);
const game = new Game(canvas, input, fx, controller);

// ---------- Barra de conexão ----------
const statusEl = $('status');
const btnConnect = $('btn-connect');
const btnAll = $('btn-connect-all');
const btnBle = $('btn-ble');
const hint = $('hint');

function showHint(msg) {
  hint.textContent = msg || '';
  hint.hidden = !msg;
}

controller.addEventListener('status', (e) => {
  const { status, detail, board, link } = e.detail;
  const via = link === 'ble' ? ' por Bluetooth' : link === 'usb' ? ' pelo USB' : '';
  const map = {
    ready: ['pill-on', `Controle conectado${via}`],
    opened: ['pill-wait', 'Porta aberta, esperando a placa...'],
    connecting: ['pill-wait', 'Conectando...'],
    disconnected: ['pill-off', 'Controle: desconectado (teclado ativo)'],
    error: ['pill-err', 'Erro na conexão'],
    unsupported: ['pill-off', 'Sem USB/Bluetooth: só teclado'],
  };
  const [cls, label] = map[status] || ['pill-off', status];
  statusEl.className = 'pill ' + cls;
  statusEl.textContent = label;
  const on = status === 'ready' || status === 'opened' || status === 'connecting';
  btnConnect.hidden = on || !serialSupported();
  btnAll.hidden = on || !serialSupported();
  btnBle.hidden = on || !bleSupported();
  showHint(status === 'ready' ? '' : detail);
  if (status === 'ready') {
    fx.success();
    game.toast('Controle conectado! Coloque a mão na frente do sensor.');
  }
  if (status === 'disconnected' && detail && detail.includes('USB')) game.toast('Controle desligado. Teclado ativo.');
});

btnConnect.addEventListener('click', () => controller.requestAndConnect(false));
btnAll.addEventListener('click', () => controller.requestAndConnect(true));
btnBle.addEventListener('click', () => controller.requestBle());

const btnSound = $('btn-sound');
btnSound.addEventListener('click', () => {
  fx.muted = !fx.muted;
  btnSound.textContent = fx.muted ? '🔇' : '🔊';
});

if (!serialSupported()) {
  btnConnect.hidden = true;
  btnAll.hidden = true;
}
if (!bleSupported()) btnBle.hidden = true;
if (!serialSupported() && !bleSupported()) {
  $('warn').hidden = false;
  statusEl.textContent = 'Sem USB/Bluetooth no navegador: só teclado';
}
controller.init();

// Para o teclado funcionar sem precisar clicar no jogo
canvas.focus();

// ---------- Loop do jogo ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // limita para não "pular" se a aba ficar parada
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Ajuda para depurar no console do navegador (F12)
window.perdido = { game, controller, input };
