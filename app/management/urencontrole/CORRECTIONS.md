# Tamigo-correcties

De controlepagina en afgeschermde correctieflow zijn op 23 oktober 2026 gepubliceerd. De productiemigratie voor correctiehistorie is op 28 oktober 2026 uitgevoerd en gecontroleerd. De eerste door Feline gekozen en bevestigde praktijkcorrectie is afgewezen met HTTP 401; de oorspronkelijke dienst is daarna ongewijzigd teruggelezen. Terugschrijven is daarom opnieuw uitgeschakeld. Nieuwe diensten, verlof, ziekte, salarisexports en het openen/sluiten van dagen vallen buiten deze functie.

## Eerste praktijkproef: afgewezen op 28 oktober 2026

- De beveiligde historie bevat één correctie met status `rejected`. De applicatie heeft na HTTP 401 de oorspronkelijke bronversie ongewijzigd teruggelezen. De correctie is niet opnieuw verzonden; tijdens de diagnose zijn geen PUT-, import- of andere dienstmutaties uitgevoerd.
- De opgeslagen aanvraag bevat de negen verwachte veldnamen. IsAvailable en IsExchange zijn booleans, ShiftActivityId is null, Comment is een string, en beide tijdvelden voldoen aan de Microsoft Date-notatie met offset. Dienst-ID en bronversie stemmen overeen met het voorbereide record. Dit controleert de aanvraagvorm, niet de acceptatie door Tamigo; null versus een lege GUID is bijvoorbeeld nog niet door het endpoint bevestigd.
- Een nieuwe `POST /v2/Login/Application` geeft HTTP 200. De oude `GET /Shifts/day/{date}/` geeft met dezelfde verse sessie HTTP 401, zowel met de tokenheader als met de gedocumenteerde securitytoken-queryparameter. Dit maakt een verlopen productiecache niet de enige verklaring. De v2-variant van deze oudere dagroute geeft eveneens HTTP 401; alleen een `/v2`-prefix toevoegen is dus geen bewezen oplossing.
- `OPTIONS /Shifts/{niet-bestaand-id}/` en de v2-variant geven HTTP 405 met `Allow: PUT, POST, DELETE`. Dit bewijst alleen dat de server die methoden noemt; niet dat een applicatiesessie de PUT mag uitvoeren of dat een bepaalde body geldig is.
- De actuele officiële **User Services**-PDF plaatst Update Shifts bij de gebruikersdiensten en schrijft voor die diensten een login met Tamigo-gebruiker voor. De **Application Services**-PDF onderscheidt applicatietoegang van gebruikerscontext. De gebruikte applicatiesessie is daarmee geen bewezen passende authenticatie voor deze PUT. Sommige leesroutes hebben expliciete applicatieondersteuning; dat geeft nog geen schrijfrecht. HTTP 401 alleen bewijst de precieze oorzaak niet.
- De eerdere activering op basis van leescontroles, bronvelden en fictieve tests was te ruim: daarmee was het passende sessietype voor deze schrijfroute niet vastgesteld. Geen routevarianten op echte diensten proberen en geen gebruikerswachtwoord toevoegen zonder een afzonderlijk gekozen integratieaanpak.
- `TAMIGO_HOURS_WRITE_ENABLED=0` is ingesteld voor productie. Uitrol `dpl_8BEAWNyncG8BujqRAtkNDMMw8qLz` gebruikt dezelfde commit, is READY en gekoppeld aan `app.strik-patisserie.nl`. Historie en alleen-lezen urencontrole blijven beschikbaar.

### Aanvullende vraag aan Tamigo (niet verstuurd)

> Onze eerste gecontroleerde correctie met `PUT /Shifts/{ShiftId}/` is met HTTP 401 afgewezen. Headers: Accept en Content-Type application/json, x-tamigo-token met een SessionToken uit een succesvolle `/v2/Login/Application`. De negen velden volgen jullie Update Shifts-voorbeeld; start/einde gebruiken Microsoft Date-notatie met Amsterdam-offset en ShiftActivityId is null bij een dienst zonder activiteit. Na de afwijzing is de bron ongewijzigd teruggelezen. Dezelfde applicatiekoppeling kan `/v2/Shifts/` en de v2-dagstatus wel lezen.
>
> In de actuele documentatie staat Update Shifts onder User Services, waarvoor een gebruikerslogin wordt beschreven. Ondersteunt deze PUT ook een applicatiesessie? Zo ja, welke exacte URL, claim/rechten, veldvereisten en notatie voor geen activiteit zijn nodig? Zo nee, welke applicatieroute werkt een bestaande werkelijke dienst op ShiftId bij zonder nieuwe dienst aan te maken, met behoud van alle overige velden? We willen geen persoonlijk gebruikerswachtwoord als integratieoplossing toevoegen.

## Overzicht aangepast op 28 oktober 2026

- Keuze tussen kalendermaand en loonperiode; standaard loonperiode. Loonperiode oktober loopt van 26 september t/m 25 oktober. De API haalt het volledige bereik op met een extra grensdag aan beide kanten; alleen diensten in de gekozen periode worden getoond. Januari en schrikkeljaren zijn afgedekt.
- Winkel - Wijchen en de bovenliggende afdeling Winkels zijn verborgen uit rijen en afdelingskeuzes. Bronopvraging en overlapcontrole blijven alle afdelingen betrekken, zodat verbergen geen blinde vlek in controles veroorzaakt.
- Rijen zonder medewerker of zonder beschikbare naam staan apart onder Zonder medewerker, met een rustige stijl en eigen telling. Een ontbrekende naam met een bestaand medewerker-ID wordt niet als bewezen oningevulde dienst aangeduid.
- Bij ontbrekende werkelijke uren toont het voorstel de oorspronkelijke geldige planning, zonder afronding of gewijzigde pauze. Dit blijft herkenbaar als Volgens planning; er worden geen werkelijke uren of verschilbedragen verzonnen en de app maakt geen nieuwe dienst aan.
- Elke overlapregel toont de andere afdeling, het andere tijdvak en de overlapduur, met Vergelijk dienst om beide oorspronkelijke registraties naast elkaar te bekijken. Gelijke tijden krijgen Mogelijk dubbel. De controle vergelijkt afzonderlijke werkelijke registraties op medewerker-ID, geen planning met werkelijkheid. Open diensten met de lege GUID worden niet met elkaar als één medewerker vergeleken.
- Alle 114 gerichte tests, lint, TypeScript en productiebuild slagen. Een alleen-lezen loonperiodeproef slaagt; geen Tamigo-diensten gewijzigd. De lokale voorbeeldpagina rendert de loonperiodekeuze en de grenzen 26 september t/m 25 oktober. Interactieve browsercontrole was niet beschikbaar in deze sessie.

## Inrichting correctiehistorie 28 oktober 2026

- De Supabase-verbinding werkt met project `strik-team-app` (`ckzrajbflscdheaxhjbs`, ACTIVE_HEALTHY). Migratie `tamigo_hours_corrections` is succesvol toegepast vanuit het bestaande SQL-bestand.
- Beide historietabellen hebben RLS. `anon` en `authenticated` hebben geen leesrechten en mogen de claimfunctie niet uitvoeren. De server heeft leesrechten en mag claims uitvoeren, maar kan geen historieregels verwijderen. De tabellen bevatten na inrichting nul correcties.
- De 107 gerichte tests en de PGlite-proef voor onveranderlijke snapshots, claims, onzekere pogingen en toegangsrechten slagen. De database-advisor meldt voor deze tabellen alleen de verwachte informatieve melding over RLS zonder browserpolicies; geen waarschuwingen voor de correctiefuncties.
- De Vercel-verbinding werkt met project `strik-app` (`prj_XbEpYcwDRqamChMDbAyCu99x9uS6`). Supabase-serverconfiguratie en de standaard Tamigo-configuratie zijn aanwezig in de omgevingsvariabelen. `TAMIGO_HOURS_WRITE_ENABLED=1` is uitsluitend voor productie ingesteld. Dezelfde geteste commit `19ef93c4575eeb737a3acfec7b94de0d2867728c` is opnieuw uitgerold als `dpl_CvmmEE9H7RH38DoWUqoL8c8nqg5P` (READY).
- De officiële Shift Services-documentatie beschrijft `PUT /Shifts/{ShiftId}/`, alle negen door de adapter verzonden velden en de verplichting bestaande waarden mee te sturen. De actuele Swagger vermeldt geen PUT voor individuele diensten; die bevestigt de oudere route dus niet opnieuw. Een aanvullende mail is geen harde activeringsvoorwaarde meer, maar echte schrijfrechten en werkelijk veldbehoud zijn nog onbeproefd. Er is geen PUT verstuurd. De eerste echte proef mag uitsluitend een concrete, door Feline gekozen en bevestigde correctie betreffen.
- De nieuwe alleen-lezen oktoberproef slaagt: 13 afdelingen, 436 unieke geplande en 452 unieke werkelijke diensten. Dagstatus is beschikbaar en de steekproefdag is open. Oorspronkelijke registraties zijn ongewijzigd; er zijn geen echte correcties aangemaakt of verzonden.
- De aanvullende broncontrole (`--check-write-readiness`) heeft 452 unieke werkelijke diensten gecontroleerd: 359 voldoen aan de bronvoorwaarden voor terugschrijven, zonder ontbrekende IsAvailable/IsExchange/ShiftActivityId-velden of onbereikbare afdelingen. De resterende 93 blijven geblokkeerd; blokkaderedenen kunnen overlappen. Dit is geen bewijs van schrijfrechten of volledige correctiegereedheid: dagstatus, overlap, actuele bronversie, voorstel en opslag worden per gekozen correctie opnieuw gecontroleerd.

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

**Huidige blokkade na praktijkproef:** de productieschakelaar is teruggezet naar `0`. De hieronder beschreven eerdere activering is alleen historische context. Opnieuw activeren pas nadat het passende sessietype en de exacte schrijfroute zijn vastgesteld. Daarna opnieuw één concrete correctie door Feline laten kiezen en bevestigen; de afgewezen poging niet automatisch herhalen.

1. **Uitgevoerd op 28 oktober 2026:** `app/supabase/migrations/20261023170000_tamigo_hours_corrections.sql` is toegepast op productieproject `strik-team-app`. RLS en ingetrokken browserrechten zijn op de productiedatabase gecontroleerd; de gedragsproef met fictieve gegevens slaagt in PGlite.
2. De versie-2-dagstatus en de bronvoorwaarden zijn op 28 oktober alleen-lezen bevestigd. De officiële Shift Services-documentatie beschrijft de gebruikte PUT en de vereiste velden. Aanvullende bevestiging van Tamigo blijft nuttig, maar Feline heeft gevraagd de functie zonder nieuwe reactie werkend te maken. Schrijfrechten en veldbehoud worden pas bij de eerste gekozen echte correctie bewezen.
3. `TAMIGO_HOURS_WRITE_ENABLED=1` is voor productie ingesteld; de bestaande geteste productieversie is opnieuw uitgerold en READY (`dpl_CvmmEE9H7RH38DoWUqoL8c8nqg5P`, circa 205 seconden buildtijd). Een onbekende dagstatus of onvolledige bron blijft blokkeren, ook met de variabele aan. Geen echte dienst wijzigen zonder een concrete keuze en bevestiging van Feline. Bij een onzekere uitkomst nooit automatisch herhalen. De productiepagina stuurt bezoekers zonder sessie naar de loginpagina (HTTP 307); de beheerflow is niet met een ingelogde browsersessie beproefd.

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

Aanvullende alleen-lezen broncontrole met uitsluitend aantallen en blokkaderedenen als uitvoer:

```sh
node scripts/check-tamigo-hours.cjs --env-dir app --month 2026-10 --check-write-readiness
```

Deze controle retourneert een foutstatus bij onbereikbare afdelingen, geen werkelijke diensten of geen enkele ondersteunde bron. Hij claimt geen correctie en verstuurt nooit een PUT.

Deze SQL-proef controleert migratie, onveranderlijke snapshots, idempotente claims, de blokkering van een onzekere poging, hercontrole, auditvermelding van de controleur en ingetrokken directe lees-/schrijf-/verwijderrechten. Hierbij worden ook ruime Supabase-defaultgrants gesimuleerd.

Bronnen: [actuele Swagger](https://api.tamigo.com/api-docs/swagger.json), [Swagger-weergave](https://api.tamigo.com/api-docs/index.html?url=/api-docs/swagger.json), [actuele volledige Tamigo-documentatie met bijlagen](https://support.tamigo.no/support/solutions/articles/5000867116-api-dok-pr-01-04-2024-full-versjon), [diensten bijwerken](https://support.tamigo.no/support/solutions/articles/5000793326-shift-services-), [open/gesloten urenstaat](https://support.tamigo.no/support/solutions/articles/5000793327-actual-shift-services-).

Controle na activering: Vercel bevestigt de productieschakelaar met waarde `1` en de productiealias op de READY-uitrol. Runtimefoutlogs konden niet worden ingezien: de connector geeft HTTP 403; er is geen lokale Vercel CLI beschikbaar. Dit is geen bevestiging van foutloze runtimewerking. Er is geen echte correctie verstuurd.
