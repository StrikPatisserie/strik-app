export const FEATURE_VISIBILITY_SETTING_KEY = "feature_visibility";

export type FeatureVisibilitySettings = {
  ijsNavigation: boolean;
  vierdaagseNavigation: boolean;
  sinterklaasNavigation: boolean;
  kerstNavigation: boolean;
};

export const defaultFeatureVisibility: FeatureVisibilitySettings = {
  ijsNavigation: true,
  vierdaagseNavigation: false,
  sinterklaasNavigation: true,
  kerstNavigation: true,
};

export const SEASONAL_NAVIGATION_SETTINGS = [
  { key: "ijsNavigation", href: "/ijs", title: "IJssalons menu" },
  {
    key: "vierdaagseNavigation",
    href: "/vierdaagse",
    title: "Vierdaagse menu",
  },
  {
    key: "sinterklaasNavigation",
    href: "/sinterklaas",
    title: "Sinterklaas menu",
  },
  { key: "kerstNavigation", href: "/kerst", title: "Kerst menu" },
] as const satisfies readonly {
  key: keyof FeatureVisibilitySettings;
  href: string;
  title: string;
}[];

export function normalizeFeatureVisibilitySettings(
  value: unknown
): FeatureVisibilitySettings {
  const settings =
    value && typeof value === "object"
      ? (value as Partial<FeatureVisibilitySettings>)
      : {};

  return {
    ijsNavigation: typeof settings.ijsNavigation === "boolean" ? settings.ijsNavigation : defaultFeatureVisibility.ijsNavigation,
    vierdaagseNavigation: Boolean(settings.vierdaagseNavigation),
    kerstNavigation: typeof settings.kerstNavigation === "boolean" ? settings.kerstNavigation : defaultFeatureVisibility.kerstNavigation,
    sinterklaasNavigation:
      typeof settings.sinterklaasNavigation === "boolean"
        ? settings.sinterklaasNavigation
        : defaultFeatureVisibility.sinterklaasNavigation,
  };
}

export function filterVisibleMainNavigationItems<T extends { href: string }>(
  items: readonly T[],
  settings: FeatureVisibilitySettings = defaultFeatureVisibility
) {
  const hiddenSeasonalHrefs = new Set<string>(
    SEASONAL_NAVIGATION_SETTINGS.filter((setting) => !settings[setting.key]).map(
      (setting) => setting.href
    )
  );

  return items.filter((item) => !hiddenSeasonalHrefs.has(item.href));
}
