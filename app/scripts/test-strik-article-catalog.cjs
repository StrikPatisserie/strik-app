const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.resolve(__dirname, "../lib/strikArticles.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const catalog = require(path.resolve(__dirname, "../data/strik-articles-2026.json"));
const moduleShim = { exports: {} };
const localRequire = (name) => {
  if (name === "@/app/data/strik-articles-2026.json") return catalog;
  throw new Error(`Unexpected import: ${name}`);
};
new Function("require", "module", "exports", compiled)(localRequire, moduleShim, moduleShim.exports);
const { matchStrikArticle, canonicalStrikArticleNumber } = moduleShim.exports;

assert.equal(canonicalStrikArticleNumber("60103", "Worstenbroodje"), "60103");
assert.equal(canonicalStrikArticleNumber("905", "Worstenbroodje"), "60103");
assert.equal(canonicalStrikArticleNumber("", "Worstenbroodje"), "60103");
assert.equal(canonicalStrikArticleNumber("40350", "Kruidcake"), "40350");
assert.equal(canonicalStrikArticleNumber("508", "Cake Grandeurs (5st)"), "40351");
assert.equal(canonicalStrikArticleNumber("70990", "Bonbons voorverpakt Sanadome"), "70990");
assert.equal(canonicalStrikArticleNumber("202710", "Chocolade Bars Bruce"), "70991");
assert.equal(matchStrikArticle("9999999999", "Worstenbroodje Speciaal"), null);
assert.equal(matchStrikArticle("106", "Pistache Slofje"), null);
assert.equal(canonicalStrikArticleNumber("100107", "Sint Schuimpje (2st)"), "40832");
assert.equal(canonicalStrikArticleNumber("100107", "Thee"), "100107");
assert.equal(matchStrikArticle("100107", "Onbekend"), null);
console.log("Article catalog checks passed.");
