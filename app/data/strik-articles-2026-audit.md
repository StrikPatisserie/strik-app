# Artikelnummerkoppeling 2026

Bron: `STRIK artikelen - FINAL 2026.xlsx`, werkblad `Blad1`. De catalogus is gegenereerd met `node app/scripts/build-strik-article-catalog.cjs <pad-naar-excel>`.

- 1.185 artikelregels met omschrijving.
- 808 regels met een eenduidig nieuw artikelnummer van vijf of zes cijfers na twee door Strik bevestigde correcties.
- 377 regels zonder bruikbaar nieuw nummer (leeg of `9999999999`); deze worden niet automatisch gekoppeld.
- Cake Grandeurs (5st) is gecorrigeerd van `40350` naar `40351`; `40350` blijft bij Kruidcake.
- Chocolade Bars Bruce is gecorrigeerd van `70990` naar `70991`; `70990` blijft bij Bonbons voorverpakt Sanadome.
- Oude nummers `106` en `908804` komen elk bij meer dan één eenduidig nieuw artikel voor. Migratie op alleen dat oude nummer wordt geweigerd.
- Sommige oude nummers komen ook als nieuw nummer voor bij een ander artikel, bijvoorbeeld `100107`, `100108` en `160802`. Alleen een exacte overeenkomst van de artikelnaam kan deze gevallen onderscheiden.

De app bewaart het nummer dat op een contantbon staat. Als de bron eenduidig is, wordt daarnaast het nieuwe catalogusnummer toegevoegd. Bij twijfel blijft het oorspronkelijke nummer staan en wordt niets stilzwijgend omgenummerd. De twee bevestigde correcties zijn in de generator vastgelegd, zodat opnieuw genereren ze niet ongedaan maakt; het aangeleverde Excelbestand zelf is niet aangepast.
