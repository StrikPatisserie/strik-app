const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, fetcher = () => { throw Error("Unexpected network call"); }, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, fetch: fetcher, require: (name) => name in dependencies ? dependencies[name] : require(name) });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const now = "2026-10-16T14:30:00.000Z";
const id = "4d7f467a-51a6-4add-b0a8-8828586f3f7b";
const original = {
  id: "butter", name: "Roomboter", supplier: "Beko", supplierArticleNumber: "8040019",
  pricePerBaseUnit: 0.005, lastPrice: 5, allergens: ["Melk"], aliases: [],
  specification: { source: "Eigen gecontroleerd document", allergensConfirmed: true, ingredientsText: "room", nutritionPer100g: { fat: 81, salt: 0 } },
};
const product = { id, name: "Debic roomboter 25kg", supplier: "FrieslandCampina Professional", articleNumber: "912100" };
const detail = {
  environment: "test", checkedAt: now, product,
  sample: { product, versionNumber: 11, validationDate: "2025-04-18", allergens: [
    { name: "Melk", status: "Present" }, { name: "Ei", status: "NotFilledIn" }, { name: "Noten", status: "RiskCrossContamination" },
  ], nutritionalValues: [{ name: "Zout", value: null, unit: "g/100g" }, { name: "Suiker", value: 0, unit: "g/100g" }] },
};
const modulePath = "app/bakkerij/recepturen/specsPlazaLink.ts";
const { linkSpecsPlazaProduct, mergeIngredientSpecification } = load(modulePath);
const linked = linkSpecsPlazaProduct(original, detail, now);
const otherIngredient = { ...original, id: "other", name: "Anders" };
const recipes = ["A", "B"].map((name) => ({ id: name, name, ingredients: [{ ingredientId: original.id, quantity: 100, unit: "gram" }], semiFinishedItems: [], labeling: { finalBatchWeightGrams: 100 } }));
function storedData() {
  return { financialAccess: true, ingredients: [{ ...original, lastPrice: 6.25, aliases: ["Nieuwere alias"] }, otherIngredient], recipes, invoiceImports: [{ id: "invoice", lines: [{ price: 123 }] }], packagingItems: [{ id: "pack" }], bakeryHome: { notes: ["behouden"] }, futureData: { keep: true } };
}

test("link stores identity, environment and version without replacing checked labeling data", () => {
  assert.equal(linked.id, original.id);
  assert.equal(linked.specification.specsPlazaId, id);
  assert.equal(linked.specification.specificationVersion, "11");
  assert.equal(linked.specification.specsPlazaLink.environment, "test");
  assert.equal(linked.specification.specsPlazaLink.linkedAt, now);
  assert.equal(linked.specification.specsPlazaLink.sample.allergens[1].status, "NotFilledIn");
  assert.equal(linked.specification.specsPlazaLink.sample.allergens[2].status, "RiskCrossContamination");
  assert.equal(linked.specification.specsPlazaLink.sample.nutritionalValues[0].value, null);
  assert.equal(linked.specification.specsPlazaLink.sample.nutritionalValues[1].value, 0);
  for (const key of ["source", "allergensConfirmed", "ingredientsText", "nutritionPer100g"]) assert.deepEqual(linked.specification[key], original.specification[key]);
  assert.deepEqual(linked.allergens, original.allergens);
  assert.equal(original.specification.specsPlazaId, undefined);
  const production = linkSpecsPlazaProduct(original, { ...detail, environment: "production" }, now);
  assert.equal(production.specification.specsPlazaLink.environment, "production");
});

test("empty, foreign and mismatched specification identities are rejected", () => {
  for (const value of [{ ...detail, sample: null }, { ...detail, environment: "other" }, { ...detail, product: { ...product, id: "invalid" } }, { ...detail, sample: { ...detail.sample, product: { ...product, id: "other" } } }]) {
    assert.throws(() => linkSpecsPlazaProduct(original, value), /geldige specificatie/);
  }
});

test("merging a specification preserves newer ingredient prices and invoice fields", () => {
  const current = { ...original, lastPrice: 99, supplier: "Nieuwe leverancier", lastInvoice: "Vandaag" };
  const merged = mergeIngredientSpecification(current, linked, original);
  assert.equal(merged.lastPrice, 99);
  assert.equal(merged.supplier, "Nieuwe leverancier");
  assert.equal(merged.lastInvoice, "Vandaag");
  assert.equal(merged.specification.specsPlazaId, id);
  assert.throws(() => mergeIngredientSpecification({ ...current, specification: { source: "Gewijzigd" } }, linked, original), /ondertussen gewijzigd/);
  assert.throws(() => mergeIngredientSpecification({ ...current, allergens: [] }, linked, original), /ondertussen gewijzigd/);
  assert.throws(() => mergeIngredientSpecification({ ...current, id: "wrong" }, linked, original), /grondstof is veranderd/);
});

test("persist reads current storage, updates one shared ingredient and leaves all recipe references intact", async () => {
  const data = storedData();
  const calls = [];
  const { persistIngredientSpecification } = load(modulePath, async (url, init) => {
    calls.push({ url, init });
    if (init?.method !== "PUT") return json(data);
    const body = JSON.parse(init.body);
    assert.equal(body.financialAccess, undefined);
    assert.deepEqual(body.recipes, data.recipes);
    assert.deepEqual(body.invoiceImports, data.invoiceImports);
    assert.deepEqual(body.packagingItems, data.packagingItems);
    assert.deepEqual(body.futureData, data.futureData);
    assert.deepEqual(body.ingredients[1], data.ingredients[1]);
    assert.equal(body.ingredients[0].lastPrice, 6.25);
    assert.deepEqual(body.ingredients[0].aliases, ["Nieuwere alias"]);
    return json({ ...body, financialAccess: true });
  });
  const stored = await persistIngredientSpecification(linked, original);
  assert.equal(calls.length, 2);
  assert(calls.every((call) => call.url === "/api/recepturen"));
  assert.equal(stored.specification.specsPlazaLink.product.id, id);
  assert.equal(stored.specification.specsPlazaLink.environment, "test");
  for (const recipe of recipes) assert.equal(recipe.ingredients[0].ingredientId, stored.id);
});

test("success waits for confirmed server storage", async () => {
  let finish;
  let writing;
  const entered = new Promise((resolve) => { writing = resolve; });
  const { persistIngredientSpecification } = load(modulePath, async (_, init) => {
    if (init?.method !== "PUT") return json(storedData());
    writing();
    await new Promise((resolve) => { finish = resolve; });
    return json({ ...JSON.parse(init.body), financialAccess: true });
  });
  let settled = false;
  const pending = persistIngredientSpecification(linked, original).then(() => { settled = true; });
  await entered;
  assert.equal(settled, false);
  finish(); await pending;
  assert.equal(settled, true);
});

test("stale, missing, duplicate and unauthorized ingredient records never trigger writes", async () => {
  for (const data of [
    { ...storedData(), financialAccess: false },
    { ...storedData(), ingredients: [] },
    { ...storedData(), ingredients: [original, original] },
    { ...storedData(), ingredients: [{ ...original, specification: { source: "Nieuw document" } }] },
  ]) {
    let writes = 0;
    const { persistIngredientSpecification } = load(modulePath, async (_, init) => { if (init?.method === "PUT") writes++; return json(data); });
    await assert.rejects(() => persistIngredientSpecification(linked, original));
    assert.equal(writes, 0);
  }
});

test("network and storage failures are reported, including an unconfirmed round trip", async () => {
  for (const response of [() => { throw Error("Offline"); }, () => json({ message: "Geen toegang" }, 403), () => json({ message: "Opslag tijdelijk uitgevallen" }, 502), () => json(storedData())]) {
    const { persistIngredientSpecification } = load(modulePath, async (_, init) => init?.method === "PUT" ? response() : json(storedData()));
    await assert.rejects(() => persistIngredientSpecification(linked, original));
  }
});

test("every recipe sees a test warning while supplier snapshots do not become verified allergen claims", () => {
  const { calculateLabel } = load("app/bakkerij/recepturen/labeling.ts");
  for (const recipe of recipes) {
    const result = calculateLabel(recipe, [linked], recipes);
    assert(result.warnings.some((warning) => warning.includes("SpecsPlaza-testkoppeling")));
    assert.deepEqual(plain(result.allergens), ["Melk"]);
    assert.equal(result.nutrition.fat, 81);
    assert.equal(result.nutrition.salt, 0);
    assert.equal(result.nutrition.energyKj, undefined);
  }
});

test("the compact linked view is collapsed, shows Test and does not ask the user to search again", () => {
  const component = load("app/bakkerij/recepturen/SpecsPlazaProductSearch.tsx", undefined, { "./SpecsPlazaLink.module.css": { default: new Proxy({}, { get: (_, key) => String(key) }) } }).default;
  const linkedHtml = renderToStaticMarkup(React.createElement(component, { ingredientName: original.name, articleNumber: original.supplierArticleNumber, link: linked.specification.specsPlazaLink, onLink: async () => {} }));
  assert(linkedHtml.includes("✓ Gekoppeld"));
  assert(linkedHtml.includes("Debic roomboter 25kg"));
  assert(linkedHtml.includes("Test"));
  assert(!linkedHtml.includes("<form"));
  assert(!linkedHtml.includes(" open="));
  const searchHtml = renderToStaticMarkup(React.createElement(component, { ingredientName: original.name, articleNumber: original.supplierArticleNumber, onLink: async () => {} }));
  assert(searchHtml.includes('value="Roomboter"'));
  assert(!searchHtml.includes("Zoek in alle actieve"));
  assert(!searchHtml.includes("alleen bekijken"));
});
