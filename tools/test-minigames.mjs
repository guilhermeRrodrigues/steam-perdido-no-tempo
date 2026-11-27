// Testes dos desafios com a mão (sem tela): simula a mão e confere se dá para ganhar e perder.
// Rode com: npm test
import assert from 'node:assert/strict';
import { SCENES } from '../js/story.js';
import { MINIGAMES } from '../js/game.js';
import { BagsGame, laneFor, GRAB_X } from '../js/minigames/bags.js';
import { PumpGame, NEAR_CM, FAR_CM } from '../js/minigames/pump.js';
import { CrossGame, targetFor, LANES, HAND_FROM, HAND_TO } from '../js/minigames/cross.js';

// Sorteio previsível: cada partida usa uma semente, e o teste dá sempre o mesmo resultado.
let seed = 1;
Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

function fakeGame() {
  const fx = new Proxy({}, { get: () => () => {} });
  const input = {
    cm: null,
    held: { UP: false, DOWN: false },
    handCm() { return this.cm; },
    nudgeHand(d) { this.cm = Math.max(3, Math.min(60, (this.cm ?? 20) + d)); },
    setLag() {}, clear() {},
  };
  return { input, fx, toasts: [], toast(m) { this.toasts.push(m); } };
}

/** Roda o minigame até terminar (ou maxS segundos). handFn(mg, t) devolve a distância da mão. */
function run(MG, handFn, maxS = 120, s = 7) {
  seed = s;
  const game = fakeGame();
  const mg = new MG(game);
  mg.start();
  const dt = 1 / 30;
  for (let t = 0; t < maxS && !mg.result; t += dt) {
    game.input.cm = handFn(mg, t);
    mg.update(dt, []);
  }
  return { mg, game };
}

const LANE_CM = [10, 20, 30];

test('história: toda cena leva a uma cena que existe, e todo minigame existe', () => {
  for (const [id, sc] of Object.entries(SCENES)) {
    for (const c of sc.choices) {
      assert.ok(c.next === 'final' || SCENES[c.next], `${id} -> ${c.next}`);
      if (c.minigame) assert.ok(MINIGAMES[c.minigame], `minigame ${c.minigame}`);
    }
    assert.ok(sc.choices.some((c) => !c.unlessFlag), `${id} precisa de uma escolha sempre disponível`);
  }
});

test('história: os 3 desafios novos estão no caminho', () => {
  const used = Object.values(SCENES).flatMap((s) => s.choices.map((c) => c.minigame)).filter(Boolean);
  for (const k of ['bags', 'pump', 'cross']) assert.ok(used.includes(k), k);
});

test('esteira: trilho pela distância da mão', () => {
  assert.equal(laneFor(null), -1);
  assert.deepEqual(LANE_CM.map(laneFor), [0, 1, 2]);
});

test('esteira: seguindo só as coisas do Antônio, ganha', () => {
  for (let i = 1; i <= 15; i++) {
    const { mg } = run(BagsGame, (mg) => {
      // vai para o trilho do próximo item dele; se não houver, fica no trilho sem mala chegando
      const coming = mg.items.filter((i) => i.x > GRAB_X).sort((a, b) => a.x - b.x);
      const mine = coming.find((i) => i.id && !mg.got.has(i.id));
      if (mine && (!coming[0].id || coming[0] === mine || coming[0].lane !== mine.lane)) {
        if (coming[0] !== mine && coming[0].lane === mine.lane) return null;
        if (coming[0] !== mine && coming[0].x - GRAB_X < 40) {
          const free = [0, 1, 2].find((l) => l !== coming[0].lane);
          return LANE_CM[free];
        }
        return LANE_CM[mine.lane];
      }
      const busy = new Set(coming.filter((i) => i.x - GRAB_X < 120).map((i) => i.lane));
      const free = [0, 1, 2].find((l) => !busy.has(l));
      return free == null ? null : LANE_CM[free];
    }, 120, i);
    assert.ok(mg.result, 'terminou');
    assert.equal(mg.result.win, true, mg.result.message);
  }
});

test('esteira: mão parada num trilho pega mala errada e perde paciência', () => {
  const { mg } = run(BagsGame, () => 20);
  assert.ok(mg.result);
  assert.ok(mg.wrong > 0);
  assert.ok(mg.result.paciencia < 4);
});

test('esteira: sem mão, o tempo acaba e perde', () => {
  const { mg } = run(BagsGame, () => null);
  assert.equal(mg.result.win, false);
});

test('manivela: ir e voltar enche a bateria e ganha', () => {
  // uma ida a cada 1,2 s (bem devagar)
  const { mg } = run(PumpGame, (mg, t) => (Math.floor(t / 1.2) % 2 ? FAR_CM + 3 : NEAR_CM - 3));
  assert.equal(mg.result.win, true, mg.result.message);
  assert.ok(mg.strokes >= 14);
});

test('manivela: mexer pouquinho (sem ir de perto até longe) não conta', () => {
  const { mg } = run(PumpGame, (mg, t) => 19 + 4 * Math.sin(t * 4));
  assert.equal(mg.strokes, 0);
  assert.equal(mg.result.win, false);
  assert.ok(mg.result.flags.includes('semBateria'));
});

test('atravessar: posição pela distância da mão', () => {
  assert.equal(targetFor(HAND_FROM), 0);
  assert.equal(targetFor(HAND_TO), 1);
  assert.equal(targetFor(null), null);
});

test('atravessar: mão longe direto leva susto quando a pista tem patinete', () => {
  let bumps = 0, wins = 0;
  for (let i = 0; i < 20; i++) {
    const { mg } = run(CrossGame, () => 34, 120, i + 1);
    bumps += mg.bumps;
    if (mg.result.win) wins++;
  }
  assert.ok(bumps > 0, 'correr sem olhar deveria dar susto às vezes');
  assert.ok(wins > 0, 'mas ainda dá para chegar');
});

test('atravessar: esperando o aviso apagar, chega sem susto', () => {
  const cmFor = (p) => HAND_FROM + p * (HAND_TO - HAND_FROM);
  const safeStops = [0.1, 0.5, 1]; // calçada, canteiro, chegada
  for (let i = 0; i < 20; i++) {
    const { mg } = run(CrossGame, (mg) => {
      const here = safeStops.findLast((s) => mg.pos >= s - 0.02) ?? 0;
      const next = safeStops[safeStops.indexOf(here) + 1] ?? 1;
      const lane = LANES.findIndex((l) => l.from > mg.pos - 0.02 && l.to <= next + 0.01);
      const danger = mg.events.some((e) => e.lane === lane);
      const inLane = LANES.some((l) => mg.pos > l.from && mg.pos < l.to);
      return cmFor(danger && !inLane ? here : next);
    }, 120, i + 1);
    assert.equal(mg.result.win, true, mg.result.message);
    assert.equal(mg.bumps, 0);
  }
});

console.log(`\n${passed} testes dos desafios passaram.`);
