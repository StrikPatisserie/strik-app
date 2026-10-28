// Offline dry run only. Reads a user-supplied WordPress JSON export; no network,
// database mutation, source rewrite, or raw recipe/financial details in stdout.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  console.error('Gebruik: node scripts/check-production-recipe-migration.cjs /pad/naar/wordpress-export.json');
  process.exitCode = 2;
} else {
  try {
    const file = fs.readFileSync(path.resolve(input));
    if (file.length > 80 * 1024 * 1024) throw Error('export-too-large');
    const source = JSON.parse(file.toString('utf8'));
    const exportsModel = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/productie/recipeMigration.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports: exportsModel, structuredClone });
    const report = exportsModel.inspectRecipeTransfer(source);
    console.log(JSON.stringify({ mode: 'read-only-dry-run', sourceSha256: crypto.createHash('sha256').update(file).digest('hex'), ...report }, null, 2));
    if (!report.ready) process.exitCode = 1;
  } catch {
    console.error('De bronexport kon niet worden gecontroleerd. Gebruik een geldig JSON-bestand van maximaal 80 MB.');
    process.exitCode = 2;
  }
}
