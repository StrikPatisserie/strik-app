# Tamigo-correcties

De controlepagina en afgeschermde correctieflow zijn op 23 oktober 2026 gepubliceerd. Terugschrijven is niet geactiveerd en de productiemigratie voor correctiehistorie is nog niet uitgevoerd. De hieronder beschreven correctieflow is getest met fictieve diensten; er is nog geen echte wijziging in Tamigo beproefd. Nieuwe diensten, verlof, ziekte, salarisexports en het openen/sluiten van dagen vallen buiten deze functie.

## API-onderzoek 28 oktober 2026

De reactie van Tamigo van 27 oktober is naast de actuele Swagger gelegd. In de op 28 oktober opgehaalde officiële Swagger staan een versie-2-statusroute en afzonderlijke wijzigingslogroutes. De oudere dagstatusroute uit de eerdere PDF-documentatie was voor onze applicatiesessie de verkeerde routekeuze. Een fout in de body is hiermee niet aangetoond: het betreft GET zonder body, en de oude route blijft ook met `Content-Type: application/json` HTTP 401 geven.

Alleen-lezen vergelijking met verse applicatiesessies:

| Bron | Standaardkoppeling | Loonkoppeling |
| --- | --- | --- |
| `GET /v2/Departments/application/?includeParents=true` | HTTP 200 | HTTP 403 |
| Oude `GET /actualshifts/status/day/{date}/?departmentId={id}` | HTTP 401, lege antwoordbody | HTTP 403 |
| `GET /v2/ActualShifts/status/period/{startDate}/{endDate}/?departmentId={id}` | **HTTP 200** | **HTTP 200** |
| `GET /v2/ShiftsLog/ChangedShifts?fromDate={date}&departmentId={id}&planStatus=actual` | **HTTP 200** | Niet beproefd |
| `GET /v2/ShiftsLog/{shiftId}` | **HTTP 200** | Niet beproefd |
| `GET /v2/Shifts/` | HTTP 200 | Op 27 oktober bevestigd met HTTP 200 |

De verklaring van Tamigo over ontbrekende afdelingsrechten op de loonkoppeling is bevestigd. Die sleutel hoeft niet te worden gebruikt voor de urencontrole; de standaardkoppeling heeft de afdelingsrechten al. De versie-2-dagstatus werkt in de proef echter met beide bestaande sleutels. Er zijn geen rechten uitgebreid en geen gebruikerswachtwoorden toegevoegd.

De statusproef voor 20–21 oktober gaf twee regels met de velden `Date`, `Open`, `Status`. Beide dagen hadden `Open: true, Status: 1`. De code gebruikt nu de versie-2-route en selecteert **de aangevraagde datum**, nooit zomaar de eerste periode-regel. Volgens de Swagger zijn de statussen `1 = Open`, `2 = Closed`, `3 = SignedOff`, `4 = Validated`. Alleen expliciet `Open: true` én status `1` laten de dagcontrole slagen. Gesloten, afgetekende en gevalideerde dagen blijven geblokkeerd. Ontbrekende, dubbele, onbekende of tegenstrijdige statusinformatie blijft onbekend en blokkeert opslaan. Kalendergrenzen en Europe/Amsterdam worden expliciet behandeld.

`GET /v2/Shifts/` bevestigt onder meer `ShiftId`, `EmployeeId`, `DepartmentId`, `StartDateTime`, `EndDateTime`, `BreakCode`, `BreakCodeHours`, `ShiftHours`, `Comments`, `Comments2`, `PlanStatusCodeId`, `ShiftActivityId`, `IsAvailable` en `IsExchange`. De nieuwe wijzigingsroutes bevestigen onder meer `ModifiedOn`, `DeletedOn`, respectievelijk `ActionDateTime`, `Action`, `ModifiedByUser`, `OriginalStateOfShift` en `CurrentStateOfShift`. Alleen veldnamen en aantallen zijn voor deze diagnose vastgelegd; er zijn geen echte namen, opmerkingen of urenregistraties in een AI-dienst of diagnoserapport gezet. De wijzigingsroutes zijn nog niet ingebouwd in de gebruikersinterface of de bevestigingsflow.

Na de adapterwijziging is de echte oktobermaand opnieuw alleen-lezen opgehaald: 13 afdelingen, 437 unieke geplande en 449 unieke werkelijke diensten. De dagstatuscontrole is beschikbaar, de afzonderlijke steekproefdag is open en de oorspronkelijke registraties zijn ongewijzigd gebleven. De 106 gerichte tests, ESLint, productiebuild en TypeScript-controle slagen lokaal.

De exacte schrijfrechten en het behoud van alle dienstvelden bij de gekozen schrijfroutes blijven **onbeproefd**. Tamigo bevestigt per mail dat PUT kan, maar er is geen echte correctie verzonden. De afgeschermde correctiehistorie en de activeringsschakelaar blijven afzonderlijke voorwaarden. HTTP 401 wordt niet meer automatisch als ontbrekend recht uitgelegd; de app onderscheidt sessie/aanvraagcontrole van HTTP 403 voor toestemming. Een onzekere uitkomst na verzending blijft geblokkeerd en wordt nooit automatisch herhaald.

### Volledige foutgevende call (sleutels afgeschermd)

Authenticatie: `POST https://api.tamigo.com/v2/Login/Application`, JSON `{"Name":"<bestaande applicatienaam>","Key":"<geheime applicatiesleutel>"}`. Het teruggegeven `SessionToken` wordt uitsluitend als header gebruikt.

```http
GET https://api.tamigo.com/actualshifts/status/day/2026-10-20/?departmentId=<departmentId>
Accept: application/json
Content-Type: application/json
x-tamigo-token: <SessionToken>
```

Geen requestbody. Resultaat met standaardkoppeling: HTTP 401, geen Content-Type, lege antwoordbody. Het weglaten van de Content-Type-header gaf hetzelfde resultaat. Dezelfde sessie werkt op de v2-statusroute met dezelfde departmentId:

```http
GET https://api.tamigo.com/v2/ActualShifts/status/period/2026-10-20/2026-10-21/?departmentId=<departmentId>
Accept: application/json
Content-Type: application/json
x-tamigo-token: <SessionToken>
```

### Antwoordvoorstel voor Tamigo

> Goedemorgen Calvin,
>
> Dank voor je uitleg. De loonkoppeling heeft inderdaad geen afdelingsrechten (HTTP 403); onze standaardkoppeling heeft die wel. We gebruiken de standaardkoppeling voor deze controle.
>
> De HTTP 401 kwam van `GET /actualshifts/status/day/2026-10-20/?departmentId=<departmentId>`. Authenticatie is via `/v2/Login/Application`, daarna `x-tamigo-token: <SessionToken>`. Headers zijn Accept en Content-Type: application/json. Er is bij deze GET geen requestbody; het HTTP 401-antwoord heeft eveneens een lege body. Met en zonder Content-Type-header is de uitkomst gelijk.
>
> Inmiddels werkt de gedocumenteerde route `GET /v2/ActualShifts/status/period/2026-10-20/2026-10-21/?departmentId=<departmentId>` met beide bestaande sleutels (HTTP 200, Date/Open/Status). Daarmee kunnen we de open/gesloten controle uitvoeren.
>
> We lezen geplande en werkelijke diensten met `GET /v2/Shifts/?from=<yyyy-MM-dd>&to=<yyyy-MM-dd>&departmentId=<departmentId>`. Beschikbaar zijn dienst-, medewerker- en afdelings-ID, start/einde, pauzecode en -uren, netto uren, Comments/Comments2, dienststatus, activiteit, IsAvailable en IsExchange.
>
> We willen in eerste instantie alleen een bestaande werkelijke dienst corrigeren: starttijd, eindtijd en eventueel pauzecode. Medewerker, afdeling, activiteit, planning en oorspronkelijke opmerkingen moeten behouden blijven. Voor de voorbereide `PUT /Shifts/{ShiftId}/` gebruiken we ShiftId, EmployeeId, StartTime, EndTime, BreakCode, Comment, IsAvailable, IsExchange en ShiftActivityId; datums in Microsoft Date-formaat met Amsterdam-offset. Een correctiereden bewaren we apart, zonder de bestaande opmerking te overschrijven. Extra bronvelden die de schrijf-DTO niet kan behouden worden momenteel geblokkeerd. Er is nog geen PUT of import uitgevoerd.
>
> De Swagger beschrijft voor BulkInsertShifts een ShiftImport met DepartmentKey, WageSystemKey, StartDate en EndDate, zonder ShiftId. Kun je toelichten hoe deze route een bestaande werkelijke dienst bijwerkt zonder een extra dienst aan te maken, en hoe pauze, opmerkingen en meerdere diensten per dag behouden blijven? Welk endpoint en welke verplichte velden adviseren jullie voor het bijwerken van één bestaande dienst op ShiftId?
>
> Met punt 3 bedoelen we voorkomen dat een correctie een wijziging overschrijft die iemand intussen rechtstreeks in Tamigo doet. We vergelijken de bron opnieuw vóór opslaan en lezen daarna terug. `GET /v2/ShiftsLog/ChangedShifts` en `/v2/ShiftsLog/{shiftId}` werken ook met onze standaardkoppeling. Deze helpen bij historie, maar bestaat er ook een conditionele update op een versienummer/ModifiedOn of ETag, die een gelijktijdige wijziging afwijst? Zo niet, welke werkwijze adviseren jullie daarvoor?
>
> We passen alleen open urenstaten aan; we openen of sluiten zelf geen dagen en doen geen salarisexport. Er zijn nog geen diensten via deze correctiefunctie gewijzigd.
>
> Met vriendelijke groet,
> Feline

### Eerdere proef op 27 oktober

Met de standaardkoppeling waren 13 afdelingen (unie van beide lijsten), 435 unieke geplande en 436 unieke werkelijke diensten beschikbaar. De oudere dagstatusroute gaf HTTP 401 met de standaardkoppeling en HTTP 403 met de loonkoppeling, ook met de securitytoken-queryparameter. De toenmalige conclusie dat de applicatiekoppeling geen enkele bruikbare dagstatusroute had, is door de versie-2-proef hierboven achterhaald.

## Activering

1. Voer `app/supabase/migrations/20261023170000_tamigo_hours_corrections.sql` uit in de bedoelde omgeving. De migratie is lokaal getest met een echte Postgres-engine (PGlite); niet op de productiedatabase toegepast.
2. De versie-2-dagstatus is op 28 oktober alleen-lezen bevestigd en de leesadapter is daarop aangepast. Laat Tamigo nog het exacte schrijvend endpoint, de verplichte velden en het behoud van bestaande dienstgegevens bevestigen; schrijfrechten zijn niet met een echte wijziging getest.
3. Pas na bevestigde toegang en een afgesproken gecontroleerde praktijkproef `TAMIGO_HOURS_WRITE_ENABLED=1` instellen. Deze variabele is nu niet aangezet. Een onbekende dagstatus blijft blokkeren, ook met de variabele aan.

De frontend kan een wijziging voorbereiden en de blokkades tonen zolang terugschrijven uitstaat. Er ontstaat pas een bevestigbaar correctierecord als bron, drempels, overlap, alle geraakte dagen en beveiligde opslag beschikbaar zijn. Het bevestigingsrecord is tien minuten geldig en gekoppeld aan de voorbereidend beheerder.

## Bevestigde gegevens en grenzen

- Bestaande `GET /v2/Shifts/` levert dienst-, medewerker- en afdelings-ID, tijden, pauze, netto uren, opmerkingen, status, IsAvailable, IsExchange en ShiftActivityId.
- De huidige eenvoudige pauzecodes zijn `1`: 15 minuten vanaf 6 bruto uren; `2`: 30 minuten vanaf 8 bruto uren. Dit zijn Tamigo-codevoorwaarden. De bedrijfscontrole blijft afzonderlijk: geplande bruto duur **strikt meer dan 8 uur**.
- Alleen vlakke, actieve pauzecodes zonder samengestelde of loonafhankelijke configuratie worden aangeboden. Er wordt geen tweede pauzeaftrek of los netto urentotaal geschreven.
- Alleen status 3 (werkelijk), een bevestigde open dag en een ondersteunde bron kunnen worden aangepast. Extra Comments2, taken, samengestelde activiteiten, competenties en pauzestartdetails worden geblokkeerd, omdat de gedocumenteerde schrijf-DTO die niet volledig vertegenwoordigt.
- Opmerkingen worden niet aangepast of aangevuld. De correctiereden staat apart in de beveiligde historie.
- De startdatum blijft gelijk. Een nachtdienst heeft expliciete begin- en einddatum; alle geraakte dagen worden gecontroleerd. Ambigue lokale tijden bij wintertijd worden niet geraden. Expliciete ISO-offsets van een berekend voorstel blijven behouden.
- Voorstellen worden op de server opnieuw berekend met de gecontroleerde regels; browserbedragen worden niet vertrouwd. Handmatige correcties mogen van de afrondingsregels afwijken en vereisen een reden.

## Bewaren en versturen

- Alleen actieve managementrollen met de bestaande MFA-controle krijgen toegang. POST vereist dezelfde origin en JSON. Directe database-toegang voor medewerkers, anonieme gebruikers en browserclients is ingetrokken.
- Oorspronkelijke bron, bedoelde correctie, gebruikte regels, reden en verantwoordelijke beheerder worden vóór de Tamigo-call opgeslagen. De oorspronkelijke snapshot is onveranderlijk.
- De database claimt een poging atomair. Een unieke index voorkomt twee actieve/onzekere pogingen op dezelfde dienst, ook vanuit verschillende app-processen. Een herhaalde bevestiging verstuurt niets opnieuw.
- Vlak vóór de PUT worden bronversie, pauzecodevoorwaarden, overlap en dagstatus opnieuw gecontroleerd. Na de PUT worden tijden, pauze, netto uren, identiteit, activiteit, status en opmerkingen teruggelezen.
- Een time-out, onleesbaar antwoord of afwijkend resultaat wordt **onzeker**, nooit automatisch opnieuw verstuurd. Een nieuwe leespoging kan een exact overeenkomend resultaat alsnog bevestigen; een niet bevestigd resultaat blijft geblokkeerd.
- De Tamigo-documentatie beschrijft geen ETag/conditionele update voor dit endpoint. De lokale blokkering beschermt app-verzoeken onderling, maar kan gelijktijdige wijzigingen rechtstreeks in Tamigo tussen de laatste GET en de PUT niet atomair verhinderen. Dit moet bij de praktijkproef met Tamigo worden besproken. Er is geen blinde automatische herstel- of herhaalactie.
- Er worden geen personeelsgegevens naar AI-diensten verstuurd. Tests en preview gebruiken uitsluitend fictieve diensten.

## Controle

```sh
node --test tests/tamigo-hours-review.test.cjs tests/tamigo-hours-corrections.test.cjs tests/management-security.test.cjs
npx eslint app/management/urencontrole app/api/tamigo-hours-review app/tamigoApi.ts
npm run build
npm run typecheck
```

Optionele SQL-proef, zonder productiedatabase of wijziging aan package.json:

```sh
npm install --prefix /private/tmp/strik-tamigo-sqlcheck --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.11
node scripts/check-tamigo-corrections-sql.cjs /private/tmp/strik-tamigo-sqlcheck
```

Deze SQL-proef controleert migratie, onveranderlijke snapshots, idempotente claims, de blokkering van een onzekere poging, hercontrole, auditvermelding van de controleur en ingetrokken directe lees-/schrijf-/verwijderrechten. Hierbij worden ook ruime Supabase-defaultgrants gesimuleerd.

Bronnen: [actuele Swagger](https://api.tamigo.com/api-docs/swagger.json), [Swagger-weergave](https://api.tamigo.com/api-docs/index.html?url=/api-docs/swagger.json), [actuele volledige Tamigo-documentatie met bijlagen](https://support.tamigo.no/support/solutions/articles/5000867116-api-dok-pr-01-04-2024-full-versjon), [diensten bijwerken](https://support.tamigo.no/support/solutions/articles/5000793326-shift-services-), [open/gesloten urenstaat](https://support.tamigo.no/support/solutions/articles/5000793327-actual-shift-services-).
