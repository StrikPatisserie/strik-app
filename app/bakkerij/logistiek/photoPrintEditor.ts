import { photoBackgroundColor } from "../../lib/photoBackgroundColor";

// Runs in the standalone print window. Originals remain untouched; settings
// belong to this sheet and are shared only by copies of the same order/photo.
export const photoPrintEditorScript = `
const marzipanBackgroundFromPixels = ${photoBackgroundColor.toString()};
const marzipanColorRequests = new Map();
function marzipanCopies(item) {
  return Array.from(document.querySelectorAll('.round[data-photo-fit-key]')).filter(function(copy) {
    return copy.getAttribute('data-photo-fit-key') === item.getAttribute('data-photo-fit-key');
  });
}
function marzipanNumber(item, name, fallback) {
  var value = item.getAttribute('data-photo-' + name);
  return value === null || !Number.isFinite(Number(value)) ? fallback : Number(value);
}
function fitMarzipanPhoto(image) {
  if (!image.naturalWidth || !image.naturalHeight || !image.closest) return;
  var item = image.closest('.round:not(.keep-rectangular)');
  if (!item) return;
  var extend = item.getAttribute('data-photo-fit') === 'extend';
  var divisor = extend ? Math.hypot(image.naturalWidth, image.naturalHeight) : Math.min(image.naturalWidth, image.naturalHeight);
  var zoom = marzipanNumber(item, 'zoom', 100) / 100;
  var width = (extend ? 98 : 100) * image.naturalWidth / divisor * zoom;
  var height = (extend ? 98 : 100) * image.naturalHeight / divisor * zoom;
  var dx = marzipanNumber(item, 'x', 0) / 100 * (extend ? 25 : Math.max(0, (width - 100) / 2));
  var dy = marzipanNumber(item, 'y', 0) / 100 * (extend ? 25 : Math.max(0, (height - 100) / 2));
  image.style.setProperty('--photo-width', width + '%');
  image.style.setProperty('--photo-height', height + '%');
  image.style.setProperty('--photo-left', (50 + dx) + '%');
  image.style.setProperty('--photo-top', (50 + dy) + '%');
}
function renderMarzipanEditor(item) {
  var extend = item.getAttribute('data-photo-fit') === 'extend';
  var color = item.getAttribute('data-photo-color') || '#ffffff';
  item.querySelector('.photo-frame').style.backgroundColor = extend ? color : '#ffffff';
  item.querySelector('[data-control="mode"]').value = extend ? 'extend' : 'cover';
  ['zoom', 'x', 'y'].forEach(function(name) {
    var control = item.querySelector('[data-control="' + name + '"]');
    if (name === 'zoom') control.min = extend ? '50' : '100';
    control.value = marzipanNumber(item, name, name === 'zoom' ? 100 : 0);
  });
  item.querySelector('[data-control="color"]').value = color;
  item.querySelector('[data-control="zoom-value"]').textContent = marzipanNumber(item, 'zoom', 100) + '%';
  fitMarzipanPhoto(item.querySelector('img'));
}
function marzipanPrintChanged() {
  document.getElementById('confirm-print').disabled = true;
  document.getElementById('print-registration-note').textContent = 'Uitsnede aangepast voor alle exemplaren van deze foto. Controleer het voorbeeld en druk opnieuw af.';
}
function setMarzipanPhotoFit(select) {
  var item = select.closest('.print-item');
  var mode = select.value === 'extend' ? 'extend' : 'cover';
  marzipanCopies(item).forEach(function(copy) {
    copy.setAttribute('data-photo-fit', mode);
    copy.setAttribute('data-photo-zoom', '100');
    copy.setAttribute('data-photo-x', '0');
    copy.setAttribute('data-photo-y', '0');
    renderMarzipanEditor(copy);
  });
  marzipanPrintChanged();
  if (mode === 'extend' && !item.getAttribute('data-photo-color')) suggestMarzipanColor(select);
}
function adjustMarzipanPhoto(control) {
  var item = control.closest('.print-item');
  var name = control.getAttribute('data-control');
  var value;
  if (name === 'color') {
    if (!/^#[0-9a-f]{6}$/i.test(control.value)) return;
    value = control.value;
  } else {
    var min = name === 'zoom' ? (item.getAttribute('data-photo-fit') === 'extend' ? 50 : 100) : -100;
    var number = Number(control.value);
    value = Math.max(min, Math.min(name === 'zoom' ? 200 : 100, Number.isFinite(number) ? number : (name === 'zoom' ? 100 : 0)));
  }
  marzipanCopies(item).forEach(function(copy) {
    copy.setAttribute('data-photo-' + name, String(value));
    if (name === 'color') {
      copy.setAttribute('data-color-version', String(Number(copy.getAttribute('data-color-version') || 0) + 1));
      copy.querySelector('.color-status').textContent = 'Zelf gekozen achtergrondkleur. Controleer de overgang met de originele foto.';
    }
    renderMarzipanEditor(copy);
  });
  marzipanPrintChanged();
}
function resetMarzipanPhoto(button) {
  marzipanCopies(button.closest('.print-item')).forEach(function(copy) {
    ['zoom', 'x', 'y'].forEach(function(name) { copy.setAttribute('data-photo-' + name, name === 'zoom' ? '100' : '0'); });
    renderMarzipanEditor(copy);
  });
  marzipanPrintChanged();
}
async function marzipanColorFor(image) {
  if (image.src.startsWith('data:') || image.src.startsWith('blob:')) {
    var canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 80;
    var context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 80, 80);
    context.drawImage(image, 0, 0, 80, 80);
    var rgba = context.getImageData(0, 0, 80, 80).data;
    var rgb = new Uint8Array(80 * 80 * 3);
    for (var pixel = 0; pixel < 80 * 80; pixel++) rgb.set(rgba.slice(pixel * 4, pixel * 4 + 3), pixel * 3);
    return marzipanBackgroundFromPixels(rgb, 80, 80);
  }
  var response = await fetch('/api/bakkerij-logistiek/webshop-images/background-color', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: image.src }), signal: AbortSignal.timeout(15000)
  });
  var result = await response.json();
  if (!response.ok || !/^#[0-9a-f]{6}$/i.test(result.color)) throw new Error(result.message || 'Kies zelf een kleur.');
  return result;
}
async function suggestMarzipanColor(control) {
  var item = control.closest('.print-item');
  var image = item.querySelector('img');
  var copies = marzipanCopies(item);
  var version = item.getAttribute('data-color-version');
  copies.forEach(function(copy) {
    copy.setAttribute('data-color-loading', 'true');
    copy.querySelector('.color-status').textContent = 'Achtergrondkleur zoeken…';
    copy.querySelector('[data-control="suggest"]').disabled = true;
  });
  marzipanImageStateChanged();
  try {
    if (!marzipanColorRequests.has(image.src)) marzipanColorRequests.set(image.src, marzipanColorFor(image));
    var result = await marzipanColorRequests.get(image.src);
    copies.forEach(function(copy) {
      if (copy.getAttribute('data-color-version') !== version) return;
      copy.setAttribute('data-photo-color', result.color);
      copy.querySelector('.color-status').textContent = result.uniform
        ? 'Egale randkleur gevonden. Controleer het ronde voorbeeld.'
        : 'Geen egale achtergrond gevonden: de overgang kan zichtbaar blijven. Kies zelf een kleur of kies origineel uitsnijden.';
      renderMarzipanEditor(copy);
    });
    marzipanPrintChanged();
  } catch (error) {
    marzipanColorRequests.delete(image.src);
    copies.forEach(function(copy) {
      if (copy.getAttribute('data-color-version') === version) copy.querySelector('.color-status').textContent = 'Kleur niet automatisch gevonden. Kies zelf een kleur of kies origineel uitsnijden.';
    });
  } finally {
    copies.forEach(function(copy) {
      copy.removeAttribute('data-color-loading');
      copy.querySelector('[data-control="suggest"]').disabled = false;
    });
    marzipanImageStateChanged();
  }
}
`;
