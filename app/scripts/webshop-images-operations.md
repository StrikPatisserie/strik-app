# Foto-import

De Apps Script-trigger gebruikt `gmail-webshop-images-import.gs`. Publiceer eerst
de app (inclusief `/webshop-images/prepare`), vervang daarna alleen het fotobestand
in Apps Script. Behoud de bestaande `IMPORT_KEY` en trigger. De functie
`controleerWebshopAfbeeldingenKoppeling` controleert voorbereiden en importeren met
een synthetische foto en `dryRun=1`; deze schrijft geen bonnen, foto's of labels.

- Bijlagen van 500 kB tot 4 MB worden afzonderlijk binair voorbereid, met maximaal
  2400 pixels en 500 kB als resultaat. De originele bijlage blijft in Gmail.
- Niet meer dan vier bijlagen per mail; bekende handtekeningbestanden tellen niet
  mee. Een te grote of extra bijlage wordt nooit stilzwijgend overgeslagen.
- Alleen een expliciete lever-/afhaaldatum geldt; een datum uit een mailkop niet.
  Een levering meer dan zeven dagen vóór ontvangst vraagt handmatige controle.
- Tijdelijke netwerkfouten, HTTP 408/429 en serverfouten: maximaal drie pogingen,
  minstens twee uur uit elkaar, binnen de bestaande importvensters.
- Onvolledige/onduidelijke inhoud of uitgeputte pogingen: `Fout` én
  `Foto controleren`, zichtbaar in de inbox. De foutreden staat in het
  uitvoeringslogboek. Na correctie kan `Foto controleren` worden verwijderd om
  opnieuw te proberen, of een foto via de app bij de juiste bon worden opgeslagen.
- Pas na bevestiging van alle foto's: `Ingelezen`, foutlabels weg en archiveren.
  De bestaande importidentificatie blijft behouden om dubbel verwerken te voorkomen.

Controle: `node --test tests/webshop-photos.test.cjs app/scripts/test-gmail-import-windows.cjs`.
