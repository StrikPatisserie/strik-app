const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function load(file, imports, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      assert(name in imports, `Unmocked import ${name}`);
      return imports[name];
    },
    Date,
    Intl,
    Set,
    ...globals,
  });
  return exports;
}

const planning = load('app/productie/planning.ts', {});
const currentWeek = '2026-11-02';
const followingWeek = '2026-11-09';
const offers = [
  { id: 'this-week', weekStart: currentWeek, weekEnd: '2026-11-08', label: 'Appeltaart', imageUrl: '/appeltaart.png' },
  { id: 'next-week', weekStart: followingWeek, weekEnd: '2026-11-15', label: 'Notentaart', imageUrl: '/notentaart.png' },
];

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree?.props ? text(tree.props.children) : '';
}

function find(tree, predicate) {
  const node = nodes(tree).find(predicate);
  assert(node, 'Expected offer control');
  return node;
}

function harness(initialProps = {}) {
  const intervals = new Map();
  const preloaded = [];
  const opened = [];
  const managed = [];
  let now = 0;
  let timerId = 0;
  let activeRecord;
  let currentProps = {
    offers,
    week: currentWeek,
    paused: false,
    onOpen: (week, offer) => opened.push({ week, offer }),
    onManage: week => managed.push(week),
    ...initialProps,
  };
  const root = { states: [], effects: [] };
  let imageRecord;
  let imageKey;
  const sameDeps = (first, second) => first?.length === second?.length && first.every((value, index) => Object.is(value, second[index]));
  const react = {
    useState(initial) {
      const record = activeRecord;
      const index = record.stateIndex++;
      if (!(index in record.states)) record.states[index] = typeof initial === 'function' ? initial() : initial;
      return [record.states[index], value => {
        record.states[index] = typeof value === 'function' ? value(record.states[index]) : value;
      }];
    },
    useEffect(effect, dependencies) {
      const record = activeRecord;
      const index = record.effectIndex++;
      const previous = record.effects[index];
      if (!sameDeps(previous?.dependencies, dependencies)) {
        record.pending.push(() => {
          previous?.cleanup?.();
          record.effects[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const component = load('app/productie/ProductionWeekOffer.tsx', {
    react,
    'react/jsx-runtime': jsx,
    './ProductionIcon': { __esModule: true, default: () => null },
    './planning': planning,
    '../preview/productie/production.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  }, {
    window: {
      setInterval(callback, delay) {
        assert.equal(delay, 10_000);
        const id = ++timerId;
        intervals.set(id, { callback, delay, due: now + delay });
        return id;
      },
      clearInterval(id) { intervals.delete(id); },
    },
    Image: class {
      set src(value) { preloaded.push(value); }
    },
  }).default;

  function renderFunction(record, fn, props) {
    record.stateIndex = 0;
    record.effectIndex = 0;
    record.pending = [];
    activeRecord = record;
    const tree = fn(props);
    activeRecord = undefined;
    record.pending.forEach(effect => effect());
    return tree;
  }

  function render(nextProps = {}) {
    currentProps = { ...currentProps, ...nextProps };
    return renderFunction(root, component, currentProps);
  }

  function image(tree) {
    const node = find(tree, candidate => typeof candidate.type === 'function' && 'offer' in candidate.props);
    if (imageKey !== node.key) {
      imageKey = node.key;
      imageRecord = { states: [], effects: [] };
    }
    return renderFunction(imageRecord, node.type, node.props);
  }

  function advance(milliseconds) {
    const target = now + milliseconds;
    while (true) {
      const next = [...intervals.values()].sort((first, second) => first.due - second.due)[0];
      if (!next || next.due > target) break;
      now = next.due;
      next.due += next.delay;
      next.callback();
    }
    now = target;
  }

  function unmount() {
    root.effects.forEach(effect => effect.cleanup?.());
  }

  return { render, image, advance, unmount, intervals, preloaded, opened, managed };
}

test('weekly offers alternate at ten seconds and preserve their rhythm across live-data refreshes', () => {
  const h = harness();
  assert(text(h.render()).includes('Deze week'));
  assert.deepEqual(h.preloaded, ['/appeltaart.png', '/notentaart.png']);
  h.advance(9_999);
  assert(text(h.render()).includes('Deze week'));
  h.advance(1);
  assert(text(h.render()).includes('Volgende week'));
  h.advance(5_000);
  h.render({ offers: offers.map(offer => ({ ...offer })) });
  assert.equal(h.intervals.size, 1);
  assert.equal(h.preloaded.length, 2);
  h.advance(5_000);
  assert(text(h.render()).includes('Deze week'), 'A new API array must not restart the ten-second interval');
  h.unmount();
  assert.equal(h.intervals.size, 0);
});

test('an open planner dialog pauses rotation and resuming creates only one interval', () => {
  const h = harness();
  h.render();
  h.advance(9_000);
  h.render({ paused: true });
  assert.equal(h.intervals.size, 0);
  h.advance(60_000);
  assert(text(h.render()).includes('Deze week'));
  h.render({ paused: false });
  assert.equal(h.intervals.size, 1);
  h.advance(9_999);
  assert(text(h.render()).includes('Deze week'));
  h.advance(1);
  assert(text(h.render()).includes('Volgende week'));
  h.unmount();
});

test('opening and managing an offer use exactly the displayed week and offer snapshot', () => {
  const h = harness();
  h.render();
  h.advance(10_000);
  const tree = h.render();
  const image = h.image(tree);
  find(image, node => node.type === 'button').props.onClick();
  find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Aanbieding beheren').props.onClick();
  assert.equal(h.opened[0].week, followingWeek);
  assert.equal(h.opened[0].offer, offers[1]);
  assert.deepEqual(h.managed, [followingWeek]);
  h.render({ paused: true, offers: offers.map(offer => ({ ...offer, label: 'Nieuwe inhoud', imageUrl: '/nieuwe-afbeelding.png' })) });
  h.advance(30_000);
  assert.equal(h.opened[0].offer.imageUrl, '/notentaart.png');
  assert.equal(h.opened[0].offer.label, 'Notentaart');
  h.unmount();
});

test('each image waits for its own load and a missing or failed offer remains a labelled placeholder', () => {
  const h = harness({ offers: [offers[0]], onManage: undefined });
  let tree = h.render();
  let image = h.image(tree);
  assert.equal(find(image, node => node.type === 'img').props.style.visibility, 'hidden');
  assert(find(image, node => node.props?.role === 'status'));
  find(image, node => node.type === 'img').props.onLoad();
  image = h.image(h.render());
  assert.equal(find(image, node => node.type === 'img').props.style.visibility, 'visible');
  assert(!nodes(image).some(node => node.props?.role === 'status'));
  h.advance(10_000);
  tree = h.render();
  assert(text(tree).includes('Volgende week'));
  image = h.image(tree);
  assert.equal(find(image, node => node.type === 'button').props.disabled, true);
  assert(text(image).includes('Nog geen aanbieding'));
  assert(!nodes(tree).some(node => node.props?.['aria-label'] === 'Aanbieding beheren'));
  h.advance(10_000);
  image = h.image(h.render());
  assert.equal(find(image, node => node.type === 'img').props.style.visibility, 'hidden');
  find(image, node => node.type === 'img').props.onError();
  image = h.image(h.render());
  assert.equal(find(image, node => node.type === 'button').props.disabled, true);
  assert(text(image).includes('Nog geen aanbieding'));
  h.unmount();
});
