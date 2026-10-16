import "server-only";

import { createHash } from "node:crypto";
import type {
  SpecsPlazaConnectionResult,
  SpecsPlazaProduct,
  SpecsPlazaProductResult,
  SpecsPlazaSearchField,
  SpecsPlazaSearchResult,
} from "./types";

const TEST_ORIGIN = "https://api-accp.specsplaza.nl";
const PRODUCTION_ORIGIN = "https://api.specsplaza.nl";
const CUSTOMER_PATH = "/api/services/customers/production/product-specifications";
const REQUIRED_SETTINGS = [
  "SPECSPLAZA_USERNAME",
  "SPECSPLAZA_PASSWORD",
  "SPECSPLAZA_CLIENT_ID",
  "SPECSPLAZA_CLIENT_SECRET",
] as const;

export class SpecsPlazaError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "SpecsPlazaError";
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SpecsPlazaError("SpecsPlaza geeft een onverwacht gegevensformaat terug.");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, limit = 250) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function uuid(value: unknown) {
  const result = text(value);
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(result)) {
    throw new SpecsPlazaError("De productspecificatie bevat geen geldig SpecsPlaza-ID.");
  }
  return result.toLowerCase();
}

function product(value: unknown): SpecsPlazaProduct {
  const data = object(value);
  return {
    id: uuid(data.Id),
    name: text(data.Name) || "Artikel zonder naam",
    articleNumber: text(data.ArticleNumber),
    supplier: text(data.SupplierCompanyName),
  };
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function searchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL").replace(/frambo(?:os|zen)/g, "frambo")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

type Fetcher = typeof fetch;

/** Read-only customer access. Credentials and tokens stay in this server module. */
export class SpecsPlazaClient {
  private readonly origin: string;
  private readonly licenseCode: string;
  private readonly applicationLicenseCode: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private authenticating: Promise<string> | null = null;

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetcher: Fetcher = fetch,
  ) {
    const missing = REQUIRED_SETTINGS.filter((key) => !env[key]?.trim());
    if (missing.length) {
      throw new SpecsPlazaError(
        `De koppeling is nog niet ingesteld. Vul in Vercel in: ${missing.join(", ")}. Herdeploy daarna de app.`,
        503,
      );
    }
    let base: URL;
    try {
      base = new URL(env.SPECSPLAZA_BASE_URL?.trim() || TEST_ORIGIN);
    } catch {
      throw new SpecsPlazaError("SPECSPLAZA_BASE_URL bevat geen geldig SpecsPlaza-adres.", 503);
    }
    if (
      ![TEST_ORIGIN, PRODUCTION_ORIGIN].includes(base.origin) ||
      base.pathname !== "/" || base.search || base.hash || base.username || base.password
    ) {
      throw new SpecsPlazaError("Gebruik voor SPECSPLAZA_BASE_URL alleen de officiële SpecsPlaza-test- of productieomgeving.", 503);
    }
    this.origin = base.origin;
    // FoodBase permits a self-chosen unique license code. Keep the app identity
    // stable across deployments, scoped to this account; allow an explicit override.
    this.licenseCode = env.SPECSPLAZA_LICENSE_CODE?.trim() || createHash("sha256")
      .update(`strik-team-app\0${env.SPECSPLAZA_USERNAME}\0${env.SPECSPLAZA_CLIENT_ID}`)
      .digest("hex").slice(0, 32);
    this.applicationLicenseCode = env.SPECSPLAZA_APPLICATION_LICENSE_CODE?.trim() || "";
    if (/[\r\n]/.test(this.licenseCode + this.applicationLicenseCode)) {
      throw new SpecsPlazaError("De SpecsPlaza-licentiecode bevat ongeldige tekens.", 503);
    }
  }

  private async request(path: string, init: RequestInit, authentication = false) {
    let response: Response;
    try {
      response = await this.fetcher(`${this.origin}${path}`, {
        ...init,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SpecsPlazaError("SpecsPlaza is niet bereikbaar of reageert te langzaam. Probeer het opnieuw.", 504);
    }
    if (response.status === 401 || response.status === 403) {
      throw new SpecsPlazaError(authentication
        ? "SpecsPlaza accepteert de inloggegevens of OAuth-clientgegevens niet. Controleer de vier Vercel-instellingen voor de gekozen omgeving."
        : "SpecsPlaza geeft geen toegang tot deze productspecificaties. Controleer de licentie en leveranciersautorisaties.");
    }
    if (!response.ok) {
      throw new SpecsPlazaError(
        response.status === 429
          ? "SpecsPlaza ontvangt te veel verzoeken. Wacht even en probeer opnieuw."
          : `SpecsPlaza kon ${authentication ? "het aanmelden" : "de productspecificatie"} niet verwerken (HTTP ${response.status}).`,
      );
    }
    try {
      // Never return or log authentication error bodies, which can echo secrets.
      return object(await response.json());
    } catch {
      throw new SpecsPlazaError("SpecsPlaza geeft geen geldig JSON-antwoord terug.");
    }
  }

  private async authenticate(): Promise<string> {
    if (this.token && this.tokenExpiresAt > Date.now()) return this.token;
    if (this.authenticating) return this.authenticating;
    this.authenticating = this.request("/api/auth/openid-connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        username: this.env.SPECSPLAZA_USERNAME!,
        password: this.env.SPECSPLAZA_PASSWORD!,
        client_id: this.env.SPECSPLAZA_CLIENT_ID!,
        client_secret: this.env.SPECSPLAZA_CLIENT_SECRET!,
        grant_type: "password",
        response_type: "token",
      }),
    }, true).then((body) => {
      if (typeof body.access_token !== "string" || !body.access_token || /\s/.test(body.access_token)) {
        throw new SpecsPlazaError("SpecsPlaza heeft geen geldig toegangstoken teruggegeven.");
      }
      this.token = body.access_token;
      const seconds = Number(body.expires_in);
      this.tokenExpiresAt = Date.now() + (Number.isFinite(seconds) && seconds > 30
        ? Math.min(seconds - 30, 3600) * 1000
        : 0);
      return this.token;
    }).finally(() => { this.authenticating = null; });
    return this.authenticating;
  }

  private async customerGet(path: string) {
    const token = await this.authenticate();
    return this.request(path, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": "nl-nl",
        Authorization: `Bearer ${token}`,
        licenseCode: this.licenseCode,
        ...(this.applicationLicenseCode ? { applicationLicenseCode: this.applicationLicenseCode } : {}),
      },
    });
  }

  private get environment() {
    return this.origin === TEST_ORIGIN ? "test" as const : "production" as const;
  }

  private async productPage(query: URLSearchParams, take: number) {
    const page = await this.customerGet(`${CUSTOMER_PATH}?${query}`);
    if (page.Content !== null && !Array.isArray(page.Content)) {
      throw new SpecsPlazaError("De productlijst van SpecsPlaza heeft een onverwacht formaat.");
    }
    const items = (page.Content || []) as unknown[];
    if (items.length > take) {
      throw new SpecsPlazaError("SpecsPlaza heeft de gevraagde paginagrootte niet toegepast.");
    }
    return { products: items.map(product), total: optionalNumber(page.TotalCount) };
  }

  async searchProducts(
    input: string,
    field: SpecsPlazaSearchField = "name",
    skip = 0,
  ): Promise<SpecsPlazaSearchResult> {
    const term = input.trim();
    if (term.length < 2 || term.length > 120 ||
        !["name", "articleNumber", "supplierCompanyName"].includes(field) ||
        !Number.isInteger(skip) || skip < 0 || skip > 100_000) {
      throw new SpecsPlazaError("Gebruik een zoekterm van 2 tot 120 tekens en een geldige resultatenpagina.", 400);
    }
    const words = term.split(/\s+/).map(searchText).filter(Boolean);
    if (!words.length) throw new SpecsPlazaError("Vul een productnaam, artikelnummer of leverancier in.", 400);
    // A broad name prefix lets a spaced phrase also find compound product names.
    // Match every requested word locally; paginate the authorized catalogue rather
    // than searching just the five products used by the connection test.
    const upstreamTerm = field === "name" ? words[0].slice(0, 4) : term;
    const products: SpecsPlazaProduct[] = [];
    let nextSkip = skip;
    let hasMore = false;
    const take = 50;
    for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
      const query = new URLSearchParams({
        isActive: "true", canViewDetails: "true", [field]: upstreamTerm,
        "$take": String(take), "$skip": String(nextSkip),
        "$orderbyexpression": "Name ascending",
      });
      const page = await this.productPage(query, take);
      nextSkip += page.products.length;
      hasMore = page.products.length > 0 && (page.total !== null
        ? nextSkip < page.total : page.products.length === take);
      for (const item of page.products) {
        const value = field === "name" ? item.name : field === "articleNumber" ? item.articleNumber : item.supplier;
        const normalized = searchText(value);
        if (words.every((word) => normalized.includes(word))) products.push(item);
      }
      if (products.length || !hasMore) break;
    }
    return { environment: this.environment, checkedAt: new Date().toISOString(), products, nextSkip, hasMore };
  }

  async testConnection(): Promise<SpecsPlazaConnectionResult> {
    // isActive comes from the current schema; the old example says onlyActive.
    const query = new URLSearchParams({ isActive: "true", canViewDetails: "true", "$take": "5", "$skip": "0" });
    const page = await this.productPage(query, 5);
    const result: SpecsPlazaConnectionResult = {
      environment: this.environment,
      checkedAt: new Date().toISOString(),
      totalProducts: page.total,
      products: page.products,
      sample: null,
    };
    if (page.products.length) {
      result.sample = (await this.getProductSpecification(page.products[0].id)).sample;
    }
    return result;
  }

  async getProductSpecification(productId: string): Promise<SpecsPlazaProductResult> {
    const id = uuid(productId);
    const detail = await this.customerGet(`${CUSTOMER_PATH}/${id}`);
    const sampleProduct = product(detail);
    if (sampleProduct.id !== id) {
      throw new SpecsPlazaError("SpecsPlaza gaf een andere productspecificatie terug dan gevraagd.");
    }
    const result: SpecsPlazaProductResult = {
      environment: this.environment,
      checkedAt: new Date().toISOString(),
      product: sampleProduct,
      sample: null,
    };
    if (detail.Version === null || detail.Version === undefined) return result;
    const version = object(detail.Version);
    if (uuid(version.ProductSpecificationId) !== sampleProduct.id) {
      throw new SpecsPlazaError("De specificatieversie hoort niet bij het opgevraagde product.");
    }
    const statuses = new Set(["Absent", "Present", "RiskCrossContamination", "Unknown", "NotFilledIn"]);
    if ((version.Allergens != null && !Array.isArray(version.Allergens)) ||
        (version.NutritionalValues != null && !Array.isArray(version.NutritionalValues))) {
      throw new SpecsPlazaError("De specificatie bevat een onverwacht formaat voor allergenen of voedingswaarden.");
    }
    result.sample = {
      product: sampleProduct,
      versionNumber: optionalNumber(version.VersionNumber),
      validationDate: text(version.ValidationDate) || null,
      allergens: (version.Allergens || []).slice(0, 100).map((item: unknown) => {
        const allergen = object(item);
        return {
          name: text(allergen.AllergenName) || "Onbekend allergeen",
          status: statuses.has(String(allergen.AllergenStatus))
            ? allergen.AllergenStatus as NonNullable<SpecsPlazaConnectionResult["sample"]>["allergens"][number]["status"]
            : "Unknown",
        };
      }),
      nutritionalValues: (version.NutritionalValues || []).slice(0, 100).map((item: unknown) => {
        const nutrient = object(item);
        return { name: text(nutrient.NutrientName) || "Onbekende voedingsstof", value: optionalNumber(nutrient.Value), unit: text(nutrient.Unit, 30) };
      }),
    };
    return result;
  }
}
