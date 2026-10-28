# Strik Productie

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

Managers kunnen geplande taken verwijderen via het taakvenster. Taken met een gekoppelde vervolgstap moeten van achter naar voren worden verwijderd; actieve, afgeronde en geblokkeerde taken kunnen niet rechtstreeks verdwijnen. De server bewaart het oorspronkelijke taakrecord met verwijdermoment en actor in `removedTasks`, naast de bestaande versiehistorie. Via Instellingen → Verwijderde taken kunnen managers ook na herladen de oorspronkelijke taak herstellen. Clients mogen herstelrecords niet wijzigen of wissen; bestaande revisiecontrole voorkomt verwijderen vanuit een verouderde planning. Onderdelen en recepten worden hierbij niet verwijderd.

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

Productie opent direct `/bakkerij/productie`. De hoofdapp gebruikt een rood rondje (`#d75a48`) met witte koksmuts; binnen Productie staat uitsluitend het eigen menu met een teruglink naar de Team-app. De oude hubs en receptuur-/HACCP-routes verwijzen door. Logistiek, winkel-HACCP en IJssalons blijven zelfstandige onderdelen.

Recepten, halffabricaten, grondstoffen/SpecsPlaza, verpakkingen en import zijn binnen Productie te beheren. Deze schermen gebruiken dezelfde Supabase-bron en dezelfde revisie- en rolcontrole als voorheen. De volledige beheerprojectie blijft uitsluitend voor managers; medewerkers behouden het operationele recepten- en grondstoffenoverzicht zonder prijzen of marges.

HACCP wisselt tussen Bakkerij en IJs & chocolade, volgens de bestaande afdelingsbevoegdheden. Bakkerij heeft temperaturen inclusief week/maandoverzicht, goederenontvangst en allergenen; IJs & chocolade heeft kookketel-/afkoelregistraties. De bestaande registratiecomponenten zijn verplaatst en gebruiken ongewijzigde opslag-/locatie-ID’s en dezelfde API. Er is hierbij geen data-overdracht of verwijdering. Productie-HACCP blijft vooralsnog in de bestaande registratieopslag (WordPress); de receptuur- en plannerdata staan in Supabase. Een productieschoonmaakrooster was nog niet ingericht: de omgeving vermeldt dit expliciet en toont geen fictieve checklist.

## Dagritme en XL-werkstand

Alleen Patisserie toont op maandag tot en met vrijdag vaste dagblokken: 05:30–08:00 dagstart (bestellingen van vandaag), 08:00–08:30 pauze en 08:30–14:00 productie. Zaterdag/zondag en Bakkant, IJs en Chocolade krijgen deze blokken niet. Dit is een zichtbaar werkritme, geen automatische verdeling van personeel of geschatte taakstarttijden. De blokken maken geen fictieve taken of productieregistraties aan. Vandaag heeft een eigen lichte kolomkleur; taken zijn compacte omkaderde balken.

In XL-stand kunnen managers taken toevoegen via de knop en rechtstreeks per dag/afdeling. De planning blijft de bestaande revisiecontrole en dezelfde opslag gebruiken. Bij een nieuw eindproduct met meegeplande halffabricaten heet de laatste stap standaard 'Decoreren / afmaken'; de werkzaamheden blijven aanpasbaar. Losse halffabricaten kunnen onafhankelijk op iedere gekozen datum, ook vandaag, worden gepland. Bestaande taken en omschrijvingen worden niet automatisch herschreven.
