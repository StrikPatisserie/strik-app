const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}

function gallery(story = { src: '/silent.mp4', poster: '/poster.jpg', description: 'De kerststollen worden in onze bakkerij gemaakt.' }) {
  const states = [], refs = [], callbacks = [], effects = [];
  let cursor = 0, refCursor = 0, callbackCursor = 0, effectCursor = 0, now = 0, timerId = 0;
  const timers = new Map();
  const sameDeps = (before, after) => before && before.length === after.length && before.every((value, index) => Object.is(value, after[index]));
  const viewport = { clientWidth: 320, scrollLeft: 0, scrollTo(options) { this.scrollLeft = options.left; this.behavior = options.behavior; } };
  const hooks = {
    ...React,
    useCallback(callback, deps) { const index = callbackCursor++; if (!sameDeps(callbacks[index]?.deps, deps)) callbacks[index] = { callback, deps }; return callbacks[index].callback; },
    useEffect(effect, deps) { const index = effectCursor++; const previous = effects[index]; effects[index] = { ...previous, effect, deps, pending: !sameDeps(previous?.deps, deps) }; },
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef() { const index = refCursor++; return refs[index] ||= { current: index === 0 ? viewport : null }; },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('app/kerst-voor-bedrijven/ProductMediaGallery.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports,
    window: {
      matchMedia: () => ({ matches: false }),
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (name === 'next/image') return { default: props => { const imageProps = { ...props }; delete imageProps.fill; return React.createElement('img', imageProps); } };
    return { default: {} };
  } });
  return {
    viewport,
    render() { cursor = 0; refCursor = 0; callbackCursor = 0; effectCursor = 0; return exports.default({ name: 'Kerststol', image: '/stol.jpg', story, eager: true }); },
    commit(player = null) {
      const tree = this.render();
      refs[1].current = find(tree, node => node.type === 'video') ? player : null;
      for (const effect of effects) if (effect.pending) { effect.cleanup?.(); effect.cleanup = effect.effect(); effect.pending = false; }
      return tree;
    },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      now = end;
    },
    unmount() { for (const effect of effects) effect.cleanup?.(); },
    scroll(left) { viewport.scrollLeft = left; find(this.render(), node => Boolean(node.props?.onScroll)).props.onScroll({ currentTarget: viewport }); },
  };
}

test('the first slide is a product photo; video is not mounted or downloaded before interaction', () => {
  const card = gallery();
  const html = renderToStaticMarkup(card.render());
  assert.match(html, /Bekijk hoe we Kerststol maken/);
  assert.match(html, /Productfoto, 1 van 2/);
  assert.doesNotMatch(html, /<video|src="\/silent.mp4"/);
  assert.equal(find(card.render(), node => node.props?.['aria-label'] === 'Bekijk de productfoto van Kerststol').props['aria-pressed'], true);
});

test('a completed clip stays on its final frame for 15 seconds before returning to the photo', () => {
  const card = gallery();
  const listeners = new Map();
  const nativePlayer = { paused: false, readyState: 4, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); }, pause() {} };
  find(card.render(), node => node.props?.['aria-label'] === 'Bekijk hoe we Kerststol maken').props.onClick();
  card.scroll(320);
  const player = find(card.commit(nativePlayer), node => node.type === 'video');
  assert.equal(player.props.loop, undefined);
  player.props.onEnded();
  assert.equal(card.viewport.scrollLeft, 320, 'ending must leave the final frame visible');
  listeners.get('ended')();
  card.advance(14_999);
  assert.equal(card.viewport.scrollLeft, 320);
  card.advance(1);
  assert.equal(card.viewport.scrollLeft, 0);
  card.scroll(0);
  assert.equal(find(card.render(), node => node.type === 'video'), undefined);
  assert.match(renderToStaticMarkup(card.render()), /Productfoto, 1 van 2/);
});

test('an unplayed clip returns after 15 seconds, and leaving the story cancels the old deadline', () => {
  const card = gallery();
  card.commit();
  card.scroll(320);
  card.commit();
  card.advance(14_999);
  assert.equal(card.viewport.scrollLeft, 320);
  card.advance(1);
  assert.equal(card.viewport.scrollLeft, 0);
  card.scroll(0);
  card.commit();

  card.scroll(320);
  card.commit();
  card.advance(10_000);
  card.scroll(0);
  card.commit();
  card.scroll(320);
  card.commit();
  card.advance(5_000);
  assert.equal(card.viewport.scrollLeft, 320, 'opening again starts a fresh 15-second deadline');
  card.unmount();
  card.advance(20_000);
  assert.equal(card.viewport.scrollLeft, 320, 'unmount cancels the pending return');
});

test('playback cancels the idle deadline; pausing and buffering start a fresh 15 seconds', () => {
  const card = gallery();
  const listeners = new Map();
  const player = {
    paused: true, readyState: 4,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    pause() { this.paused = true; listeners.get('pause')?.(); },
  };
  find(card.render(), node => node.props?.['aria-label'] === 'Bekijk hoe we Kerststol maken').props.onClick();
  card.scroll(320);
  card.commit(player);
  card.advance(10_000); // Includes autoplay blocked by the browser.
  player.paused = false;
  listeners.get('playing')();
  card.advance(60_000);
  assert.equal(card.viewport.scrollLeft, 320, 'a playing clip may last longer than 15 seconds');
  player.pause();
  card.advance(14_999);
  assert.equal(card.viewport.scrollLeft, 320);
  player.paused = false;
  listeners.get('playing')();
  card.advance(1);
  assert.equal(card.viewport.scrollLeft, 320, 'resuming cancels the pause deadline');
  listeners.get('waiting')();
  card.advance(15_000);
  assert.equal(card.viewport.scrollLeft, 0);
  card.scroll(0);
  card.commit();
  assert.equal(listeners.size, 0, 'returning to the photo removes playback listeners');
});

test('video plays muted inline without the native controls that dim mobile playback', () => {
  const card = gallery();
  find(card.render(), node => node.props?.['aria-label'] === 'Bekijk hoe we Kerststol maken').props.onClick();
  assert.equal(card.viewport.scrollLeft, 320);
  card.scroll(320);
  const player = find(card.render(), node => node.type === 'video');
  assert.equal(player.props.src, '/silent.mp4');
  assert.equal(player.props.muted, true);
  assert.equal(player.props.playsInline, true);
  assert.equal(player.props.controls, undefined);
  assert.equal(player.props.preload, 'none');
  assert.equal(player.props.autoPlay, true);
  // A resize may move the viewport before its scroll event; an explicit video
  // choice must survive intermediate photo positions during smooth scrolling.
  card.viewport.scrollLeft = 0;
  find(card.render(), node => node.props?.['aria-label'] === 'Bekijk hoe we Kerststol maken').props.onClick();
  card.scroll(20);
  card.scroll(320);
  assert.ok(find(card.render(), node => node.type === 'video'));
  card.scroll(0);
  assert.equal(find(card.render(), node => node.type === 'video'), undefined, 'returning to the photo must remove the player');
});

test('the transparent playback button follows native play/pause and cancels the idle deadline on resume', () => {
  const card = gallery();
  const listeners = new Map();
  let playerNode, pauseCalls = 0, playCalls = 0;
  const nativePlayer = {
    paused: false, readyState: 4,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    pause() { pauseCalls++; this.paused = true; playerNode.props.onPause(); listeners.get('pause')?.(); },
    play() { playCalls++; this.paused = false; playerNode.props.onPlaying(); listeners.get('playing')?.(); return Promise.resolve(); },
  };
  find(card.render(), node => node.props?.['aria-label'] === 'Bekijk hoe we Kerststol maken').props.onClick();
  card.scroll(320);
  playerNode = find(card.commit(nativePlayer), node => node.type === 'video');
  playerNode.props.onPlaying();
  find(card.render(), node => node.type === 'button' && node.props['aria-label'] === 'Pauzeer de maakvideo van Kerststol').props.onClick();
  assert.equal(pauseCalls, 1);
  card.advance(14_999);
  assert.equal(card.viewport.scrollLeft, 320);
  find(card.render(), node => node.type === 'button' && node.props['aria-label'] === 'Speel de maakvideo van Kerststol af').props.onClick();
  assert.equal(playCalls, 1);
  card.advance(20_000);
  assert.equal(card.viewport.scrollLeft, 320, 'resuming removes the scheduled photo return');
  const css = fs.readFileSync('app/kerst-voor-bedrijven/ChristmasFolder.module.css', 'utf8');
  assert.match(css, /\.videoPlayback\{[^}]*background:transparent/);
  assert.match(css, /\.storyPlay\{[^}]*background:transparent/);
});

test('swiping to the story offers explicit playback, and video errors have a usable photo fallback', () => {
  const card = gallery();
  card.scroll(320);
  assert.equal(find(card.render(), node => node.type === 'video'), undefined);
  find(card.render(), node => node.props?.['aria-label'] === 'Speel de maakvideo van Kerststol af').props.onClick();
  find(card.render(), node => node.type === 'video').props.onError();
  assert.match(renderToStaticMarkup(card.render()), /De video kon niet worden geladen/);
  find(card.render(), node => node.type === 'button' && node.props.children === 'Terug naar de productfoto').props.onClick();
  card.scroll(0);
  assert.match(renderToStaticMarkup(card.render()), /Productfoto, 1 van 2/);
  card.scroll(-500); // Safari elastic overscroll must not select a nonexistent slide.
  assert.match(renderToStaticMarkup(card.render()), /Productfoto, 1 van 2/);
});

test('products without a clip keep their normal photo, without a video button or player', () => {
  const card = gallery(null);
  const html = renderToStaticMarkup(card.render());
  assert.match(html, /alt="Kerststol"/);
  assert.doesNotMatch(html, /<video|Zo maken we|carrousel|Bekijk hoe/);
});
