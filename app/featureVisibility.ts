export const FEATURE_VISIBILITY_SETTING_KEY = "feature_visibility";

export type FeatureVisibilitySettings = {
  vierdaagseNavigation: boolean;
  sinterklaasNavigation: boolean;
};

export const defaultFeatureVisibility: FeatureVisibilitySettings = {
  vierdaagseNavigation: false,
  sinterklaasNavigation: true,
};

export const SEASONAL_NAVIGATION_SETTINGS = [
  {
    key: "vierdaagseNavigation",
    href: "/vierdaagse",
    title: "Vierdaagse menu",
    description:
      "Zet de Vierdaagse ingang aan of uit op de startpagina, desktop-sidebar en mobiele navigatie.",
  },
  {
    key: "sinterklaasNavigation",
    href: "/sinterklaas",
    title: "Sinterklaas menu",
    description:
      "Zet de Sinterklaas ingang aan of uit op de startpagina, desktop-sidebar en mobiele navigatie.",
  },
] as const satisfies readonly {
  key: keyof FeatureVisibilitySettings;
  href: string;
  title: string;
  description: string;
}[];

export function normalizeFeatureVisibilitySettings(
  value: unknown
): FeatureVisibilitySettings {
  const settings =
    value && typeof value === "object"
      ? (value as Partial<FeatureVisibilitySettings>)
      : {};

  return {
    vierdaagseNavigation: Boolean(settings.vierdaagseNavigation),
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
