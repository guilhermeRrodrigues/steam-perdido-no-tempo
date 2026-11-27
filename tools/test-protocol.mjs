// Testes do protocolo e da lógica da mão. Rode com: npm test
import assert from 'node:assert/strict';
import { LineSplitter, parseLine, cmd, TapDetector, HandPicker, HandFilter, HAND, FILTER, zoneFor } from '../js/protocol.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('quebra linhas mesmo chegando em pedaços', () => {
  const s = new LineSplitter();
  assert.deepEqual(s.push('DI'), []);
  assert.deepEqual(s.push('ST:12\r\nDIST:1'), ['DIST:12']);
  assert.deepEqual(s.push('3\nBTN:A:1\n'), ['DIST:13', 'BTN:A:1']);
});

test('ignora lixo do boot do ESP32', () => {
  const s = new LineSplitter();
  const lines = s.push('ets Jun  8 2016 00:22:57\r\nrst:0x1 (POWERON_RESET)\r\n\x00\xff\nHELLO:PERDIDO:2:ESP32\n');
  const parsed = lines.map(parseLine);
  assert.equal(parsed.at(-1).type, 'hello');
  assert.equal(parsed.at(-1).board, 'ESP32');
  assert.ok(parsed.slice(0, -1).every((p) => p.type === 'unknown'));
});

test('Bluetooth: linha dividida em pedaços de 20 bytes é remontada', () => {
  const s = new LineSplitter();
  const msg = 'HELLO:PERDIDO:2:ESP32\nDIST:17\n';
  const out = [];
  for (let i = 0; i < msg.length; i += 20) out.push(...s.push(msg.slice(i, i + 20)));
  assert.deepEqual(out, ['HELLO:PERDIDO:2:ESP32', 'DIST:17']);
});

test('interpreta mensagens da placa', () => {
  assert.deepEqual(parseLine('DIST:23'), { type: 'dist', cm: 23 });
  assert.deepEqual(parseLine('DIST:-1'), { type: 'dist', cm: null });
  assert.deepEqual(parseLine('BTN:A:1'), { type: 'btn', button: 'A', pressed: true });
  assert.deepEqual(parseLine('BTN:A:0'), { type: 'btn', button: 'A', pressed: false });
  assert.equal(parseLine('PONG').type, 'pong');
  assert.deepEqual(parseLine('OK:DELAY:300'), { type: 'ok', command: 'DELAY', value: '300' });
  assert.equal(parseLine('ERR:XYZ').type, 'err');
  assert.equal(parseLine('DIST:abc').type, 'unknown');
  assert.equal(parseLine('BTN:Z:1').type, 'unknown');
});

test('monta comandos com limites', () => {
  assert.equal(cmd.delay(500), 'DELAY:500\n');
  assert.equal(cmd.delay(99999), 'DELAY:3000\n');
  assert.equal(cmd.delay(-5), 'DELAY:0\n');
  assert.equal(cmd.sonar(true), 'SONAR:1\n');
  assert.equal(cmd.led(false), 'LED:0\n');
  assert.equal(cmd.blink(50), 'BLINK:10\n');
});

test('toquinho rápido no ar = voltar', () => {
  const t = new TapDetector();
  assert.equal(t.feed(0, 25), false);
  assert.equal(t.feed(100, 5), false);
  assert.equal(t.feed(400, 20), true);
});

test('mão parada perto do sensor NÃO é toquinho', () => {
  const t = new TapDetector();
  t.feed(0, 5);
  assert.equal(t.feed(1500, 25), false);
});

test('zonas de distância viram opções', () => {
  const p = new HandPicker();
  assert.equal(p.zoneOf(null, 3), -1);
  assert.equal(p.zoneOf(5, 3), -1);
  assert.equal(p.zoneOf(HAND.NEAR, 3), 0);
  assert.equal(p.zoneOf(HAND.NEAR + HAND.ZONE, 3), 1);
  assert.equal(p.zoneOf(HAND.NEAR + 3 * HAND.ZONE, 3), -1);
});

test('mão parada ~1,3 s confirma uma vez só', () => {
  const p = new HandPicker();
  const cm = HAND.NEAR + HAND.ZONE + 2; // opção 1
  let picked = [];
  for (let t = 0; t < 3000; t += 50) {
    const r = p.update(50, cm, 3);
    if (r >= 0) picked.push([t, r]);
  }
  assert.equal(picked.length, 1);
  assert.equal(picked[0][1], 1);
  assert.ok(picked[0][0] >= HAND.DWELL - 100);
});

test('ao abrir um menu com a mão já numa opção, não confirma sem mexer', () => {
  const p = new HandPicker();
  const cm = HAND.NEAR + 2;
  p.reset(cm, 3);
  for (let t = 0; t < 3000; t += 50) assert.equal(p.update(50, cm, 3), -1);
  // mexeu para outra opção: agora confirma
  let got = -1;
  for (let t = 0; t < 2000 && got < 0; t += 50) got = p.update(50, cm + HAND.ZONE, 3);
  assert.equal(got, 1);
});

test('menu de uma opção grande: mexer a mão 6 cm já libera a confirmação', () => {
  const p = new HandPicker({ zone: 40 });
  p.reset(12, 1);
  for (let t = 0; t < 2000; t += 50) assert.equal(p.update(50, 12, 1), -1);
  let got = -1;
  for (let t = 0; t < 2000 && got < 0; t += 50) got = p.update(50, 30, 1);
  assert.equal(got, 0);
});

test('filtro: leitura maluca isolada não aparece', () => {
  const f = new HandFilter();
  const seq = [20, 21, 20, 70, 20, 21, 3, 20];
  const out = seq.map((cm, i) => f.feed(i * 60, cm));
  for (const v of out) assert.ok(v >= 19 && v <= 22, `saiu ${v}`);
});

test('filtro: eco que some por um instante não vira "sem mão"', () => {
  const f = new HandFilter();
  f.feed(0, 18); f.feed(60, 18);
  assert.equal(f.feed(120, null), 18);
  assert.equal(f.value(120 + FILTER.HOLD_MS - 20), 18);
  assert.equal(f.feed(400, 18), 18);
});

test('filtro: tirar a mão de verdade vira "sem mão" depois de um instante', () => {
  const f = new HandFilter();
  f.feed(0, 18);
  f.feed(60, null);
  assert.equal(f.value(60 + FILTER.HOLD_MS), null);
  // a mão volta em outro lugar: vale na hora, sem esperar confirmação de salto
  assert.equal(f.feed(1000, 30), 30);
});

test('filtro: mudança de lugar de verdade é aceita (confirmada ou por tempo)', () => {
  const f = new HandFilter();
  f.feed(0, 10); f.feed(60, 10);
  f.feed(120, 30);
  assert.ok(f.value(120) < 15);
  assert.equal(f.feed(180, 30), 30);          // segunda leitura confirma
  const g = new HandFilter();
  g.feed(0, 10);
  g.feed(60, 30);                              // firmware manda só quando muda: não vem segunda leitura
  assert.equal(g.value(60 + FILTER.CONFIRM_MS), 30);
});

test('filtro: tremor de 1-2 cm fica suave', () => {
  const f = new HandFilter();
  let min = 99, max = 0;
  for (let i = 0; i < 40; i++) {
    const v = f.feed(i * 60, 20 + [0, 1, -1, 2, -2, 1][i % 6]);
    if (i > 5) { min = Math.min(min, v); max = Math.max(max, v); }
  }
  assert.ok(max - min <= 2, `variou ${max - min} cm`);
});

test('faixas cabem entre 7 e ~35 cm e ficam largas com poucas opções', () => {
  for (let n = 1; n <= 4; n++) assert.ok(HAND.NEAR + n * zoneFor(n) <= 36, `n=${n}`);
  assert.equal(zoneFor(2), HAND.ZONE_MAX);
  assert.ok(zoneFor(4) >= HAND.ZONE_MIN);
});

test('histerese: mão tremendo na divisa não troca de opção', () => {
  const p = new HandPicker({ zone: 8 });
  const border = HAND.NEAR + 8; // divisa entre opção 0 e 1
  let picked = -1;
  for (let t = 0; t < 3000 && picked < 0; t += 50) {
    const cm = border - 1 + (t / 50 % 2) * 1.8; // 1 cm antes da divisa e 0,8 cm depois
    picked = p.update(50, cm, 3);
    assert.equal(p.index, 0);
  }
  assert.equal(picked, 0);
  // passou bem da divisa: troca
  p.update(50, border + 3, 3);
  assert.equal(p.index, 1);
});

console.log(`\n${passed} testes passaram.`);
