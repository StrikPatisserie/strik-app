# STRAK gepland

Live werkversie, 28 oktober 2026. De omgeving staat op `/bakkerij/productie`, bereikbaar via Productie. De eenmalige overdracht wordt via het ingelogde management uitgevoerd. `/preview/productie` blijft uitsluitend in development beschikbaar met eigen fictieve gegevens.

## Gedeelde opslag en toegang

Dezelfde Strik-login blijft gelden. Managers plannen en beheren onderdelen; bestaande productieaccounts wijzigen alleen taakstatussen binnen hun eigen afdelingen. Het operationele bord bevat geen factuur-, inkoop-, verkoopprijs- of margevelden. Het bestaande management blijft de financiële projectie van dezelfde receptenbron gebruiken.

Supabase bevat `production_documents` voor de canonieke receptuurcollectie en de planner, `production_document_versions` voor reconstructie van wijzigingen, `production_migration_backups` voor de oorspronkelijke WordPress-export en `production_media` voor onveranderlijke afbeeldingsbytes met SHA-256 als ID. RLS is ingeschakeld; anon en authenticated hebben geen directe tabel- of functierechten. Alleen de bewaakte serverroutes gebruiken service_role.

Dit is een eerste opslagfase met JSONB-documenten: alle bestaande velden en tekst-ID's blijven behouden. Normaliseren naar afzonderlijke receptregels kan later vanuit deze canonieke bron; er is geen tweede beschrijfbare receptenverzameling. De eerste versie is een volledige snapshot, latere versies zijn veldpatches. Een checkboxwijziging kopieert daardoor niet telkens alle foto's en recepten naar de historie.

Schrijven gebruikt een database-transactie met rijvergrendeling en verwachte revisie. Een verouderde tab krijgt 409 en overschrijft geen gedeelde gegevens. Originele WordPress-prijs-/factuurgegevens zijn alleen server-side beschikbaar. Oudere clients die geen revisie meesturen moeten verversen.

## Overdracht WordPress → Supabase

De aparte WordPress-snippet `strik-recepturen-supabase-transfer.php` staat naast de bestaande recepten-API en persoonlijke toegangsbeveiliging. De snippet vereist een bestaande manager met aal2. Hij maakt geen nieuwe credentials of toegangsrechten aan.

1. `/api/productie/transfer` controleert eerst de volledige ongenormaliseerde bron en het aparte allergenenarchief, met uitsluitend aantallen en probleemcodes als antwoord.
2. Bij overzetten vergrendelt WordPress zijn twee bron-options. Oude REST-schrijfverzoeken krijgen 423; ook oudere admin-acties mogen de options niet meer wijzigen.
3. De volledige export, inclusief onbekende velden, originele IDs, recepten, halffabricaten, grondstoffen, verpakkingen, prijs-/factuurhistorie, productielogs/verzoeken, notities, aanbiedingen en allergenenlijsten blijft als herstelkopie bewaard. Het oorspronkelijk ingebedde allergenenarchief blijft daarnaast behouden als `wordpressEmbeddedAllergenLists`.
4. Bestaande externe WordPress-foto's worden gekopieerd naar afgeschermde Supabase-afbeeldingsrecords, op inhoud gehasht en teruggelezen. Inline foto-data blijft in de receptuurdata staan. Afbeeldingsbytes vallen daardoor ook onder de databaseback-up. Er is geen afhankelijkheid van een openbare Storage-bucket.
5. Na kopiëren wordt de vergrendelde WordPress-bron opnieuw vergeleken. Alleen bij gelijke inhoud importeert één transactie de volledige bronbackup, recepten en bestaande open planning. Een tweede import kan niets overschrijven.
6. De opgeslagen receptuurdata wordt volledig teruggelezen en canoniek vergeleken. Daarna blijft de WordPress-bron definitief alleen-lezen als herstelkopie. Nieuwe app-reads en -writes gaan uitsluitend naar Supabase. Er wordt niets uit WordPress verwijderd.
7. Bij een fout vóór de databasecommit wordt de bron ontgrendeld. Bij een fout na commit blijft hij gesloten, zodat geen twee beschrijfbare bronnen ontstaan. Bij een procesonderbreking met een achtergebleven schrijfslot moet beheer eerst vaststellen of `production_documents` gevuld is; nooit blind een bron heropenen.

De eerste broncontrole vond 199 recepten, waarvan 108 halffabricaten, 359 grondstoffen en 3 facturen. Eén bronrecept heeft vijf verwijzingen naar ontbrekende grondstoffen. De gecontroleerde overdracht bewaart zulke bronverwijzingen letterlijk als aandachtspunt. Het bijbehorende recept blijft zichtbaar en is geblokkeerd voor productie totdat de koppelingen in het receptbeheer zijn hersteld. De gewone offline validator blijft streng; er worden geen grondstoffen of hoeveelheden verzonnen. Andere structurele fouten blijven de overdracht blokkeren.

## Werking en grenzen

Het hoofdweekbord bevat Desserttaart & fruit, Luxe gebak, Kapseltaarten en Slagroomgebak. Bakkant bevat Bakafdeling en Brood als twee subafdelingen op één bord. IJs en Chocolade hebben eigen weergaven. De bestaande afdelings-ID’s en taken blijven behouden. Op mobiel kies je een dag. De XL-weergave ververst elke 15 seconden. Managers kunnen ook hierin taken toevoegen; medewerkers houden de bestaande taakrechten. Bij verbindingsverlies staat een waarschuwing boven de oude gegevens.

Onderdelen kunnen zonder recept worden toegevoegd en later gekoppeld. Taken zijn te plannen, te verplaatsen en af te ronden. Vervolgstappen verwijzen naar een eerdere stap in dezelfde batch; één batch registreert hoogstens één output. Afdelingen die niet bekend zijn uit de bron krijgen 'Afdeling controleren'. Managers kunnen die indeling en opmerkingen aanpassen.

Het taakvenster toont het geschaalde recept en de werkinstructies centraal, zonder allergenen- of voorraadtoelichting. Extra planning en gekoppelde stappen staan ingeklapt; operationele controlepunten blijven zichtbaar. De vaste voet bevat een groene terugpijl en voor managers bij geplande taken een rode prullenbak. Bij gekoppelde taken opent verwijderen een compact keuzevenster met directe links naar de vervolgstappen. Managers kunnen één taak verwijderen of de volledige receptproductie, inclusief de expliciet gekoppelde batchstappen en automatisch meegeplande halffabricaten. De volledige groep wordt vooraf getoond en alleen in één keer verwijderd als alle taken nog gepland zijn en geen taak buiten de groep ze nodig heeft. Andere producties van hetzelfde recept worden nooit op naam of datum meegenomen; actieve, afgeronde en geblokkeerde taken blijven beschermd. De server bewaart het oorspronkelijke taakrecord met verwijdermoment en actor in `removedTasks`, naast de bestaande versiehistorie. Via Instellingen → Verwijderde taken kunnen managers ook na herladen de oorspronkelijke taak herstellen. Clients mogen herstelrecords niet wijzigen of wissen; bestaande revisiecontrole voorkomt verwijderen vanuit een verouderde planning. Onderdelen en recepten worden hierbij niet verwijderd.

## Recepten en halffabricaten meeplannen

Eindproducten en halffabricaten hebben afzonderlijke labels en filters in zowel de onderdelencatalogus als de receptenlijst. De plankeuze groepeert eindproducten, halffabricaten en werkzaamheden. Je kunt een uitvoerhoeveelheid invullen of een aantal basisrecepten kiezen; één basisrecept gebruikt uitsluitend de vastgelegde opbrengst, zonder een opbrengst te raden.

`recipePlanning.ts` berekent optioneel de volledige gekoppelde keten. Elke benodigde hoeveelheid wordt geschaald naar de bronopbrengst; gram/kg en ml/liter worden expliciet omgerekend. Stuks/gewicht/volume worden nooit zonder aanvullende gegevens aan elkaar gelijkgesteld. Ontbrekende opbrengsten, niet-positieve hoeveelheden, kringverwijzingen en ontbrekende onderdelen blokkeren automatisch meeplannen. Handmatig plannen zonder recept blijft beschikbaar.

Bij een recept met bekende opbrengst en gekoppelde halffabricaten staat 'Halffabricaten meeplannen' bij een nieuwe opdracht standaard aan. De gebruiker kan dit uitzetten of onderdelen als al beschikbaar markeren. Standaard wordt ieder niveau één kalenderdag vóór zijn afnemer gepland; nul tot dertig dagen vooraf en afzonderlijke datums/afdelingen zijn instelbaar. Gedeelde halffabricaten worden per recept-ID samengenomen, op de vroegste benodigde datum. Uitvinken betekent dat de benodigde hoeveelheid al beschikbaar is; de eerste versie trekt geen voorraad af, rondt niet naar hele receptbatches af en berekent geen personeels- of machinecapaciteit.

`POST /api/productie/plan` is uitsluitend voor managers en rekent opnieuw met de canonieke bron. De volledige opdracht wordt één keer opgeslagen. Migratie `20261028120000_production_recipe_planning.sql` voegt een private serverfunctie toe die de receptrevisie vergrendelt en tegelijk de plannerrevisie controleert. Een wijziging aan één van beide tijdens plannen veroorzaakt 409 zonder gedeeltelijke taken. De gebruikte receptrevisie staat in de wijzigingshistorie.

Elke voorbereidingstaak heeft een eigen batch/outputregistratie. De afnemer wacht via `requires` op alle meegeplande halffabricaten, ook over afdelingen heen. Verplaatsen en heropenen behouden de volgorde; cycli worden ook server-side geweigerd. Verwijderen van een geplande hoofdtaak verwijdert ongebruikte, nog geplande voorbereiding mee. Gestarte/afgeronde of elders benodigde voorbereiding blijft behouden. Herstellen haalt de oorspronkelijke benodigde voorbereiding weer terug.

Gerichte tests: `tests/production-recipe-planning.test.cjs`. De rollbackcontrole `app/supabase/tests/production_recipe_planning_smoke.sql` verifieert op de bestaande database de twee revisies en afgeschermde functie zonder live records of versies te wijzigen.

De teller registreert productie, geen bewezen actuele voorraad. Onbekende voorraad blijft onbekend. Automatische verkoopprognoses, verbruik/uitgifte, werkelijke batchopbrengst, capaciteitsnormen en automatische orderimport zijn volgende bouwstappen. De eerdere receptuur- en managementschermen blijven beschikbaar en delen de nieuwe opslag.

## Verificatie

- `node --test tests/*.test.cjs scripts/specsplaza.test.cjs scripts/specsplaza-link.test.cjs`
- ESLint, TypeScript en Next-productiebuild.
- `app/supabase/tests/production_workspace_smoke.sql`: rollbacktest op lege opslag voor directe toegangsrechten, reconstructie van auditpatches en bescherming tegen een verouderde revisie. Op de echte database geslaagd vóór import.
- Live controleren: broncontrole, overdracht, teruglezen, financiële afscherming, één taak bewaren en na herladen terugvinden, plus dezelfde planning op een tweede scherm.

## Eigen productieomgeving

Productie opent direct `/bakkerij/productie`. In de hoofdapp staat een afzonderlijke rode knop (`#d75a48`) met het woord Productie en witte koksmuts onderaan de zijbalk. Op mobiel is het een apart rood item achteraan de hoofdnav. Binnen Productie staat uitsluitend het eigen menu met een teruglink naar de Team-app. De oude hubs en receptuur-/HACCP-routes verwijzen door. Logistiek, winkel-HACCP en IJssalons blijven zelfstandige onderdelen.

Recepten, halffabricaten, grondstoffen/SpecsPlaza, verpakkingen en import zijn binnen Productie te beheren. Deze schermen gebruiken dezelfde Supabase-bron en dezelfde revisie- en rolcontrole als voorheen. De volledige beheerprojectie blijft uitsluitend voor managers; medewerkers behouden het operationele recepten- en grondstoffenoverzicht zonder prijzen of marges.

HACCP wisselt tussen Bakkerij en IJs & chocolade, volgens de bestaande afdelingsbevoegdheden. Bakkerij heeft temperaturen inclusief week/maandoverzicht, goederenontvangst en allergenen; IJs & chocolade heeft kookketel-/afkoelregistraties. De bestaande registratiecomponenten zijn verplaatst en gebruiken ongewijzigde opslag-/locatie-ID’s en dezelfde API. Er is hierbij geen data-overdracht of verwijdering. Productie-HACCP blijft vooralsnog in de bestaande registratieopslag (WordPress); de receptuur- en plannerdata staan in Supabase. De schoonmaakchecklist van Patisserie staat nu als blauwe rij op het weekbord; HACCP Bakkerij verwijst er rechtstreeks naartoe. Voor IJs & chocolade is nog geen aparte schoonmaakplanning ingericht.

## Dagritme en XL-werkstand

Alleen Patisserie toont op maandag tot en met vrijdag vaste dagblokken: 05:30–08:00 dagstart (bestellingen van vandaag), 08:00–08:30 pauze en 08:30–14:00 productie. Zaterdag/zondag en Bakkant, IJs en Chocolade krijgen deze blokken niet. Dit is een zichtbaar werkritme, geen automatische verdeling van personeel of geschatte taakstarttijden. De blokken maken geen fictieve taken of productieregistraties aan. Vandaag heeft een eigen lichte kolomkleur; taken zijn compacte omkaderde balken.

In XL-stand kunnen managers taken toevoegen via de knop en rechtstreeks per dag/afdeling. De planning blijft de bestaande revisiecontrole en dezelfde opslag gebruiken. Bij een nieuw eindproduct met meegeplande halffabricaten heet de laatste stap standaard 'Decoreren / afmaken'; de werkzaamheden blijven aanpasbaar. Losse halffabricaten kunnen onafhankelijk op iedere gekozen datum, ook vandaag, worden gepland. Bestaande taken en omschrijvingen worden niet automatisch herschreven.

## Receptwijzigingen en de werkplek

Nieuwe productieopdrachten bewaren `recipePlan` met de oorspronkelijke invoer (aantal of basisrecepten), voorbereidingstermijn en expliciete uitzonderingen. Het bord vergelijkt de geplande halffabricaten met de huidige receptketen, inclusief geneste hoeveelheden. Bestaande opdrachten zonder deze metadata kunnen worden gereconstrueerd uit `generatedFor`; controleer bij deze oudere opdrachten expliciet welke onderdelen al beschikbaar zijn.

Een manager opent **Met actueel recept bijwerken**, controleert de vergelijking en slaat het hele voorstel atomair op via dezelfde beveiligde `/api/productie/plan`-route met `replaceTaskId`. De recept- en plannerrevisie worden opnieuw gecontroleerd. Datums, afdelingen en IDs van behouden voorbereiding blijven behouden; nieuwe voorbereiding krijgt unieke IDs. Verwijderde geplande voorbereiding blijft in de herstelhistorie. Gestarte, afgeronde, geblokkeerde of elders gebruikte voorbereiding kan niet via deze actie worden overschreven.

Het linkermenu biedt één operationele receptenlijst met zoeken op onafhankelijke woorddelen, artikelnummer, ingrediënten en instructies. Typen en afdelingen zijn filterbaar, losse onderdelen blijven inplanbaar en werkrecepten kunnen zonder opslaan worden geschaald. Receptuurbeheer en de import-/margepagina's zijn uitsluitend voor managers. Verpakkingen staan daar; weekinformatie is vervangen door de weekaanbieding boven het bord. De afbeelding is vergrootbaar en managers beheren hem op dezelfde plek. De bestaande receptuurbron bewaart de aanbieding.

De productie-layout houdt tijdens laden het rolgebonden menu zichtbaar met een lokale laadindicator. HACCP, Hefe en de ingebedde beheerschermen delen de compacte productiestijl; hun bronopslag en registratie-ID's zijn ongewijzigd.

## Bruidstaarten op het weekbord

Patisserie heeft ook de afdeling `bruidstaarten`, met een eigen filter. Definitieve taarten worden bij lezen opgehaald uit de bestaande Studio en op code ontdubbeld. Lezen maakt geen taken of mails aan. De rij ververst eenmaal per minuut. Bij uitval staat een melding en blijven opgeslagen productietaken zichtbaar. Een geopende kaart toont actuele productieafspraken, een vergrootbaar taartontwerp en een printversie; financiële velden worden niet naar deze werkplek doorgestuurd.

Een expliciete statuswijziging of verplaatsing maakt/bewerkt precies één gekoppelde taak in de Supabase-planner via `/api/productie/weddings`. De server haalt de definitieve taart opnieuw op, controleert de plannerrevisie en bewaart de Studio-leverdatum apart van de productiedatum. Managers mogen de productiedatum wijzigen; bevoegde bakkerijmedewerkers kunnen de status bijwerken. Het aanpassen van de productieplanning wijzigt geen klantafspraak in de Studio. Geannuleerde/ontbrekende bronorders en gewijzigde leverdatums bij reeds gestarte productie vereisen controle; de bestaande taak wordt behouden.

## Feestdagen en chocoladeletters

`/bakkerij/productie/feestdagen/sint` en `/kerst` tonen de definitieve, niet-geannuleerde B2B-orders van het gekozen jaar. De productieprojectie bevat klantnaam, producten, leverperiode, vastgelegde productiedatum, verpakking, werkinstructies en logo. Contact-, factuur- en prijsvelden gaan niet mee naar deze client. Herkende folderproducten hebben een cameraknop met voorbeeldfoto; het eigen logo kan afzonderlijk worden vergroot. Het overzicht is doorzoekbaar en filterbaar op voortgang en afdeling, inclusief XL-werkstand. De bestaande data wordt iedere 15 seconden opnieuw opgehaald zolang het scherm zichtbaar is; dit is polling, geen pushverbinding.

Afvinken schrijft uitsluitend `productionDone` of `letterProductionDone` terug naar de bestaande WordPress-B2B-order, inclusief het bestaande productiemoment bij `productionDone`. Er wordt geen nieuwe orderkopie gemaakt en er worden geen mailacties aangevraagd. Gemengde bestellingen houden aparte vinkjes voor letters en overige productie. Geleverde orders zijn alleen leesbaar. De adapter controleert een hash van de zojuist ingelezen order om verouderde tabs te weigeren. De WordPress-bron heeft geen atomaire verwachte-revisieparameter; een gelijktijdige verandering tussen de controle en het smalle status-PATCH-verzoek kan daarom niet volledig worden uitgesloten. Andere ordervelden worden door deze PATCH niet overschreven.

Bij Sinterklaas toont Chocoladeletters dezelfde echte productierondes en gedeelde aantallen als de bestaande letterproductie, inclusief winkel-/online-/B2B-bestellingen en winkelvoorraad. Datums worden uit de ingestelde rondes gelezen; de werkplek verzint geen rondes of toewijzingen. Orders die nog niet aan een ronde zijn gekoppeld blijven als aandachtspunt zichtbaar. Voor de deadline lopen benodigde aantallen mee met nieuwe bestellingen. Na de deadline gebruikt de bestaande opslag een vastgezette productielijst; de werkplek kan gedeeltelijke aantallen en klaarvinkjes opslaan met dezelfde revisiecontrole. Nieuwe orderverschillen worden eerst getoond en moeten expliciet worden overgenomen; reeds gemaakte aantallen blijven behouden. Een B2B-ordervinkje is geen automatische toewijzing van aantallen uit een gedeelde productieronde.

Feestdagen gebruikt een eigen operationele adapter `/api/productie/feestdagen`, alleen voor actieve productieaccounts en managers. De canonieke letterproductie blijft de bron voor deadline- en revisiecontrole. De adapter projecteert ook lees- én schrijfresponses zodat ruwe ontvangeropmerkingen en planversies niet via deze werkplek naar de browser gaan. Ook het oorspronkelijke B2B-overzicht haalt iedere 15 seconden en bij terugkeren naar het venster de actuele status op. Dit pauzeert tijdens bewerken, een bevestigingsdialoog, import of statuswijziging; verouderde achtergrondresponses worden genegeerd. Gerichte tests staan in `tests/production-holidays.test.cjs`.

## Eén stijl voor alle productieschermen

De productie-layout laadt `production-surfaces.css`, uitsluitend binnen `data-production-workspace` en `data-production-content`. Deze basis geldt ook voor de onderliggende recepteditor, grondstof-/leveranciersspecificaties, verpakkingen, import, marges, HACCP, temperatuurregistratie en -overzicht, goederenontvangst, allergenen en Hefe. Tabellen, panelen, invoer, acties, kleuren en typografie volgen het weekbord; op touchschermen blijven invoervelden 16px en bedieningselementen minimaal 44px. Schermstijlen vallen onder `@media screen`; print- en PDF-opmaak wordt niet door deze basis overschreven. Winkelpagina's buiten Productie behouden hun eigen uiterlijk.

Ingebedde temperatuurregistratie gebruikt dezelfde compacte meetregel als de winkels. Apparaatnaam/type, tijdelijke uitschakeling, vaste-lijstbeheer en notities staan in de uitklap; afwijkingen en verplichte maatregelen blijven direct zichtbaar. Bestaande apparaat-, locatie- en registratie-ID's blijven behouden. De herbruikbare registratiecomponenten staan in gewone componentbestanden; de Next-routebestanden hebben alleen toegestane pagina-exports.

## Productierooster en vakantievoorbereiding

Het menu heeft **Personeelsrooster** op `/bakkerij/productie/rooster`. De personeelsknop op het weekbord opent hetzelfde dagoverzicht als dialoog, ook in XL. De gekozen week kan vanuit het rooster weer in de productieplanning worden geopend. Het rooster ververst eenmaal per minuut zolang instellingen niet worden bewerkt. Eerdere gegevens bij verbindingsverlies worden herkenbaar als mogelijk verouderd getoond.

De alleen-lezen Tamigo-adapter gebruikt `GET /v2/Departments/application/`, `GET /v2/Shifts/` met `shiftStatus=planned` en `GET /v2/Absences/AbsenceOverview/`. Velden en de geplande/werkelijke scheiding zijn gecontroleerd in de [officiële Swagger](https://api.tamigo.com/api-docs/swagger.json), 28 oktober 2026. Beide bestaande applicatietoegangen kunnen voor een leesverzoek worden gebruikt: alleen bij ontbrekende configuratie of HTTP 401/403 probeert deze adapter de tweede ingestelde sleutel. Geen PUT naar Tamigo en geen salaris-, BSN-, contact- of vrije-opmerkingvelden in deze productieprojectie. Andere afwezigheid heet hier alleen 'Afwezig'; medische omschrijvingen blijven in Tamigo.

Afdelingen worden aanvankelijk herkend op productienamen; management kan de exacte Tamigo-afdelings-ID's kiezen. Managers leggen per medewerker-ID de normale werkdagen, netto weekuren en een vast takenpakket vast. Alleen deze instellingen worden in `planner.staffing` opgeslagen, met de bestaande revisiecontrole en versiehistorie. Een gewone planning-PUT kan deze instellingen niet wijzigen of wissen. Er worden geen volledige rooster- of verlofkopieën in de productieopslag bewaard.

Een waarschuwing in week N kijkt naar vakantie die in week N+1 valt en minstens één eigen normale werkweek beslaat, eventueel doorlopend in N+2. Alle normale werkdagen in die reeks moeten vakantie bevatten, samen minstens de vastgelegde netto weekuren. Werk, concept/onduidelijke diensten, gedeeltelijk verlof, onbekende uren, overlappende tegenstrijdige regels of ontbrekende bronnen geven geen bevestigde voorraadwaarschuwing. Duplicaten en dezelfde vakantie in de diensten- én afwezigheidsbron worden niet bij elkaar opgeteld. Ontbreekt de normale werkweek, dan meldt de werkplek dat deze eerst moet worden ingesteld. De melding bevat het vaste takenpakket, bijvoorbeeld het op peil brengen van Keizer Karels en vlaaibodems; zij is geen automatische voorraadberekening of mail.

De API meldt ontbrekende bevoegdheden en onleesbare antwoorden expliciet. Een gebrek aan brondata wordt niet uitgelegd als een lege werkweek of goedgekeurde vakantie. Gerichte tests: `tests/production-staffing.test.cjs` (identiteit, ontdubbelen, nacht/zomer-/wintertijd, deeltijd, verlof over een weekgrens, ontbrekende gegevens, privacy en rechten).

Meerdaagse afwezigheidsperioden worden op iedere betrokken kalenderdag getoond. Hun gerapporteerde urentotaal wordt nooit per dag gekopieerd of naar gelijke daguren verdeeld. Een bereik telt één keer mee wanneer alle normale werkdagen ervan in de beoordeelde werkweek vallen. Een bereik dat iedere normale dag volledig van middernacht tot middernacht afdekt, dekt die normale werkweek ook zonder verzonnen uren. Bij gedeeltelijke grensdagen en ontbrekende totaaluren blijft de waarschuwing achterwege; nachturen tussen zulke grensdagen zijn geen vakantie-uren.


## Schoonmaak op het weekbord

Feestdagen staat direct na Weekplanning in het gedeelde desktop- en mobiele productiemenu. Patisserie toont daaronder een compacte blauwe schoonmaakrij met dezelfde dagkolommen, dagkeuze, statusfilter en XL-bediening als het productieboard. Schoonmaak is geen extra productieafdeling, recept of voorraadhandeling: `planner.cleaning` bevat maximaal één daglijst per kalenderdatum, met een optionele hoofdtaak en dagelijkse checklist. Er worden geen echte schoonmaaktaken vooraf ingevuld. Management kan per dag plannen, dagelijkse taken op geselecteerde dagen in dezelfde week herhalen, nog onafgevinkte dagen verplaatsen of verwijderen. Herhalen voegt ontbrekende dagelijkse taken toe; bestaande hoofdtaken, extra dagelijkse taken en vinkjes op andere dagen blijven behouden.

Patisseriemedewerkers kunnen individuele taken afvinken en heropenen. De server legt bij afvinken het medewerker-ID en tijdstip vast; een herhaald vinkverzoek verandert de oorspronkelijke registratie niet. Wijzigen van tekst, verplaatsen of verwijderen van afgevinkte taken vereist eerst expliciet heropenen. De aparte commandoroute `/api/productie/schoonmaak` controleert afdelingsrechten, managementrechten voor plannen/verwijderen/verplaatsen, oorsprong, invoer en plannerrevisie. Elke wijziging gaat atomair via de bestaande Supabase-versiehistorie. Een gewone productie-PUT kan schoonmaakregistraties niet overschrijven of wissen. Andere plannergegevens, voorraad en de bestaande winkelregistraties blijven behouden.

Gerichte controles: `tests/production-cleaning.test.cjs`, `tests/production-live.test.cjs` en `tests/production-workspace-ui.test.cjs` testen herhalen, behoud van uitgevoerd werk, kalenderdatums, identiteit, rechten, revisieconflicten en de integratie met het weekbord.
