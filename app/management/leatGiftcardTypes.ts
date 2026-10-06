import type { RevenueShop } from "./revenueData";

export type LeatGiftcardChannel = "winkel" | "ijs";

export type LeatGiftcardDailyTotal = {
  date: string;
  shop: RevenueShop;
  channel: LeatGiftcardChannel;
  redeemed: number;
  issued: number;
  redemptionCount: number;
  issueCount: number;
};

export type LeatUnmappedShopTotal = {
  uuid: string;
  name: string;
  redeemed: number;
  issued: number;
  transactionCount: number;
};

export type LeatGiftcardControlResponse = {
  available: boolean;
  month: string;
  syncedAt?: string;
  transactionCount: number;
  daily: LeatGiftcardDailyTotal[];
  unmappedShops: LeatUnmappedShopTotal[];
  warning?: string;
};
