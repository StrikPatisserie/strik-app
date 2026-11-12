import { LOGO_PRINT_MARGINS, validateLogoPrintItems, type PrintLogo } from "./model";

type LogoCell = { id: string; page: number; x: number; y: number; width: number; height: number };
const gap = 0.3;
const headerHeight = 1.3;
const headerGap = 0.15;
const top = 0.5;

export function packedLogoPrintLayout(items: PrintLogo[]) {
  validateLogoPrintItems(items);
  const cells: LogoCell[] = [];
  const headers: LogoCell[] = [];
  const right = 21 - LOGO_PRINT_MARGINS.right;
  const bottom = 29.7 - LOGO_PRINT_MARGINS.bottom;
  let page = 0;
  let x = LOGO_PRINT_MARGINS.left;
  let y = top;
  let rowHeight = 0;

  for (const item of items) {
    let remaining = item.quantity;
    while (remaining > 0) {
      const columns = Math.floor((right - x + gap + 0.000001) / (item.width_cm + gap));
      if (columns < 1 || right - x < 3 - 0.000001) {
        x = LOGO_PRINT_MARGINS.left;
        y += rowHeight + gap;
        rowHeight = 0;
        continue;
      }
      if (y + headerHeight + headerGap + item.height_cm > bottom + 0.000001) {
        page++;
        if (page >= 100) throw Error("Dit zijn meer dan 100 printvellen. Kies minder logo’s of een kleiner formaat.");
        x = LOGO_PRINT_MARGINS.left;
        y = top;
        rowHeight = 0;
        continue;
      }
      const count = Math.min(columns, remaining);
      const width = Math.max(3, count * item.width_cm + (count - 1) * gap);
      headers.push({ id: item.id, page, x, y, width, height: headerHeight });
      for (let index = 0; index < count; index++) {
        cells.push({ id: item.id, page, x: x + index * (item.width_cm + gap), y: y + headerHeight + headerGap,
          width: item.width_cm, height: item.height_cm });
      }
      x += width + gap;
      rowHeight = Math.max(rowHeight, headerHeight + headerGap + item.height_cm);
      remaining -= count;
    }
  }
  return { cells, headers };
}
