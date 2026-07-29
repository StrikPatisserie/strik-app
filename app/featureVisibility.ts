export const FEATURE_VISIBILITY_SETTING_KEY = "feature_visibility";

export type FeatureVisibilitySettings = {
  vierdaagseNavigation: boolean;
};

export const defaultFeatureVisibility: FeatureVisibilitySettings = {
  vierdaagseNavigation: false,
};

export function normalizeFeatureVisibilitySettings(
  value: unknown
): FeatureVisibilitySettings {
  const settings =
    value && typeof value === "object"
      ? (value as Partial<FeatureVisibilitySettings>)
      : {};

  return {
    vierdaagseNavigation: Boolean(settings.vierdaagseNavigation),
  };
}

export function filterVisibleMainNavigationItems<T extends { href: string }>(
  items: readonly T[],
  settings: FeatureVisibilitySettings = defaultFeatureVisibility
) {
  return items.filter(
    (item) => settings.vierdaagseNavigation || item.href !== "/vierdaagse"
  );
}
