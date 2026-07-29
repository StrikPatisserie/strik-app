const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ordersPath =
  process.env.VIERDAAGSE_ORDERS_JSON ||
  "/private/tmp/strik-vierdaagse-orders.json";
const productsPath =
  process.env.VIERDAAGSE_PRODUCTS_JSON ||
  "/private/tmp/strik-vierdaagse-products.json";
const outputDir = process.env.VIERDAAGSE_REPORT_DIR || "reports";

const categoryLabels = {
  "koffie-thee": "Koffie & thee",
  "fris-koud": "Fris & koud",
  bakkerij: "Bakkerij",
  gebak: "Gebak",
  hartig: "Hartig",
  overig: "Overig",
};

const locationLabels = {
  terras: "Terras",
  binnen: "Binnen",
  geen_tafel: "Geen tafel",
};

const statusLabels = {
  nieuw: "Nieuw",
  in_productie: "In productie",
  klaar_voor_bediening: "Klaar voor bediening",
  geleverd: "Geleverd",
  geannuleerd: "Geannuleerd",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sortByDateTime(value) {
  return new Date(value || 0).getTime();
}

function dateRangeLabel(dates) {
  const clean = dates.filter(Boolean).sort();
  if (!clean.length) return "";
  return clean[0] === clean[clean.length - 1]
    ? clean[0]
    : `${clean[0]} t/m ${clean[clean.length - 1]}`;
}

function makeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getHour(value) {
  const date = makeDate(value);
  if (!date) return "";
  return String(date.getHours()).padStart(2, "0") + ":00";
}

function minutesBetween(start, end) {
  const startDate = makeDate(start);
  const endDate = makeDate(end);
  if (!startDate || !endDate) return null;
  const minutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  return minutes >= 0 ? minutes : null;
}

function median(values) {
  const clean = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!clean.length) return "";
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2
    ? clean[middle]
    : Math.round((clean[middle - 1] + clean[middle]) / 2);
}

function average(values) {
  const clean = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
  if (!clean.length) return "";
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function addToMap(map, key, create, update) {
  const current = map.get(key) || create();
  update(current);
  map.set(key, current);
}

function countOrders(rows) {
  return new Set(rows.map((row) => row.orderId)).size;
}

function sumQuantity(rows) {
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function isGebakLike(row) {
  if (row.category === "gebak") return true;
  return /gebak|tartelette|tompouce|bossche|bol|punt|slof|parel|passievol|steventje|cheesecake|red velvet|hazelnoot|framboos/i.test(
    row.name
  );
}

function compactNote(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function setColumnWidths(sheet, widths) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
}

function addSheet(workbook, name, rows, widths) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  if (widths) setColumnWidths(sheet, widths);
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function rowsFromMap(map, mapper, sorter = (a, b) => b.Aantal - a.Aantal) {
  return [...map.values()].map(mapper).sort(sorter);
}

const orders = readJson(ordersPath).sort(
  (a, b) => sortByDateTime(a.createdAt) - sortByDateTime(b.createdAt)
);
const products = fs.existsSync(productsPath) ? readJson(productsPath) : [];
const activeOrders = orders.filter((order) => order.status !== "geannuleerd");
const cancelledOrders = orders.filter((order) => order.status === "geannuleerd");

const orderLines = [];
for (const order of orders) {
  for (const item of order.items || []) {
    orderLines.push({
      orderId: order.id,
      date: order.date,
      year: order.year,
      createdAt: order.createdAt,
      hour: getHour(order.createdAt),
      tableNumber: order.tableNumber,
      location: order.location,
      orderStatus: order.status,
      readyAt: order.readyAt || "",
      deliveredAt: order.deliveredAt || "",
      cancelledAt: order.cancelledAt || "",
      createdBy: order.createdBy || "",
      deliveredBy: order.deliveredBy || "",
      note: compactNote(order.note),
      itemId: item.id,
      productId: item.productId,
      name: item.name,
      category: item.category || "overig",
      quantity: Number(item.quantity) || 0,
      itemStatus: item.status || "",
      detail: compactNote(item.detail),
    });
  }
}

const activeLines = orderLines.filter((row) => row.orderStatus !== "geannuleerd");
const activeTotalQuantity = sumQuantity(activeLines);
const gebakLines = activeLines.filter(isGebakLike);
const serviceMinutes = activeOrders
  .map((order) => minutesBetween(order.createdAt, order.deliveredAt))
  .filter((value) => value !== null);
const readyMinutes = activeOrders
  .map((order) => minutesBetween(order.createdAt, order.readyAt))
  .filter((value) => value !== null);

const dates = [...new Set(orders.map((order) => order.date))].sort();
const years = [...new Set(orders.map((order) => order.year))].sort();
const notesCount = activeOrders.filter((order) => compactNote(order.note)).length;

const summaryRows = [
  {
    Onderwerp: "Rapport",
    Waarde: "Vierdaagse Ziekerstraat proeverij",
    Toelichting: "Gemaakt uit WordPress Vierdaagse-orders.",
  },
  {
    Onderwerp: "Jaar",
    Waarde: years.join(", "),
    Toelichting: "",
  },
  {
    Onderwerp: "Periode",
    Waarde: dateRangeLabel(dates),
    Toelichting: "",
  },
  {
    Onderwerp: "Bonnen / briefjes totaal",
    Waarde: orders.length,
    Toelichting: "Alle bonnen inclusief geannuleerd.",
  },
  {
    Onderwerp: "Bonnen meegeteld",
    Waarde: activeOrders.length,
    Toelichting: "Exclusief geannuleerde bonnen.",
  },
  {
    Onderwerp: "Geannuleerde bonnen",
    Waarde: cancelledOrders.length,
    Toelichting: "",
  },
  {
    Onderwerp: "Bonregels meegeteld",
    Waarde: activeLines.length,
    Toelichting: "Aantal regels op bonnen, exclusief geannuleerd.",
  },
  {
    Onderwerp: "Producten/stuks meegeteld",
    Waarde: activeTotalQuantity,
    Toelichting: "Som van aantallen op alle bonregels, exclusief geannuleerd.",
  },
  {
    Onderwerp: "Gebak/patisserie stuks",
    Waarde: sumQuantity(gebakLines),
    Toelichting: "Categorie Gebak plus duidelijk gebakachtige namen.",
  },
  {
    Onderwerp: "Bonnen met notitie",
    Waarde: notesCount,
    Toelichting: "Handig om uitzonderingen voor volgend jaar te lezen.",
  },
  {
    Onderwerp: "Gemiddeld producten per bon",
    Waarde: Math.round((activeTotalQuantity / activeOrders.length) * 10) / 10,
    Toelichting: "",
  },
  {
    Onderwerp: "Gem. minuten tot klaar",
    Waarde: average(readyMinutes),
    Toelichting: "Alleen bonnen met klaar-tijd.",
  },
  {
    Onderwerp: "Mediaan minuten tot klaar",
    Waarde: median(readyMinutes),
    Toelichting: "Alleen bonnen met klaar-tijd.",
  },
  {
    Onderwerp: "Gem. minuten tot geleverd",
    Waarde: average(serviceMinutes),
    Toelichting: "Alleen bonnen met geleverd-tijd.",
  },
  {
    Onderwerp: "Mediaan minuten tot geleverd",
    Waarde: median(serviceMinutes),
    Toelichting: "Alleen bonnen met geleverd-tijd.",
  },
];

const byProduct = new Map();
const byProductDetail = new Map();
const byCategory = new Map();
const byDate = new Map();
const byDateCategory = new Map();
const byHour = new Map();
const byLocation = new Map();
const byTable = new Map();
const byCreator = new Map();
const byOrderSize = new Map();
const byProductDate = new Map();

for (const row of activeLines) {
  addToMap(
    byProduct,
    row.productId,
    () => ({
      productId: row.productId,
      name: row.name,
      category: row.category,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  const detailKey = `${row.productId}\t${row.detail}`;
  addToMap(
    byProductDetail,
    detailKey,
    () => ({
      productId: row.productId,
      name: row.name,
      category: row.category,
      detail: row.detail || "(zonder detail)",
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  addToMap(
    byCategory,
    row.category,
    () => ({
      category: row.category,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  addToMap(
    byDate,
    row.date,
    () => ({
      date: row.date,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  const dateCategoryKey = `${row.date}\t${row.category}`;
  addToMap(
    byDateCategory,
    dateCategoryKey,
    () => ({
      date: row.date,
      category: row.category,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  const hourKey = `${row.date}\t${row.hour}`;
  addToMap(
    byHour,
    hourKey,
    () => ({
      date: row.date,
      hour: row.hour,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  addToMap(
    byLocation,
    row.location,
    () => ({
      location: row.location,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  addToMap(
    byTable,
    row.tableNumber,
    () => ({
      tableNumber: row.tableNumber,
      location: row.location,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  addToMap(
    byCreator,
    row.createdBy || "(onbekend)",
    () => ({
      createdBy: row.createdBy || "(onbekend)",
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );

  const productDateKey = `${row.date}\t${row.productId}`;
  addToMap(
    byProductDate,
    productDateKey,
    () => ({
      date: row.date,
      productId: row.productId,
      name: row.name,
      category: row.category,
      quantity: 0,
      lines: 0,
      orderIds: new Set(),
    }),
    (entry) => {
      entry.quantity += row.quantity;
      entry.lines += 1;
      entry.orderIds.add(row.orderId);
    }
  );
}

for (const order of activeOrders) {
  const quantity = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
  const bucket = quantity >= 8 ? "8+" : String(quantity);
  addToMap(
    byOrderSize,
    bucket,
    () => ({
      bucket,
      orders: 0,
      quantity: 0,
    }),
    (entry) => {
      entry.orders += 1;
      entry.quantity += quantity;
    }
  );
}

const productRows = rowsFromMap(byProduct, (entry) => ({
  Categorie: categoryLabels[entry.category] || entry.category,
  Product: entry.name,
  Aantal: entry.quantity,
  "Aantal bonnen": entry.orderIds.size,
  "Aantal bonregels": entry.lines,
  "% van stuks": pct(entry.quantity, activeTotalQuantity),
}));

const gebakRows = rowsFromMap(
  new Map([...byProduct].filter(([, entry]) => isGebakLike(entry))),
  (entry) => ({
    Product: entry.name,
    Categorie: categoryLabels[entry.category] || entry.category,
    Aantal: entry.quantity,
    "Aantal bonnen": entry.orderIds.size,
    "Aantal bonregels": entry.lines,
    "% van gebak/patisserie": pct(entry.quantity, sumQuantity(gebakLines)),
  })
);

const detailRows = rowsFromMap(
  byProductDetail,
  (entry) => ({
    Categorie: categoryLabels[entry.category] || entry.category,
    Product: entry.name,
    Detail: entry.detail,
    Aantal: entry.quantity,
    "Aantal bonnen": entry.orderIds.size,
    "Aantal bonregels": entry.lines,
  }),
  (a, b) => b.Aantal - a.Aantal || a.Product.localeCompare(b.Product, "nl")
);

const categoryRows = rowsFromMap(byCategory, (entry) => ({
  Categorie: categoryLabels[entry.category] || entry.category,
  Aantal: entry.quantity,
  "Aantal bonnen": entry.orderIds.size,
  "Aantal bonregels": entry.lines,
  "% van stuks": pct(entry.quantity, activeTotalQuantity),
}));

const dateRows = rowsFromMap(
  byDate,
  (entry) => ({
    Datum: entry.date,
    "Aantal bonnen / briefjes": entry.orderIds.size,
    "Aantal stuks": entry.quantity,
    "Aantal bonregels": entry.lines,
    "Gem. stuks per bon":
      Math.round((entry.quantity / entry.orderIds.size) * 10) / 10,
  }),
  (a, b) => a.Datum.localeCompare(b.Datum)
);

const dateCategoryRows = rowsFromMap(
  byDateCategory,
  (entry) => ({
    Datum: entry.date,
    Categorie: categoryLabels[entry.category] || entry.category,
    "Aantal bonnen": entry.orderIds.size,
    "Aantal stuks": entry.quantity,
    "Aantal bonregels": entry.lines,
  }),
  (a, b) =>
    a.Datum.localeCompare(b.Datum) || b["Aantal stuks"] - a["Aantal stuks"]
);

const hourRows = rowsFromMap(
  byHour,
  (entry) => ({
    Datum: entry.date,
    Uur: entry.hour,
    "Aantal bonnen / briefjes": entry.orderIds.size,
    "Aantal stuks": entry.quantity,
    "Aantal bonregels": entry.lines,
  }),
  (a, b) => a.Datum.localeCompare(b.Datum) || a.Uur.localeCompare(b.Uur)
);

const locationRows = rowsFromMap(byLocation, (entry) => ({
  Locatie: locationLabels[entry.location] || entry.location,
  "Aantal bonnen / briefjes": entry.orderIds.size,
  "Aantal stuks": entry.quantity,
  "Aantal bonregels": entry.lines,
  "% van bonnen": pct(entry.orderIds.size, activeOrders.length),
}));

const tableRows = rowsFromMap(
  byTable,
  (entry) => ({
    Tafel: entry.tableNumber,
    Locatie: locationLabels[entry.location] || entry.location,
    "Aantal bonnen / briefjes": entry.orderIds.size,
    "Aantal stuks": entry.quantity,
    "Aantal bonregels": entry.lines,
  }),
  (a, b) => b["Aantal bonnen / briefjes"] - a["Aantal bonnen / briefjes"]
);

const creatorRows = rowsFromMap(byCreator, (entry) => ({
  "Aangemaakt door": entry.createdBy,
  "Aantal bonnen / briefjes": entry.orderIds.size,
  "Aantal stuks": entry.quantity,
  "Aantal bonregels": entry.lines,
}));

const orderSizeRows = [...byOrderSize.values()]
  .sort((a, b) => {
    const av = a.bucket === "8+" ? 8 : Number(a.bucket);
    const bv = b.bucket === "8+" ? 8 : Number(b.bucket);
    return av - bv;
  })
  .map((entry) => ({
    "Stuks op bon": entry.bucket,
    "Aantal bonnen / briefjes": entry.orders,
    "Aantal stuks": entry.quantity,
    "% van bonnen": pct(entry.orders, activeOrders.length),
  }));

const productDateRows = rowsFromMap(
  byProductDate,
  (entry) => ({
    Datum: entry.date,
    Categorie: categoryLabels[entry.category] || entry.category,
    Product: entry.name,
    Aantal: entry.quantity,
    "Aantal bonnen": entry.orderIds.size,
    "Aantal bonregels": entry.lines,
  }),
  (a, b) =>
    a.Datum.localeCompare(b.Datum) ||
    a.Categorie.localeCompare(b.Categorie, "nl") ||
    b.Aantal - a.Aantal
);

const ordersRows = orders.map((order) => {
  const quantity = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
  return {
    Datum: order.date,
    "Aangemaakt om": order.createdAt,
    "Bon ID": order.id,
    Tafel: order.tableNumber,
    Locatie: locationLabels[order.location] || order.location,
    Status: statusLabels[order.status] || order.status,
    "Aantal regels": (order.items || []).length,
    "Aantal stuks": quantity,
    Notitie: compactNote(order.note),
    "Aangemaakt door": order.createdBy || "",
    "Klaar om": order.readyAt || "",
    "Geleverd om": order.deliveredAt || "",
    "Geannuleerd om": order.cancelledAt || "",
    "Min. tot klaar": minutesBetween(order.createdAt, order.readyAt) ?? "",
    "Min. tot geleverd": minutesBetween(order.createdAt, order.deliveredAt) ?? "",
  };
});

const lineRows = orderLines.map((row) => ({
  Datum: row.date,
  Uur: row.hour,
  "Bon ID": row.orderId,
  Tafel: row.tableNumber,
  Locatie: locationLabels[row.location] || row.location,
  "Bon status": statusLabels[row.orderStatus] || row.orderStatus,
  Categorie: categoryLabels[row.category] || row.category,
  Product: row.name,
  Detail: row.detail,
  Aantal: row.quantity,
  "Item status": row.itemStatus,
  Notitie: row.note,
  "Aangemaakt door": row.createdBy,
  "Geleverd door": row.deliveredBy,
  "Aangemaakt om": row.createdAt,
}));

const notesRows = activeOrders
  .filter((order) => compactNote(order.note))
  .map((order) => ({
    Datum: order.date,
    "Aangemaakt om": order.createdAt,
    "Bon ID": order.id,
    Tafel: order.tableNumber,
    Locatie: locationLabels[order.location] || order.location,
    Status: statusLabels[order.status] || order.status,
    Notitie: compactNote(order.note),
    Producten: (order.items || [])
      .map((item) => `${item.quantity}x ${item.name}${item.detail ? ` (${item.detail})` : ""}`)
      .join(", "),
  }));

const cancelledRows = cancelledOrders.map((order) => ({
  Datum: order.date,
  "Bon ID": order.id,
  Tafel: order.tableNumber,
  Locatie: locationLabels[order.location] || order.location,
  "Aangemaakt om": order.createdAt,
  "Geannuleerd om": order.cancelledAt || "",
  Notitie: compactNote(order.note),
  Producten: (order.items || [])
    .map((item) => `${item.quantity}x ${item.name}${item.detail ? ` (${item.detail})` : ""}`)
    .join(", "),
}));

const productsRows = products.map((product) => ({
  Product: product.name,
  Categorie: categoryLabels[product.category] || product.category,
  Badge: product.badge || "",
  "Heeft detail": product.needsDetail ? "ja" : "",
  "Detail label": product.detailLabel || "",
  "Detail opties": (product.detailOptions || []).join(", "),
  "Modifier label": product.modifierLabel || "",
  "Modifier opties": (product.modifierOptions || []).join(", "),
}));

const workbook = XLSX.utils.book_new();
workbook.Props = {
  Title: "Vierdaagse Ziekerstraat proeverij rapport",
  Subject: "Strik Team App Vierdaagse orders",
  Author: "Strik Team App",
  CreatedDate: new Date(),
};

addSheet(workbook, "Samenvatting", summaryRows, [28, 22, 62]);
addSheet(workbook, "Gebak per soort", gebakRows, [32, 18, 12, 16, 16, 18]);
addSheet(workbook, "Producten totaal", productRows, [18, 34, 12, 16, 16, 14]);
addSheet(workbook, "Product per dag", productDateRows, [14, 18, 34, 12, 16, 16]);
addSheet(workbook, "Details opties", detailRows, [18, 34, 34, 12, 16, 16]);
addSheet(workbook, "Categorieen", categoryRows, [20, 12, 16, 16, 14]);
addSheet(workbook, "Per dag", dateRows, [14, 22, 14, 16, 18]);
addSheet(workbook, "Dag x categorie", dateCategoryRows, [14, 20, 16, 14, 16]);
addSheet(workbook, "Per uur", hourRows, [14, 10, 22, 14, 16]);
addSheet(workbook, "Locatie", locationRows, [16, 22, 14, 16, 14]);
addSheet(workbook, "Tafels", tableRows, [12, 16, 22, 14, 16]);
addSheet(workbook, "Bon grootte", orderSizeRows, [14, 22, 14, 14]);
addSheet(workbook, "Medewerkers", creatorRows, [24, 22, 14, 16]);
addSheet(workbook, "Bonnen", ordersRows, [14, 24, 28, 10, 16, 18, 14, 14, 42, 20, 24, 24, 24, 14, 16]);
addSheet(workbook, "Bonregels", lineRows, [14, 10, 28, 10, 16, 18, 18, 34, 34, 10, 14, 42, 20, 20, 24]);
addSheet(workbook, "Notities", notesRows, [14, 24, 28, 10, 16, 18, 60, 70]);
addSheet(workbook, "Geannuleerd", cancelledRows, [14, 28, 10, 16, 24, 24, 48, 70]);
addSheet(workbook, "Productlijst", productsRows, [34, 18, 10, 12, 24, 50, 24, 50]);

fs.mkdirSync(outputDir, { recursive: true });

const yearLabel = years.length === 1 ? years[0] : years.join("-");
const xlsxPath = path.join(
  outputDir,
  `vierdaagse-ziekerstraat-proeverij-rapport-${yearLabel}.xlsx`
);
const mdPath = path.join(
  outputDir,
  `vierdaagse-ziekerstraat-proeverij-samenvatting-${yearLabel}.md`
);

XLSX.writeFile(workbook, xlsxPath);

const topGebak = gebakRows
  .slice(0, 10)
  .map((row, index) => `${index + 1}. ${row.Product}: ${row.Aantal}`)
  .join("\n");
const topProducts = productRows
  .slice(0, 10)
  .map((row, index) => `${index + 1}. ${row.Product}: ${row.Aantal}`)
  .join("\n");

const markdown = `# Vierdaagse Ziekerstraat Proeverij ${yearLabel}

Bron: WordPress Vierdaagse-orders uit de Strik Team App.

## Kerncijfers

- Periode: ${dateRangeLabel(dates)}
- Bonnen / briefjes totaal: ${orders.length}
- Bonnen meegeteld excl. geannuleerd: ${activeOrders.length}
- Geannuleerd: ${cancelledOrders.length}
- Bonregels meegeteld: ${activeLines.length}
- Producten/stuks meegeteld: ${activeTotalQuantity}
- Gebak/patisserie stuks: ${sumQuantity(gebakLines)}
- Bonnen met notitie: ${notesCount}
- Gemiddeld aantal stuks per bon: ${Math.round((activeTotalQuantity / activeOrders.length) * 10) / 10}
- Gem. minuten tot klaar: ${average(readyMinutes)}
- Mediaan minuten tot klaar: ${median(readyMinutes)}
- Gem. minuten tot geleverd: ${average(serviceMinutes)}
- Mediaan minuten tot geleverd: ${median(serviceMinutes)}

## Top 10 Gebak/Patisserie

${topGebak}

## Top 10 Producten Totaal

${topProducts}

## Bestanden

- Excel: ${xlsxPath}
- Samenvatting: ${mdPath}
`;

fs.writeFileSync(mdPath, markdown, "utf8");

console.log(JSON.stringify({ xlsxPath, mdPath, orders: orders.length, activeOrders: activeOrders.length, activeTotalQuantity }, null, 2));
