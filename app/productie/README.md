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

Het hoofdweekbord bevat Desserttaart & fruit, Luxe gebak, Kapseltaarten en Slagroomgebak. Bakafdeling, Brood, IJs en Chocolade hebben eigen weergaven. Op mobiel kies je een dag. De XL-weergave is alleen-lezen en ververst elke 15 seconden. Bij verbindingsverlies staat een waarschuwing boven de oude gegevens.

Onderdelen kunnen zonder recept worden toegevoegd en later gekoppeld. Taken zijn te plannen, te verplaatsen en af te ronden. Vervolgstappen verwijzen naar een eerdere stap in dezelfde batch; één batch registreert hoogstens één output. Afdelingen die niet bekend zijn uit de bron krijgen 'Afdeling controleren'. Managers kunnen die indeling en opmerkingen aanpassen.

De teller registreert productie, geen bewezen actuele voorraad. Onbekende voorraad blijft onbekend. Automatische verkoopprognoses, verbruik/uitgifte, werkelijke batchopbrengst, capaciteitsnormen en automatische orderimport zijn volgende bouwstappen. De eerdere receptuur- en managementschermen blijven beschikbaar en delen de nieuwe opslag.

## Verificatie

- `node --test tests/*.test.cjs scripts/specsplaza.test.cjs scripts/specsplaza-link.test.cjs`
- ESLint, TypeScript en Next-productiebuild.
- `app/supabase/tests/production_workspace_smoke.sql`: rollbacktest op lege opslag voor directe toegangsrechten, reconstructie van auditpatches en bescherming tegen een verouderde revisie. Op de echte database geslaagd vóór import.
- Live controleren: broncontrole, overdracht, teruglezen, financiële afscherming, één taak bewaren en na herladen terugvinden, plus dezelfde planning op een tweede scherm.
