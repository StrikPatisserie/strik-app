import { BOARDS, canonicalBoardId, type BoardId } from "./planning";

export const PRODUCTION_HOME = "/bakkerij/productie";
export const PRODUCTION_VIEWS = ["planning", "catalog", "recipes", "ingredients", "stock", "settings"] as const;
export type ProductionView = (typeof PRODUCTION_VIEWS)[number];
export function productionView(value?: string): ProductionView {
  return PRODUCTION_VIEWS.includes(value as ProductionView) ? value as ProductionView : "planning";
}
export function productionBoard(value?: string): BoardId | undefined {
  // Keep older department-specific bookmarks on their combined planning board.
  if (value === "brood") return "bak";
  if (value === "ijs") return canonicalBoardId(value);
  return BOARDS.some(board => board.id === value) ? canonicalBoardId(value as BoardId) : undefined;
}
export const DATA_SECTIONS = [
  { id: "recepten", label: "Eindproducten" },
  { id: "halffabricaten", label: "Halffabricaten" },
  { id: "ingredienten", label: "Grondstoffen & SpecsPlaza" },
  { id: "verpakkingen", label: "Verpakkingen" },
  { id: "import", label: "Data importeren" },
  { id: "factuurimport", label: "Factuurimport" },
  { id: "marge", label: "Marges" },
] as const;
