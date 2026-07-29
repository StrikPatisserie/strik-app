export const seasonalFeatureVisibility = {
  vierdaagseNavigation: false,
} as const;

export function filterVisibleMainNavigationItems<T extends { href: string }>(
  items: readonly T[]
) {
  return items.filter(
    (item) =>
      seasonalFeatureVisibility.vierdaagseNavigation ||
      item.href !== "/vierdaagse"
  );
}
