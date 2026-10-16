# SpecsPlaza: verbinding, zoeken en koppelen

De verbindingstest staat ingeklapt bij Bakkerij → Beheer → Grondstoffen.
Alleen actieve managers met de bestaande tweestapsverificatie kunnen de testroute aanroepen.
De test leest maximaal vijf toegankelijke actieve artikelen en de specificatie van het eerste artikel.
Er worden geen grondstoffen, recepturen of specificaties gewijzigd.

## Zoeken bij een grondstof

In het SpecsPlaza-tabblad staat een zoekveld voor productnaam, artikelnummer of leverancier.
Er wordt gezocht in de toegankelijke actieve productspecificaties, los van de vijf artikelen van de verbindingstest.
De naamzoekfunctie gebruikt een brede voorselectie en controleert daarna alle zoekwoorden, ook bij samengestelde namen zoals frambozenpuree.
Een verzoek leest maximaal drie pagina's van vijftig producten; met de vervolgknop worden verdere pagina's opgehaald.
Productvoorbeelden tonen dezelfde gecontroleerde versie-, allergeen- en voedingsgegevens als de verbindingstest.

- `GET /api/recepturen/specsplaza/search?q=...&field=name&skip=0`
- `GET /api/recepturen/specsplaza/product?id=...`

Beide routes vereisen een actieve manager met de bestaande tweestapsverificatie.
De gekozen test- of productieomgeving wordt als klein label bij de resultaten vermeld.
De flow is grondstof → SpecsPlaza → zoeken → Koppelen. Het gekozen product wordt pas als gekoppeld getoond nadat de opslag dit heeft bevestigd.
De uitgebreide specificatie en eigen handmatige gegevens staan standaard ingeklapt.

## Opslag van een koppeling

De koppeling staat één keer op de bestaande gedeelde grondstof, niet op elke receptregel.
Alle recepten en halffabricaten die deze grondstof gebruiken, zien dezelfde koppeling.
`IngredientSpecification.specsPlazaLink` bevat de omgeving, productidentiteit, leverancier, producentartikel, opgehaalde versie, datums en het leveranciersvoorbeeld met alle allergeenstatussen en voedingswaarden.
`specsPlazaId` en `specificationVersion` blijven voor bestaande weergaven beschikbaar.

De leveranciersgegevens zijn een afzonderlijke momentopname. Koppelen vervangt of bevestigt geen eigen gecontroleerde ingrediëntenverklaring, allergenen of voedingswaarden.
Testkoppelingen blijven zichtbaar als Test en geven een controlepunt in de etikettering van elk betrokken recept.
Onbekende waarden en kruisbesmettingsrisico's blijven in de momentopname onderscheiden. Bij een overstap naar productie moet de productidentiteit opnieuw worden gekozen en gecontroleerd.

Opslaan leest eerst de actuele gedeelde opslag en wijzigt alleen de specificatie en eventueel handmatig bewerkte allergenen van de gekozen grondstof.
Actuele prijzen, factuurgegevens, andere grondstoffen en receptverwijzingen blijven behouden.
De functie weigert ontbrekende/dubbele grondstof-ID's en specificaties die sinds het openen zijn gewijzigd.
Fouten bij ophalen of bewaren verschijnen bij de koppeling; de bestaande koppeling blijft dan staan.
De bestaande managerautorisatie en tweestapsverificatie van `/api/recepturen` blijven van toepassing.

## Instellen in Vercel

Vier servervariabelen zijn vereist:

- `SPECSPLAZA_USERNAME`: gebruikersnaam van het ontwikkelaccount.
- `SPECSPLAZA_PASSWORD`: wachtwoord van hetzelfde account.
- `SPECSPLAZA_CLIENT_ID`: OAuth client id, onderaan de pagina API credentials.
- `SPECSPLAZA_CLIENT_SECRET`: OAuth client secret van die pagina.

Deze variabelen krijgen geen `NEXT_PUBLIC_`-prefix. Herdeploy de app na het toevoegen.
De standaardomgeving is `https://api-accp.specsplaza.nl`, zoals afgesproken met FoodBase.
De download bevat lege velden voor zowel test als productie; er zitten geen echte credentials in.

Optioneel:

- `SPECSPLAZA_BASE_URL`: alleen de officiële test- of productie-origin. Gebruik voorlopig de testomgeving.
- `SPECSPLAZA_LICENSE_CODE`: expliciete override voor de licentiecode. Volgens de ontvangen mail mag deze uniek worden gekozen. Standaard genereert de server een stabiele code voor deze app en dit account.
- `SPECSPLAZA_APPLICATION_LICENSE_CODE`: alleen invullen als FoodBase deze verstrekt.

## Gecontroleerd op 16 oktober 2026

Bronnen: ontvangen Insomnia-download en het actuele Customers OpenAPI-schema:
https://api-accp.specsplaza.nl/api/docs/open-api/customers/specsplaza-api.json

De download noemt nog `onlyActive`; het actuele schema gebruikt `isActive`.
De implementatie volgt het actuele schema en gebruikt uitsluitend de Customers-leesroute plus het token-endpoint.
De officiële domeinen worden gecontroleerd en redirects worden geweigerd zodat credentials niet naar een andere host kunnen worden doorgestuurd.
Foutmeldingen tonen geen upstream response bodies, wachtwoorden of tokens.

Allergeenstatussen aanwezig, afwezig, kruisbesmettingsrisico en onbekend blijven onderscheiden.
Ontbrekende voedingswaarden worden niet als nul weergegeven.
Een opgeslagen koppeling is nog geen gecontroleerde import of definitief etiket. De volgende stap is het gecontroleerd verwerken van volledige leveranciersverklaringen in de eigen etiketteringsgegevens.
Testaccounts kunnen door FoodBase bij een verversing van de ontwikkelomgeving worden verwijderd; bestaande recepten blijven daarbij onafhankelijk opgeslagen.

## Validatie

`node --test scripts/specsplaza.test.cjs` test met gesimuleerde antwoorden de verbinding, zoekfilters, samengestelde namen, paginering, invoervalidatie, credential-afscherming, managerautorisatie, productidentiteit en onbekende voedings-/allergeengegevens.
`node --test scripts/specsplaza-link.test.cjs` controleert gedeelde opslag, versie/omgeving, behoud van bestaande gegevens, stale/dubbele ID's, autorisatie, fouten, bevestigde opslag en de compacte ingeklapte weergave.
Een echte verbinding is pas bevestigd na een geslaagde test met het ontwikkelaccount.
