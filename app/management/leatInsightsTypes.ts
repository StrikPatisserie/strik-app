export type LeatShopInsight = {
  shop: string;
  activeCustomers: number;
  transactions: number;
  creditsEarned: number;
  creditsSpent: number;
  rewardsRedeemed: number;
};

export type LeatPeriodInsight = {
  month: string;
  registrations: number;
  activeCustomers: number;
  transactions: number;
  creditsEarned: number;
  creditsSpent: number;
  rewardsRedeemed: number;
  shops: LeatShopInsight[];
};

export type LeatGiftcardInsight = {
  totalCards: number;
  cardsWithBalance: number;
  cardsWithoutBalance: number;
  outstandingBalance: number;
};

export type LeatInsightsResponse = {
  available: boolean;
  month: string;
  comparisonMode: "full-month" | "month-to-date";
  totalContacts: number;
  current: LeatPeriodInsight;
  previous: LeatPeriodInsight;
  giftcards: LeatGiftcardInsight;
  syncedAt?: string;
  warning?: string;
};
