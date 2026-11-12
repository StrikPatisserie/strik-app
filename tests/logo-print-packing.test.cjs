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
      && Math.abs(header.y + header.height + .15 - cell.y) < .000001
      && header.x <= cell.x + .000001 && header.x + header.width >= cell.x + cell.width - .000001);
    assert.equal(headers.length, 1, 'each continuous row of a customer logo has its own identifying header');
  }
  const pages = new Set(result.cells.map(cell => cell.page));
  assert.deepEqual([...pages], Array.from({ length: pages.size }, (_, index) => index), 'no blank pages');
  return result;
}
test('nine separate Lettershop customers share one sheet and reuse the remaining width', () => {
  const result = checkLayout(Array.from({ length: 9 }, (_, index) => choice(index)));
  assert.equal(new Set(result.cells.map(cell => cell.page)).size, 1);
  assert.equal(result.headers.length, 9);
  assert.equal(result.cells.filter(cell => cell.y === result.cells[0].y).length, 6);
});
test('larger selections fill the sheet, repeat customer identification and continue on subsequent pages', () => {
  const result = checkLayout(Array.from({ length: 9 }, (_, index) => choice(index, 8)));
  assert.equal(new Set(result.cells.map(cell => cell.page)).size, 3);
  assert.equal(result.cells.filter(cell => cell.page === 0).length, 30);
  assert.equal(result.cells.filter(cell => cell.page === 1).length, 30);
  assert.equal(result.cells.filter(cell => cell.page === 2).length, 12);
  assert(result.headers.filter(header => header.id === id(3)).length > 1);
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
    'Testklant F', 'Testklant G', 'Testklant H', 'Testklant I'];
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
test('real packed PDFs render every selected logo at 30 mm and show trusted customer/order headers on every sequence', async () => {
  const drawn = [];
  const titleText = [];
  const renderer = load(base + 'print.server.ts', {
    'server-only': {}, './model': model, './packedLayout': packed,
    'pdf-lib': { ...pdfLib, PDFDocument: {
      load: pdfLib.PDFDocument.load,
      async create() {
        const pdf = await pdfLib.PDFDocument.create();
        const addPage = pdf.addPage.bind(pdf);
        pdf.addPage = (...args) => {
          const page = addPage(...args);
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
        context.fillText = (text, ...rest) => { titleText.push(text); draw(text, ...rest); };
      }
      return canvas;
    } },
  });
  for (const quantities of [Array(9).fill(1), Array(9).fill(8)]) {
    drawn.length = 0; titleText.length = 0;
    const items = quantities.map((quantity, index) => choice(index, quantity));
    const bytes = await renderer.createLogoPrint(items, fixtures(quantities), 'Lettershop', { packGroups: true });
    const pdf = await pdfLib.PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), quantities[0] === 1 ? 1 : 3);
    const logos = drawn.filter(rect => Math.abs(rect.height - 3 * 72 / 2.54) < .000001);
    assert.equal(logos.length, quantities.reduce((sum, quantity) => sum + quantity, 0));
    for (let index = 0; index < 9; index++) assert(titleText.some(text => text.includes(`CL26-${String(index + 1).padStart(4, '0')}`)));
    assert.match(titleText.join(' '), /Wildenberg Advocaten/);
    assert.match(titleText.join(' '), /Mondzorg Lindenholt/);
    for (const page of pdf.getPages()) {
      assert(Math.abs(page.getWidth() - 210 * 72 / 25.4) < .000001);
      assert(Math.abs(page.getHeight() - 297 * 72 / 25.4) < .000001);
    }
    assert.equal(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling(), 'None');
    if (process.env.STRIK_LOGO_TEST_PDF_DIR) {
      fs.mkdirSync(process.env.STRIK_LOGO_TEST_PDF_DIR, { recursive: true });
      fs.writeFileSync(path.join(process.env.STRIK_LOGO_TEST_PDF_DIR, `lettershop-${quantities[0] === 1 ? 'nine-customers' : 'three-pages'}.pdf`), bytes);
    }
  }
});
