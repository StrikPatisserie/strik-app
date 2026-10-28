import { BOARDS, type BoardId } from "./planning";

export const PRODUCTION_HOME = "/bakkerij/productie";
export const PRODUCTION_VIEWS = ["planning", "catalog", "recipes", "ingredients", "stock", "settings"] as const;
export type ProductionView = (typeof PRODUCTION_VIEWS)[number];
export function productionView(value?: string): ProductionView {
  return PRODUCTION_VIEWS.includes(value as ProductionView) ? value as ProductionView : "planning";
}
export function productionBoard(value?: string): BoardId | undefined {
  // Old links to the bread board now open Bakkant without changing department IDs.
  if (value === "brood") return "bak";
  return BOARDS.some(board => board.id === value) ? value as BoardId : undefined;
}
export const DATA_SECTIONS = [
  { id: "recepten", label: "Eindproducten" },
  { id: "halffabricaten", label: "Halffabricaten" },
  { id: "ingredienten", label: "Grondstoffen & SpecsPlaza" },
  { id: "verpakkingen", label: "Verpakkingen" },
  { id: "import", label: "Data importeren" },
  { id: "factuurimport", label: "Factuurimport" },
  { id: "marge", label: "Marges" },
  { id: "voorpagina", label: "Weekinformatie" },
] as const;
