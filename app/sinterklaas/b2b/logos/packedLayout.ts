import { LOGO_PRINT_MARGINS, validateLogoPrintItems, type PrintLogo } from "./model";

type LogoCell = { id: string; page: number; x: number; y: number; width: number; height: number };
const gap = 0.3;
const headerHeight = 1.3;
const headerGap = 0.15;
const groupGap = 0.65;
const top = 0.5;

export function packedLogoPrintLayout(items: PrintLogo[]) {
  validateLogoPrintItems(items);
  const cells: LogoCell[] = [];
  const headers: LogoCell[] = [];
  const width = 21 - LOGO_PRINT_MARGINS.left - LOGO_PRINT_MARGINS.right;
  const bottom = 29.7 - LOGO_PRINT_MARGINS.bottom;
  let page = 0;
  let y = top;

  for (const item of items) {
    const columns = Math.floor((width + gap + 0.000001) / (item.width_cm + gap));
    let remaining = item.quantity;
    while (remaining > 0) {
      if (y + headerHeight + headerGap + item.height_cm > bottom + 0.000001) {
        page++;
        if (page >= 100) throw Error("Dit zijn meer dan 100 printvellen. Kies minder logo’s of een kleiner formaat.");
        y = top;
      }
      headers.push({ id: item.id, page, x: LOGO_PRINT_MARGINS.left, y, width, height: headerHeight });
      const logoTop = y + headerHeight + headerGap;
      const rows = Math.floor((bottom - logoTop + gap + 0.000001) / (item.height_cm + gap));
      const count = Math.min(remaining, columns * rows);
      for (let index = 0; index < count; index++) {
        cells.push({ id: item.id, page,
          x: LOGO_PRINT_MARGINS.left + (index % columns) * (item.width_cm + gap),
          y: logoTop + Math.floor(index / columns) * (item.height_cm + gap),
          width: item.width_cm, height: item.height_cm });
      }
      y = logoTop + Math.ceil(count / columns) * (item.height_cm + gap) - gap + groupGap;
      remaining -= count;
    }
  }
  return { cells, headers };
}
