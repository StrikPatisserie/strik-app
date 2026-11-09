const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync('app/productie/usePhysicalKeyboard.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const preferenceKey = 'strik-production-physical-keyboard-v1';

class Element {
  constructor(tagName, attributes = {}, value = '') {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.value = value;
    this.children = [];
    this.writes = [];
  }

  get type() {
    return (this.getAttribute('type') || 'text').toLowerCase();
  }

  getAttribute(name) {
    return this.attributes.get(name.toLowerCase()) ?? null;
  }

  setAttribute(name, value) {
    this.writes.push([name, String(value)]);
    this.attributes.set(name.toLowerCase(), String(value));
  }

  removeAttribute(name) {
    this.writes.push([name, null]);
    this.attributes.delete(name.toLowerCase());
  }

  append(...elements) {
    this.children.push(...elements);
  }

  querySelectorAll(selector) {
    const selectors = selector.split(',').map(part => part.trim());
    const matches = element => selectors.some(part => {
      if (part === 'input' || part === 'textarea') return element.tagName === part.toUpperCase();
      const attribute = part.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      assert(attribute, `Unsupported test selector ${part}`);
      const value = element.getAttribute(attribute[1]);
      return attribute[2] === undefined ? value !== null : value === attribute[2];
    });
    const descendants = element => element.children.flatMap(child => [child, ...descendants(child)]);
    return descendants(this).filter(matches);
  }
}

function browserStorage(initial = {}) {
  return {
    values: new Map(Object.entries(initial)),
    reads: [],
    writes: [],
    throwRead: false,
    throwWrite: false,
    getItem(key) {
      this.reads.push(key);
      if (this.throwRead) throw Error('Storage is unavailable');
      return this.values.get(key) ?? null;
    },
    setItem(key, value) {
      this.writes.push([key, value]);
      if (this.throwWrite) throw Error('Storage is unavailable');
      this.values.set(key, value);
    },
  };
}

function harness({ root = new Element('div'), storage = browserStorage() } = {}) {
  const slots = [];
  const observers = [];
  const rootRef = { current: root };
  let index = 0;
  let dirty = false;
  let pendingEffects = [];
  let result;
  const sameDependencies = (previous, next) => previous?.length === next?.length
    && previous.every((value, i) => Object.is(value, next[i]));
  const react = {
    useState(initial) {
      const slotIndex = index++;
      if (!(slotIndex in slots)) {
        const state = { value: typeof initial === 'function' ? initial() : initial };
        state.set = update => {
          const value = typeof update === 'function' ? update(state.value) : update;
          if (!Object.is(value, state.value)) {
            state.value = value;
            dirty = true;
          }
        };
        slots[slotIndex] = state;
      }
      return [slots[slotIndex].value, slots[slotIndex].set];
    },
    useEffect(effect, dependencies) {
      const slotIndex = index++;
      const slot = slots[slotIndex] ?? { dependencies: undefined, cleanup: undefined };
      slots[slotIndex] = slot;
      if (sameDependencies(slot.dependencies, dependencies)) return;
      slot.dependencies = dependencies;
      pendingEffects.push(() => {
        slot.cleanup?.();
        slot.cleanup = effect();
      });
    },
  };
  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.connected = false;
      observers.push(this);
    }

    observe(target, options) {
      this.target = target;
      this.options = options;
      this.connected = true;
    }

    disconnect() {
      this.connected = false;
    }

    deliver() {
      if (this.connected) this.callback([{ type: 'childList', target: this.target }], this);
    }
  }
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      assert.equal(name, 'react');
      return react;
    },
    localStorage: storage,
    MutationObserver,
  });
  function render() {
    let passes = 0;
    do {
      assert(++passes < 20, 'Hook effects must settle');
      dirty = false;
      index = 0;
      pendingEffects = [];
      result = exports.default(rootRef);
      for (const runEffect of pendingEffects) runEffect();
    } while (dirty);
    return result;
  }
  return {
    key: exports.PHYSICAL_KEYBOARD_KEY,
    root,
    rootRef,
    storage,
    observers,
    render,
    toggle(value) {
      result.setPhysicalKeyboard(value);
      return render();
    },
    mutate() {
      for (const observer of observers) observer.deliver();
    },
    unmount() {
      for (const slot of slots) slot.cleanup?.();
    },
  };
}

function hints(element) {
  return [element.getAttribute('inputmode'), element.getAttribute('virtualkeyboardpolicy')];
}

test('the preference uses a stable browser-local key and hydrates before writing', () => {
  const firstStorage = browserStorage({ [preferenceKey]: 'true', unrelated: 'leave me' });
  const first = harness({ storage: firstStorage });
  assert.equal(first.key, preferenceKey);
  assert.equal(first.render().physicalKeyboard, true);
  assert.deepEqual(firstStorage.reads, [preferenceKey]);
  assert.deepEqual(firstStorage.writes, [[preferenceKey, 'true']]);
  assert.equal(firstStorage.values.get('unrelated'), 'leave me');

  const second = harness();
  assert.equal(second.render().physicalKeyboard, false);
  first.toggle(false);
  second.toggle(true);
  assert.equal(firstStorage.values.get(preferenceKey), 'false');
  assert.equal(second.storage.values.get(preferenceKey), 'true');
  const reloaded = harness({ storage: firstStorage });
  assert.equal(reloaded.render().physicalKeyboard, false);
  first.unmount();
  second.unmount();
  reloaded.unmount();
});

test('only text-entry fields receive keyboard hints while input types and values stay intact', () => {
  const included = [
    new Element('input', {}, 'Default text'),
    ...['text', 'number', 'search', 'email', 'tel', 'url', 'password'].map(type => new Element('input', { type }, `value-${type}`)),
    new Element('textarea', {}, 'Instructions'),
    new Element('div', { contenteditable: 'true' }, 'Editable content'),
  ];
  const excluded = [
    ...['checkbox', 'radio', 'date', 'datetime-local', 'time', 'month', 'week', 'file', 'button', 'submit', 'reset', 'hidden', 'range', 'color', 'image'].map(type => new Element('input', { type, inputmode: 'original', virtualkeyboardpolicy: 'auto' }, `value-${type}`)),
    new Element('div', { contenteditable: 'false' }),
    new Element('select'),
  ];
  const root = new Element('div');
  root.append(...included, ...excluded);
  const original = [...included, ...excluded].map(element => ({ element, type: element.type, typeAttribute: element.getAttribute('type'), value: element.value, hints: hints(element) }));
  const h = harness({ root, storage: browserStorage({ [preferenceKey]: 'true' }) });
  h.render();
  for (const element of included) assert.deepEqual(hints(element), ['none', 'manual']);
  for (const element of excluded) assert.equal(element.writes.length, 0, `${element.tagName} ${element.type} must retain its browser behavior`);
  for (const { element, type, typeAttribute, value } of original) {
    assert.equal(element.type, type);
    assert.equal(element.getAttribute('type'), typeAttribute);
    assert.equal(element.value, value);
    assert(element.writes.every(([name]) => name === 'inputmode' || name === 'virtualkeyboardpolicy'));
  }
  h.unmount();
  for (const entry of original) assert.deepEqual(hints(entry.element), entry.hints);
});

test('the observer prepares future nested fields and restores removed fields on disabling', () => {
  const h = harness({ storage: browserStorage({ [preferenceKey]: 'true' }) });
  h.render();
  assert.equal(h.observers.length, 1);
  const observer = h.observers[0];
  assert.equal(observer.target, h.root);
  assert.deepEqual({ ...observer.options }, { childList: true, subtree: true });

  const nested = new Element('div');
  const input = new Element('input', { type: 'number', inputmode: 'decimal', virtualkeyboardpolicy: 'auto' }, '2.5');
  const textarea = new Element('textarea');
  const editable = new Element('div', { contenteditable: 'true' });
  const date = new Element('input', { type: 'date' }, '2026-11-09');
  nested.append(input, textarea, editable, date);
  h.root.append(nested);
  h.mutate();
  for (const element of [input, textarea, editable]) assert.deepEqual(hints(element), ['none', 'manual']);
  assert.deepEqual(hints(date), [null, null]);
  h.mutate();
  assert.equal(input.writes.length, 2, 'repeated scans must retain the first original values');

  nested.children = nested.children.filter(element => element !== input);
  h.mutate();
  assert.equal(h.toggle(false).physicalKeyboard, false);
  assert.equal(observer.connected, false);
  assert.deepEqual(hints(input), ['decimal', 'auto']);
  assert.deepEqual(hints(textarea), [null, null]);
  const later = new Element('input', { type: 'search' });
  h.root.append(later);
  h.mutate();
  assert.deepEqual(hints(later), [null, null]);
  h.unmount();
});

test('toggling off and unmounting restore absent, empty and explicit original attributes', () => {
  const elements = [
    new Element('input', { type: 'number' }, '3'),
    new Element('textarea', { inputmode: '', virtualkeyboardpolicy: '' }, 'Method'),
    new Element('input', { type: 'search', inputmode: 'search', virtualkeyboardpolicy: 'auto' }, 'Recipe'),
  ];
  const root = new Element('div');
  root.append(...elements);
  const original = elements.map(hints);
  const h = harness({ root, storage: browserStorage({ [preferenceKey]: 'true' }) });
  h.render();
  h.toggle(false);
  elements.forEach((element, index) => assert.deepEqual(hints(element), original[index]));
  elements[0].setAttribute('inputmode', 'decimal');
  elements[0].setAttribute('virtualkeyboardpolicy', 'manual');
  const changedOriginals = elements.map(hints);
  h.toggle(true);
  elements[0].value = '7.25';
  elements[1].value = 'Updated with a physical keyboard';
  h.unmount();
  elements.forEach((element, index) => assert.deepEqual(hints(element), changedOriginals[index]));
  assert.equal(elements[0].type, 'number');
  assert.equal(elements[0].value, '7.25');
  assert.equal(elements[1].value, 'Updated with a physical keyboard');
  assert(h.observers.every(observer => !observer.connected));
});

test('disabled mode leaves fields untouched and creates no observer', () => {
  const input = new Element('input', { type: 'text', inputmode: 'text' }, 'Keep typing');
  const root = new Element('div');
  root.append(input);
  const h = harness({ root });
  assert.equal(h.render().physicalKeyboard, false);
  assert.equal(h.observers.length, 0);
  assert.deepEqual(hints(input), ['text', null]);
  assert.deepEqual(input.writes, []);
  h.unmount();
});

test('unavailable browser storage is caught and a later successful write clears the error', () => {
  const storage = browserStorage();
  storage.throwRead = true;
  storage.throwWrite = true;
  const h = harness({ storage });
  let state;
  assert.doesNotThrow(() => { state = h.render(); });
  assert.equal(state.physicalKeyboard, false);
  assert.equal(state.storageError, true);
  assert.doesNotThrow(() => { state = h.toggle(true); });
  assert.equal(state.physicalKeyboard, true);
  assert.equal(state.storageError, true);
  storage.throwWrite = false;
  state = h.toggle(false);
  assert.equal(state.storageError, false);
  assert.equal(storage.values.get(preferenceKey), 'false');
  h.unmount();
});

test('a write failure preserves loaded mode and still allows restoration on disabling', () => {
  const storage = browserStorage({ [preferenceKey]: 'true' });
  storage.throwWrite = true;
  const input = new Element('input', { type: 'number', inputmode: 'decimal' }, '12');
  const root = new Element('div');
  root.append(input);
  const h = harness({ root, storage });
  assert.equal(h.render().storageError, true);
  assert.deepEqual(hints(input), ['none', 'manual']);
  assert.doesNotThrow(() => h.toggle(false));
  assert.deepEqual(hints(input), ['decimal', null]);
  assert.equal(input.value, '12');
  assert.equal(input.type, 'number');
  h.unmount();
});
