const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, process, Buffer, URL, URLSearchParams, AbortSignal, Response, fetch,
    require(name) {
      if (name === "server-only") return {};
      return name in dependencies ? dependencies[name] : require(name);
    },
  });
  return exports;
}

const { SpecsPlazaClient } = load("app/lib/specsplaza/client.ts");
const env = {
  SPECSPLAZA_USERNAME: "test-user",
  SPECSPLAZA_PASSWORD: "test-password&+ =",
  SPECSPLAZA_CLIENT_ID: "test-client",
  SPECSPLAZA_CLIENT_SECRET: "test-secret&+ =",
};
const id = "1b565f2c-63ec-4c71-834d-6e43d034fa74";
const product = { Id: id, Name: "Testgrondstof", ArticleNumber: "1234", SupplierCompanyName: "Testleverancier" };
const detail = { ...product, Version: {
  ProductSpecificationId: id,
  VersionNumber: 3,
  ValidationDate: "2026-10-01T00:00:00+02:00",
  Allergens: [
    { AllergenName: "Melk", AllergenStatus: "Present" },
    { AllergenName: "Noten", AllergenStatus: "RiskCrossContamination" },
    { AllergenName: "Ei", AllergenStatus: "NotFilledIn" },
    { AllergenName: "Pinda", AllergenStatus: "FutureStatus" },
  ],
  NutritionalValues: [
    { NutrientName: "Suikers", Value: 0, Unit: "g" },
    { NutrientName: "Zout", Value: null, Unit: "g" },
  ],
} };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

function fakeApi(override = {}) {
  const calls = [];
  return { calls, fetch: async (url, init) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, init });
    if (parsed.pathname.endsWith("/token")) return json({ access_token: "test-bearer-token", expires_in: "3600" });
    if (parsed.pathname.endsWith(id)) return json(override.detail || detail);
    return json(override.page || { Content: [product], TotalCount: 1, PageSize: 1 });
  } };
}

test("configuration fails before network access and rejects foreign/ambiguous origins", () => {
  assert.throws(() => new SpecsPlazaClient({}, () => { throw Error("network must not run"); }), /SPECSPLAZA_USERNAME/);
  for (const base of ["https://example.com", "https://api-accp.specsplaza.nl/path", "https://api-accp.specsplaza.nl/?key=x", "https://other@api-accp.specsplaza.nl", "http://api-accp.specsplaza.nl"]) {
    assert.throws(() => new SpecsPlazaClient({ ...env, SPECSPLAZA_BASE_URL: base }), /officiële/);
  }
});

test("test defaults to staging, URL-encodes credentials and only reads bounded customer endpoints", async () => {
  const api = fakeApi();
  const result = await new SpecsPlazaClient(env, api.fetch).testConnection();
  assert.equal(api.calls.length, 3);
  assert.equal(result.environment, "test");
  const token = api.calls[0];
  assert.equal(token.url.origin, "https://api-accp.specsplaza.nl");
  assert.equal(token.init.method, "POST");
  const body = new URLSearchParams(String(token.init.body));
  assert.equal(body.get("password"), env.SPECSPLAZA_PASSWORD);
  assert.equal(body.get("client_secret"), env.SPECSPLAZA_CLIENT_SECRET);
  assert.equal(body.get("grant_type"), "password");
  assert.equal(body.get("response_type"), "token");
  assert.equal(api.calls[1].url.searchParams.get("isActive"), "true");
  assert.equal(api.calls[1].url.searchParams.get("canViewDetails"), "true");
  assert.equal(api.calls[1].url.searchParams.get("$take"), "5");
  for (const call of api.calls.slice(1)) {
    assert.equal(call.init.method, "GET");
    assert(call.url.pathname.startsWith("/api/services/customers/"));
    assert.equal(call.init.headers.Authorization, "Bearer test-bearer-token");
    assert(call.init.headers.licenseCode);
    assert(!call.url.search.includes("test-password"));
  }
  for (const call of api.calls) {
    assert.equal(call.init.redirect, "error");
    assert.equal(call.init.cache, "no-store");
  }
  const serialized = JSON.stringify(result);
  for (const secret of [...Object.values(env), "test-bearer-token"]) assert(!serialized.includes(secret));
});

test("allergen uncertainty and cross-contact remain distinct; zero nutrients differ from missing values", async () => {
  const result = await new SpecsPlazaClient(env, fakeApi().fetch).testConnection();
  assert.equal(result.sample.allergens[0].status, "Present");
  assert.equal(result.sample.allergens[1].status, "RiskCrossContamination");
  assert.equal(result.sample.allergens[2].status, "NotFilledIn");
  assert.equal(result.sample.allergens[3].status, "Unknown");
  assert.equal(result.sample.nutritionalValues[0].value, 0);
  assert.equal(result.sample.nutritionalValues[1].value, null);
});

test("empty authorized catalogue succeeds without inventing a specification", async () => {
  const api = fakeApi({ page: { Content: [], TotalCount: 0 } });
  const result = await new SpecsPlazaClient(env, api.fetch).testConnection();
  assert.equal(result.totalProducts, 0);
  assert.equal(result.sample, null);
  assert.equal(api.calls.length, 2);
});

test("wrong product/version identities and schema drift fail closed", async () => {
  for (const override of [
    { page: { Content: [{ ...product, Id: "../../identity/users" }] } },
    { page: { items: [product] } },
    { page: { Content: Array(6).fill(product) } },
    { detail: { ...detail, Id: "2b565f2c-63ec-4c71-834d-6e43d034fa74" } },
    { detail: { ...detail, Version: { ...detail.Version, ProductSpecificationId: "2b565f2c-63ec-4c71-834d-6e43d034fa74" } } },
    { detail: { ...detail, Version: { ...detail.Version, Allergens: "unknown-format" } } },
  ]) {
    await assert.rejects(() => new SpecsPlazaClient(env, fakeApi(override).fetch).testConnection());
  }
});

test("upstream authentication errors and invalid JSON never echo response bodies or secrets", async () => {
  for (const response of [json({ error: env.SPECSPLAZA_CLIENT_SECRET }, 401), new Response(env.SPECSPLAZA_PASSWORD)]) {
    await assert.rejects(() => new SpecsPlazaClient(env, async () => response).testConnection(), (error) => {
      for (const secret of Object.values(env)) assert(!error.message.includes(secret));
      return true;
    });
  }
});

test("the route blocks non-manager sessions before creating an API client", async () => {
  const access = load("app/lib/auth/access.ts");
  let requests = 0;
  for (const profile of [null, { active: true, role: "bakkerij" }, { active: false, role: "manager" }]) {
    const route = load("app/api/recepturen/specsplaza/test/route.ts", {
      "next/server": { NextResponse: { json: (data, init) => json(data, init?.status || 200) } },
      "@/app/lib/auth/access": access,
      "@/app/lib/auth/session": { getCurrentProfile: async () => profile },
      "@/app/lib/specsplaza/client": { SpecsPlazaClient: class { constructor() { requests++; } } },
    });
    const response = await route.POST();
    assert.equal(response.status, 403);
  }
  assert.equal(requests, 0);
});

test("search finds spaced and compound puree names across suppliers without importing data", async () => {
  const api = fakeApi({ page: { Content: [
    { ...product, Name: "Frambozenpuree zonder suiker", SupplierCompanyName: "Producent A" },
    { ...product, Id: "2b565f2c-63ec-4c71-834d-6e43d034fa74", Name: "Framboospuree 10 kg", SupplierCompanyName: "Producent B" },
    { ...product, Id: "3b565f2c-63ec-4c71-834d-6e43d034fa74", Name: "Frambozen decoratie" },
  ], TotalCount: 3 } });
  const result = await new SpecsPlazaClient(env, api.fetch).searchProducts("framboos puree");
  assert.equal(result.products.length, 2);
  assert.equal(result.products[0].supplier, "Producent A");
  assert.equal(result.products[1].supplier, "Producent B");
  assert.equal(result.environment, "test");
  assert.equal(result.hasMore, false);
  assert.equal(result.nextSkip, 3);
  assert.equal(api.calls[1].url.searchParams.get("name"), "fram");
  assert.equal(api.calls[1].url.searchParams.get("supplierCompanyName"), null);
  assert.equal(api.calls[1].url.searchParams.get("$take"), "50");
  assert.equal(api.calls.length, 2);
  assert(!JSON.stringify(result).includes(env.SPECSPLAZA_PASSWORD));
});

test("search continues beyond the first page and returns an explicit continuation cursor", async () => {
  const calls = [];
  const client = new SpecsPlazaClient(env, async (url, init) => {
    const parsed = new URL(url); calls.push({ url: parsed, init });
    if (parsed.pathname.endsWith("/token")) return json({ access_token: "token", expires_in: 3600 });
    const skip = Number(parsed.searchParams.get("$skip"));
    return json(skip === 0
      ? { Content: Array(50).fill({ ...product, Name: "Frambozen decoratie" }), TotalCount: 102 }
      : { Content: [{ ...product, Name: "Frambozenpuree" }], TotalCount: 102 });
  });
  const result = await client.searchProducts("framboos puree");
  assert.equal(result.products.length, 1);
  assert.equal(result.nextSkip, 51);
  assert.equal(result.hasMore, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url.searchParams.get("$skip"), "50");
});

test("article and supplier searches use their own bounded API filters", async () => {
  for (const [field, value] of [["articleNumber", "1234"], ["supplierCompanyName", "Testleverancier"]]) {
    const api = fakeApi();
    const result = await new SpecsPlazaClient(env, api.fetch).searchProducts(value, field, 50);
    assert.equal(result.products.length, 1);
    assert.equal(api.calls[1].url.searchParams.get(field), value);
    assert.equal(api.calls[1].url.searchParams.get("$skip"), "50");
    assert.equal(api.calls[1].url.searchParams.get("name"), null);
  }
});

test("invalid search arguments and product identifiers never trigger upstream requests", async () => {
  const client = new SpecsPlazaClient(env, () => { throw Error("network must not run"); });
  for (const args of [["a"], ["a".repeat(121)], ["!?"], ["framboos", "bad"], ["framboos", "name", -1], ["framboos", "name", 0.5], ["framboos", "name", 100001]]) {
    await assert.rejects(() => client.searchProducts(...args));
  }
  await assert.rejects(() => client.getProductSpecification("../../identity/users"));
});

test("specification previews retain unknown and cross-contact states and validate identity", async () => {
  const result = await new SpecsPlazaClient(env, fakeApi().fetch).getProductSpecification(id);
  assert.equal(result.product.id, id);
  assert.equal(result.sample.allergens[1].status, "RiskCrossContamination");
  assert.equal(result.sample.allergens[2].status, "NotFilledIn");
  assert.equal(result.sample.nutritionalValues[1].value, null);
  await assert.rejects(() => new SpecsPlazaClient(env, fakeApi({ detail: { ...detail, Id: "2b565f2c-63ec-4c71-834d-6e43d034fa74" } }).fetch).getProductSpecification(id));
});

test("search and product routes require a manager and validate parameters before network access", async () => {
  const access = load("app/lib/auth/access.ts");
  let clients = 0;
  const dependencies = (profile) => ({
    "next/server": { NextResponse: { json: (data, init) => json(data, init?.status || 200) } },
    "@/app/lib/auth/access": access,
    "@/app/lib/auth/session": { getCurrentProfile: async () => profile },
    "@/app/lib/specsplaza/client": { SpecsPlazaClient: class { constructor() { clients++; } } },
  });
  for (const endpoint of ["search", "product"]) {
    for (const profile of [null, { active: true, role: "bakkerij" }, { active: false, role: "manager" }]) {
      const route = load(`app/api/recepturen/specsplaza/${endpoint}/route.ts`, dependencies(profile));
      assert.equal((await route.GET(new Request(`https://app.example/api/${endpoint}`))).status, 403);
    }
  }
  for (const [endpoint, query] of [["search", "q=a"], ["search", "q=framboos&field=wrong"], ["search", "q=framboos&skip=-1"], ["search", "q=framboos&skip=1e3"], ["product", "id=../users"]]) {
    const route = load(`app/api/recepturen/specsplaza/${endpoint}/route.ts`, dependencies({ active: true, role: "manager" }));
    assert.equal((await route.GET(new Request(`https://app.example/api/${endpoint}?${query}`))).status, 400);
  }
  assert.equal(clients, 0);
});
