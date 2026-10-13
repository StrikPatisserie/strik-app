import type { PresentationCategory } from "./presentationData";

export type PresentationPlacementRole = "hoofdplek" | "ondersteuning";

export type StorePresentationPlacement = {
  touchpointId: string;
  role: PresentationPlacementRole;
  instruction: string;
};

export type StorePresentationPlan = {
  id: string;
  storeId: "heyendaal";
  weekStart: string;
  title: string;
  category: PresentationCategory;
  generalInstruction: string;
  placements: StorePresentationPlacement[];
  updatedAt: string;
  updatedByName: string;
};

export type StorePresentationCompletion = {
  storeId: "heyendaal";
  weekStart: string;
  touchpointId: string;
  completed: boolean;
  completedAt: string;
  completedBy: string;
  completedByName: string;
};

export type StorePresentationState = {
  plans: StorePresentationPlan[];
  completions: StorePresentationCompletion[];
  updatedAt: string;
};
