# SpecsPlaza: eerste verbindingstest

De verbindingstest staat ingeklapt bij Bakkerij → Beheer → Grondstoffen.
Alleen actieve managers met de bestaande tweestapsverificatie kunnen de testroute aanroepen.
De test leest maximaal vijf toegankelijke actieve artikelen en de specificatie van het eerste artikel.
Er worden geen grondstoffen, recepturen of specificaties gewijzigd.

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
Dit voorbeeld is nog geen import of definitief etiket; de volgende stap is een gecontroleerde koppeling met een bestaande grondstof, inclusief specificatieversie en brongegevens.
Testaccounts kunnen door FoodBase bij een verversing van de ontwikkelomgeving worden verwijderd; bestaande recepten blijven daarbij onafhankelijk opgeslagen.

## Validatie

`node --test scripts/specsplaza.test.cjs` test de verbinding met gesimuleerde antwoorden en controleert authenticatie, credential-afscherming, managerautorisatie, productidentiteit en onbekende voedings-/allergeengegevens.
Een echte verbinding is pas bevestigd na een geslaagde test met het ontwikkelaccount.
