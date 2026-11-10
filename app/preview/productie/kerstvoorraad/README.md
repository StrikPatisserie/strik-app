# Local Christmas stock overview

Open `/preview/productie?view=kerstvoorraad` with the development server running.
The production menu now opens a holiday chooser first. Its local counterpart is
`/preview/productie?view=feestdagen`, with the existing B2B destination and the
forecast overview. Authenticated local use also supports
`/bakkerij/productie/feestdagen/kerstvoorraad`. The forecast menu item and this
route remain development-only while sales still come from a local Excel.
The existing page rejects production access. The UI is one filtered overview,
without scheduling or other workspace tabs. Product forecast adjustments persist in
this browser only. Production and recipe trial links reset on reload.

## Forecast sources

- `source.server.ts` reads `Downloads/KERST 2025/kerst final goed.xlsx` in development only. It never changes the workbook or commits its sales rows. This owner-confirmed final export supplies the complete week 47–53 basis with subcodes, excluding Wijchen.
- Cash-it is the owner's accepted export without Wijchen; Bake-it covers external invoice sales. The supplied period is week 47–53. Channel-specific article numbers remain separate.
- The period scenario is 16 November–31 December 2026. Growth defaults to +10%; 0, +5, +8 and +15% are selectable. The same uplift applies to a supplied week-52 baseline, rounded up to whole pieces.
- `week 52 kerst.xlsx` supplies the isolated week-52 basis. The owner confirmed on 10 November that it also excludes Wijchen. Cash-it uses the `aantal verkocht` column, Bake-it uses `netto productie aantallen verkocht 2025`. Subcodes identify cake sizes. The source week is 22–28 December 2025, projected to 21–27 December 2026. Missing/ambiguous quantities and week totals exceeding the period basis stay flagged. An absent article in a complete weekly export means zero only for a product with known historical coverage.
- `week52.ts` assigns a source row once using the channel-specific number and, where necessary, name and size. The marzipan 10–12p family keeps other size subcodes out. The period supplement of 41 small KB invoice cakes is not automatically copied to week 52. The weekly invoice export has its own actual quantities.
- `variants.ts` normalizes equivalent subcode spellings between Cash-it and Bake-it. Each product and subcode keeps its own period and week-52 quantity. Stollen are separate large/small rows, as are cake sizes. An article number alone still cannot disambiguate future receipts without a size.
- The overview contains historical food sales and the current coded food catalogue. Missing historical sales remain unknown. Services, packaging, shop supplies, raw materials and café drinks are excluded.
- Six categories: Kerst, Gebak, Taart, Slof/schnitt/vlaai, Bakkant and Overig. Christmas takes priority over a regular category. Individual slofjes/vlaaitjes and petit gâteau belong to Gebak; whole slofs, schnitts and vlaaien share a category. Petit fleur/crème, truffles and similar products belong to Overig. Review renamed and packaged products before using their quantities.
- The visible selection excludes oliebollen, apple beignets, sugar-stick boxes, chocolate letters in Overig and Christmas chocolate work. Every category requires a positive, calculable forecast. Minimum forecasts are 100 for Gebak/Bakkant/Overig and 20 for Taart. Slof/schnitt/vlaai and Christmas have no further minimum. Missing, zero, negative and unconverted units are omitted. These rules apply before search and volume filters and follow the chosen uplift.
- Standard marzipan cake variants combine into one 10–12-person row before uplift, rounding and the minimum threshold. Explicit subcodes restrict the family to 10–12p. Other sizes, per-person sales and Christmas variants stay separate. The detail panel retains every member and its source quantity. Family stock is deliberately unknown until the individual variants can be reconciled; it never borrows one variant's stock as a family total.
- Fractional sales from whole-cake article groups (including vlaaien/slofs) are valid source quantities: sum them, apply uplift and round once. Per-person, weighted and uncertain package units remain unconverted. The folder's cookie and meringue wreath rows point to the actual named sales rows, avoiding empty duplicate entries.
- The final period export supersedes the earlier manual Xmas size supplement. It contains 47 small / 27.5 large chipolata Cash-it cakes, 103 small / 25 large KB cakes and 41 small KB invoice cakes. Fractional sales are rounded after uplift. The legacy supplement applies only to unsplit source rows with its expected original totals. Format rows require explicit stock/recept mapping, because an article number alone does not identify size.
- It opens on hard runners (at least 1,000 source units over the period). Medium is 300–999 and low is under 300. Unknown units have no volume band. Growth does not change those bands. Category selection and typing in search switch to all volumes; category, department and status filters still apply. Search also covers former/current names and both article namespaces.

## Product adjustments and 2026 replacements

Click a product or forecast to set its own growth percentage or override either
forecast with a final whole-piece count. Empty values follow the source and
uplift. Explicit zero remains zero. A manual total is not uplifted a second time.
Week 52 must fit within the full-period forecast. Later changes to general growth
leave manual counts and product-specific percentages in place.

A 2026 replacement retains the stable historical ID and source sales. Its new
name is displayed with the original 2025 product beneath it. Recipe/stock links
are cleared when changing the replacement, including on reload. Receipt demand
uses the new Cash-it number and requires the existing live inventory validation.
An absent new number never reuses the retired article for live subtraction.

Only the forecast settings are saved to versioned localStorage. They do not
synchronize between browsers or devices. `adjustments.ts` also accepts
owner-approved, ID-keyed defaults entered through Codex. No change is written
back to an Excel, catalogue, recipe, stock count or production task.

The row's small trash icon opens a confirmation before omitting a product.
Omissions persist in the same browser. The `Weggelaten` filter lists them with
a restore action, even if the chosen uplift would now exclude the product.

## Production and stock

`productionOverview.ts` reuses the existing `inventoryOverview` rules. It keeps
last completed production, last physical count and expected current balance
separate. Only completed output tasks count as production; batch deduplication
and stock-use exclusions come from the existing inventory model.

Expected bakery stock is the last physical count plus recorded production minus
dispatch. A missing count, missing dispatch coverage, intraday checkpoint,
negative balance or ambiguous product link leaves current stock unknown. This
is bakery dispatch stock, not a claim about point-of-sale retail stock.

The initial production, recipes and counts are explicitly labelled examples.
The `Productie ophalen` button makes authenticated, read-only GET requests to
`/api/productie/voorraad` and `/api/productie`; it preserves the existing app
permissions. A failed read leaves the labelled examples visible. No stock,
recipe or production write endpoint is used.

Automatic product matching uses an exact, unique current Cash-it article number
and a stock product measured in pieces. It does not guess by name or old
Bake-it number. An explicit production-item selection can resolve other matches
locally. Missing recipes and unit problems remain visible in the same table.

## Remaining campaign demand

`campaignNeed.ts` subtracts finalized dispatch quantities from the uplifted
period forecast, from 16 November through yesterday (never beyond 31 December).
Today's requirement remains needed today. Reimported daily snapshots replace
older versions; neither future orders nor deliveries before 16 November count.
This is remaining dispatch demand, not remaining production: available stock is
still shown separately and has not been deducted again.

Missing/unreadable days, unverified article/unit links, aggregate cake families
and unresolved size variants return an explicit control marker instead of zero.
Live matching requires a production stock link in pieces with factor 1. The
subcode cake report gives forecast sizes but cannot split future receipts that
only contain the common parent article number.

The local date selector uses clearly labelled example receipt snapshots for
16–18 November; choose 19 November to inspect the decreasing counter. Choosing
20 November demonstrates a missing bondag. Actual-date state advances at
Amsterdam midnight; live receipt reads refresh every minute while visible and
online, and on reconnect. A read failure invalidates the counter without
silently retaining a claim of fresh live data.

`/api/preview/kerstvoorraad/bonnen` is development-only and uses the existing
production authorization and read-only, deduplicated dispatch archive. It
returns article/day aggregates, without customer details, prices or mail. No
new tables, permissions or production writes are introduced. Local unauthenticated
browser testing receives 403 and retains labelled examples.

## Limits

Reconciliation of future orders against dispatch,
shelf-life, production lead times, future stock depletion and capacity
scheduling are not implemented here.
A local forecast edit or recipe association does not change the real catalogue.
The underlying shared-preparation calculation remains available in `forecast.ts`
for validation and later use, but the overview does not create a production plan.

Checks: `node --test tests/christmas-stock-preview.test.cjs`.
