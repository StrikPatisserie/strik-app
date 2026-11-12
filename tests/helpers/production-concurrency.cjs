const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file, imports) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, { exports, require: name => imports[name], Error, Map, Set, structuredClone });
    return exports;
}
const changes = compile('app/productie/concurrentChanges.ts', {});
function productionConcurrencyImports(imports) {
    const docs = imports['@/app/productie/documents.server'] || imports['./documents.server'];
    if (!docs)
        return {};
    docs.readDocumentRevision ||= async () => null;
    docs.ProductionRevisionError ||= class extends docs.ProductionStoreError {
    };
    const editing = compile('app/productie/concurrentEditing.server.ts', {
        'server-only': {}, './documents.server': docs, './concurrentChanges': changes
    });
    return {
        '@/app/productie/concurrentEditing.server': editing, './concurrentEditing.server': editing,
        '@/app/productie/concurrentChanges': changes, './concurrentChanges': changes,
    };
}
module.exports = { productionConcurrencyImports, changes };
