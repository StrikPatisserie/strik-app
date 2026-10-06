export type LaborBenchmarkStatus = "green" | "orange" | "red" | "missing";

type LaborBenchmarks = {
  laborGoodMax: number;
  laborAttentionMax: number;
  productivityGoodMin: number;
  productivityAttentionMin: number;
};

const STORE_BENCHMARKS: LaborBenchmarks = {
  laborGoodMax: 0.18,
  laborAttentionMax: 0.2,
  productivityGoodMin: 95,
  productivityAttentionMin: 80,
};

const TASTING_ROOM_BENCHMARKS: LaborBenchmarks = {
  laborGoodMax: 0.2,
  laborAttentionMax: 0.22,
  productivityGoodMin: 85,
  productivityAttentionMin: 70,
};

export function laborBenchmarksForShop(shop: string) {
  return shop === "Ziekerstraat" ? TASTING_ROOM_BENCHMARKS : STORE_BENCHMARKS;
}

export function getProductivityStatus(
  shop: string,
  value: number | null
): LaborBenchmarkStatus {
  if (value === null) return "missing";
  const benchmark = laborBenchmarksForShop(shop);
  if (value >= benchmark.productivityGoodMin) return "green";
  if (value >= benchmark.productivityAttentionMin) return "orange";
  return "red";
}

export function getLaborCostStatus(
  shop: string,
  value: number | null
): LaborBenchmarkStatus {
  if (value === null) return "missing";
  const benchmark = laborBenchmarksForShop(shop);
  if (value <= benchmark.laborGoodMax) return "green";
  if (value <= benchmark.laborAttentionMax) return "orange";
  return "red";
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function productivityBenchmarkText(
  shop: string,
  status: LaborBenchmarkStatus
) {
  if (status === "missing") return "Productiviteit: geen cijfers";
  const benchmark = laborBenchmarksForShop(shop);
  if (status === "green") {
    return `Goed · productiviteit ≥ €${benchmark.productivityGoodMin}/u`;
  }
  if (status === "orange") {
    return `Aandacht · €${benchmark.productivityAttentionMin}–<€${benchmark.productivityGoodMin}/u`;
  }
  return `Te laag · productiviteit < €${benchmark.productivityAttentionMin}/u`;
}

export function laborCostBenchmarkText(
  shop: string,
  status: LaborBenchmarkStatus
) {
  if (status === "missing") return "Loonpercentage: geen cijfers";
  const benchmark = laborBenchmarksForShop(shop);
  if (status === "green") {
    return `Goed · loonpercentage ≤ ${percent(benchmark.laborGoodMax)}`;
  }
  if (status === "orange") {
    return `Aandacht · > ${percent(benchmark.laborGoodMax)} t/m ${percent(benchmark.laborAttentionMax)}`;
  }
  return `Te hoog · loonpercentage > ${percent(benchmark.laborAttentionMax)}`;
}
