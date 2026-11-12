const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const pdfLib = require('pdf-lib');
const canvasModule = require('@napi-rs/canvas');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, console, process, require: name => name in imports ? imports[name] : require(name) });
  return exports;
}
const base = 'app/sinterklaas/b2b/logos/';
const model = load(base + 'model.ts');
const packed = load(base + 'packedLayout.ts', { './model': model });
const id = index => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const choice = (index, quantity = 1, width = 3, height = 3) => ({ id: id(index), quantity, width_cm: width, height_cm: height });
function checkLayout(items) {
  const result = packed.packedLogoPrintLayout(items);
  assert.equal(result.cells.length, items.reduce((total, item) => total + item.quantity, 0));
  for (const item of items) {
    const cells = result.cells.filter(cell => cell.id === item.id);
    assert.equal(cells.length, item.quantity);
    assert(cells.every(cell => cell.width === item.width_cm && cell.height === item.height_cm));
  }
  const rectangles = [...result.cells, ...result.headers];
  for (const rect of rectangles) {
    assert(rect.x >= .5 && rect.y >= .5);
    assert(rect.x + rect.width <= 20.500001 && rect.y + rect.height <= 24.700001);
    for (const other of rectangles) {
      if (rect === other || rect.page !== other.page) continue;
      const overlapX = Math.min(rect.x + rect.width, other.x + other.width) - Math.max(rect.x, other.x);
      const overlapY = Math.min(rect.y + rect.height, other.y + other.height) - Math.max(rect.y, other.y);
      assert(overlapX < .000001 || overlapY < .000001, 'customer headers and exact-size logos never overlap');
    }
  }
  for (const cell of result.cells) {
    const headers = result.headers.filter(header => header.id === cell.id && header.page === cell.page
      && header.y + header.height + .15 <= cell.y + .000001
      && !result.headers.some(next => next.page === cell.page && next.y > header.y && next.y < cell.y)
      && header.x <= cell.x + .000001 && header.x + header.width >= cell.x + cell.width - .000001);
    assert.equal(headers.length, 1, 'every logo belongs to exactly one identified full-width customer block');
  }
  const pages = new Set(result.cells.map(cell => cell.page));
  assert.deepEqual([...pages], Array.from({ length: pages.size }, (_, index) => index), 'no blank pages');
  return result;
}
test('different orders start full-width blocks separated by a white strip, sharing pages where possible', () => {
  const result = checkLayout(Array.from({ length: 9 }, (_, index) => choice(index)));
  assert.equal(new Set(result.cells.map(cell => cell.page)).size, 3);
  assert.equal(result.headers.length, 9);
  for (const header of result.headers) {
    assert.equal(header.x, .5);
    assert.equal(header.width, 20);
    const previous = result.cells.filter(cell => cell.page === header.page && cell.y < header.y);
    if (previous.length) assert(header.y - Math.max(...previous.map(cell => cell.y + cell.height)) >= .649999);
  }
  const compact = checkLayout([choice(1, 2), choice(2, 12), choice(3, 7)]);
  assert.equal(new Set(compact.cells.map(cell => cell.page)).size, 1, 'the reported selection still fits on one page');
  assert.equal(new Set(compact.cells.map(cell => cell.id + ':' + cell.y)).size, 5);
});
test('larger selections fill the sheet, repeat customer identification and continue on subsequent pages', () => {
  const result = checkLayout(Array.from({ length: 9 }, (_, index) => choice(index, 8)));
  assert(new Set(result.cells.map(cell => cell.page)).size > 1);
  assert(result.cells.filter(cell => cell.page === 0).length > 16, 'the next customer uses the remaining page space');
  assert(result.headers.some(header => result.headers.filter(other => other.id === header.id).length > 1));
});
test('mixed sizes, zero selections and narrow logos keep readable headers and exact requested sizes', () => {
  const items = [choice(0, 0), choice(1, 3, .5, .5), choice(2, 4, 6, 2), choice(3, 1, 19, 22.5), choice(4, 20, 4, 3)];
  const result = checkLayout(items);
  assert(result.headers.every(header => header.width >= 3));
  assert(!result.headers.some(header => header.id === id(0)));
  for (let width = 1; width <= 10; width++) checkLayout([choice(1, 7, width, 1), choice(2, 3, 3, width), choice(3, 2)]);
  assert.throws(() => packed.packedLogoPrintLayout([choice(1, 101, 19, 22.5)]), /100 printvellen/);
  for (const invalid of [[], [choice(1, 0)], [choice(1, 2001)], [choice(1, 1, 20)], [choice(1), choice(1)]]) {
    assert.throws(() => packed.packedLogoPrintLayout(invalid));
  }
});
function fixtures(quantities) {
  const customers = ['Testklant A', 'Testklant B', 'Mondzorg Lindenholt', 'Wildenberg Advocaten', 'Tandartspraktijk Kuipers',
    'Samenwerkingsverband voor bedrijfsgezondheidszorg en tandartspraktijken regio Nijmegen en omgeving', 'Testklant G', 'Testklant H', 'Testklant I'];
  return quantities.map((quantity, index) => {
    const canvas = canvasModule.createCanvas(400, 400);
    const context = canvas.getContext('2d');
    context.fillStyle = ['#842e3c', '#1b3443', '#537e64'][index % 3];
    context.fillRect(0, 0, 400, 400);
    context.fillStyle = '#fff';
    context.font = 'bold 150px sans-serif';
    context.fillText(String.fromCharCode(65 + index), 140, 255);
    return { id: id(index), customer: customers[index], printSummary: `CL26-${String(index + 1).padStart(4, '0')} · ${quantity} × spuitletter S · melk · groot`,
      content_type: 'image/png', bytes_base64: canvas.toBuffer('image/png').toString('base64') };
  });
}
function inspectRenderer() {
  const drawn = [];
  const titleText = [];
  const headerInk = [];
  const frames = [];
  const renderer = load(base + 'print.server.ts', {
    'server-only': {}, './model': model, './packedLayout': packed,
    'pdf-lib': { ...pdfLib, PDFDocument: {
      load: pdfLib.PDFDocument.load,
      async create() {
        const pdf = await pdfLib.PDFDocument.create();
        const addPage = pdf.addPage.bind(pdf);
        pdf.addPage = (...args) => {
          const page = addPage(...args);
          const drawRectangle = page.drawRectangle.bind(page);
          page.drawRectangle = options => { frames.push(options); drawRectangle(options); };
          const drawImage = page.drawImage.bind(page);
          page.drawImage = (image, options) => { drawn.push(options); drawImage(image, options); };
          return page;
        };
        return pdf;
      },
    } },
    '@napi-rs/canvas': { ...canvasModule, createCanvas(...args) {
      const canvas = canvasModule.createCanvas(...args);
      if (args[1] === 156) {
        const context = canvas.getContext('2d');
        const draw = context.fillText.bind(context);
        context.fillText = (text, ...rest) => { assert(rest[0] >= 106, 'header text stays beside the small logo preview'); assert(rest[1] <= 148, 'all header text stays above the separator'); titleText.push(text); draw(text, ...rest); };
        const toBuffer = canvas.toBuffer.bind(canvas);
        canvas.toBuffer = (...options) => {
          const { data } = context.getImageData(110, 0, canvas.width - 110, 145);
          let ink = 0;
          for (let offset = 0; offset < data.length; offset += 4) if (data[offset] < 100 && data[offset + 3] > 200) ink++;
          headerInk.push(ink);
          return toBuffer(...options);
        };
      }
      return canvas;
    } },
  });
  return { renderer, drawn, titleText, headerInk, frames };
}
test('real packed PDFs render exact-size logos with cutting frames and customer/count headers', async () => {
  const { renderer, drawn, titleText, headerInk, frames } = inspectRenderer();
  for (const quantities of [Array(9).fill(1), Array(9).fill(8), [2, 12, 7]]) {
    drawn.length = 0; titleText.length = 0; headerInk.length = 0; frames.length = 0;
    const items = quantities.map((quantity, index) => choice(index, quantity));
    const bytes = await renderer.createLogoPrint(items, fixtures(quantities), 'Lettershop', { packGroups: true });
    const pdf = await pdfLib.PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), new Set(packed.packedLogoPrintLayout(items).cells.map(cell => cell.page)).size);
    const logos = drawn.filter(rect => Math.abs(rect.height - 3 * 72 / 2.54) < .000001);
    assert.equal(logos.length, quantities.reduce((sum, quantity) => sum + quantity, 0));
    for (let index = 0; index < quantities.length; index++) assert(titleText.some(text => text.includes(`${quantities[index]}× logo`)));
    assert(!/CL26-|spuitletter|melk|groot/.test(titleText.join(' ')), 'order and product details stay off the print header');
    assert.equal(frames.length, logos.length);
    for (const [index, frame] of frames.entries()) {
      for (const dimension of ['x', 'y', 'width', 'height']) assert.equal(frame[dimension], logos[index][dimension]);
      assert.equal(frame.borderWidth, .4);
      assert.deepEqual(frame.borderColor, pdfLib.rgb(.8, .8, .8));
      assert.equal(frame.color, undefined, 'cutting frames have no fill over the logo');
    }
    if (quantities.length > 3) assert.match(titleText.join(' '), /Wildenberg Advocaten/);
    assert(headerInk.every(ink => ink > 2000), 'customer/count text produces visible print pixels even without system fonts');
    assert.match(titleText.join(' '), /Mondzorg Lindenholt/);
    for (const page of pdf.getPages()) {
      assert(Math.abs(page.getWidth() - 210 * 72 / 25.4) < .000001);
      assert(Math.abs(page.getHeight() - 297 * 72 / 25.4) < .000001);
    }
    assert.equal(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling(), 'None');
    if (process.env.STRIK_LOGO_TEST_PDF_DIR) {
      fs.mkdirSync(process.env.STRIK_LOGO_TEST_PDF_DIR, { recursive: true });
      fs.writeFileSync(path.join(process.env.STRIK_LOGO_TEST_PDF_DIR, `lettershop-${quantities.length === 3 ? 'separate-order-blocks' : quantities[0] === 1 ? 'nine-customers' : 'multiple-pages'}.pdf`), bytes);
    }
  }
});

test('identical logo contents on different product lines combine per order while receipts retain their original lines', async () => {
  const { renderer, drawn, titleText, frames } = inspectRenderer();
  const items = [choice(0, 2), choice(1, 3), choice(2, 5), choice(3, 3), choice(4, 2)];
  const files = fixtures(items.map(item => item.quantity));
  for (let index = 0; index < files.length; index++) {
    files[index].orderId = index < 4 ? id(100) : id(101);
    files[index].customer = index < 4 ? 'Rudi Wilders' : 'Regina';
    if (index !== 3) files[index].bytes_base64 = files[0].bytes_base64;
  }
  const before = JSON.stringify({ items, files });
  const bytes = await renderer.createLogoPrint(items, files, 'Lettershop', { packGroups: true });
  const pdf = await pdfLib.PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(titleText, ['Rudi Wilders, 10× logo', 'Rudi Wilders, 3× logo', 'Regina, 2× logo']);
  assert.equal(frames.length, 15);
  assert.equal(drawn.length, 15 + 3, 'one header per customer/logo sequence');
  assert.equal(JSON.stringify({ items, files }), before, 'original individual receipt IDs and quantities stay intact');
  if (process.env.STRIK_LOGO_TEST_PDF_DIR) fs.writeFileSync(path.join(process.env.STRIK_LOGO_TEST_PDF_DIR, 'lettershop-grouped-logos.pdf'), bytes);
});
test('grouping keeps distinct orders, unknown order identities and sizes separate and validates original selections', async () => {
  const { renderer, titleText, frames } = inspectRenderer();
  const items = [choice(0, 2), choice(1, 3), choice(2, 1, 4, 4), choice(3, 1), choice(4, 1)];
  const files = fixtures(items.map(item => item.quantity));
  for (let index = 0; index < files.length; index++) {
    files[index].customer = 'Zelfde klantnaam';
    files[index].bytes_base64 = files[0].bytes_base64;
    if (index < 3) files[index].orderId = id(index === 1 ? 101 : 100);
  }
  await renderer.createLogoPrint(items, files, 'Lettershop', { packGroups: true });
  assert.equal(titleText.length, 5, 'matching customer names alone never merge orders or sizes');
  assert.equal(frames.filter(frame => Math.abs(frame.width - 4 * 72 / 2.54) < .000001).length, 1);
  await assert.rejects(renderer.createLogoPrint([choice(0), choice(0)], files, 'Lettershop', { packGroups: true }), /Controleer/);
});
