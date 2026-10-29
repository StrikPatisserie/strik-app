# Snelle betaalverzoeken

`/management/betaalverzoeken` is alleen beschikbaar voor actieve beheerders met de bestaande MFA-controle. De managementstartpagina bevat een directe tegel. E-mailadres en bedrag zijn verplicht, omschrijving is optioneel. Eén klik maakt een Mollie-betaallink en verstuurt de Strik-mail; er wordt geen betaling geïncasseerd door de app.

## Inrichting

- Migratie `20261029080056_management_payment_requests.sql` is op 29 oktober 2026 toegepast op de bestaande Supabase-database `strik-team-app`. RLS staat aan; browserrollen hebben geen directe tabelrechten. De server kan de historie niet verwijderen. De SQL-smoke slaagt en rolt zijn fictieve record terug.
- Hergebruik van de aanwezige `MOLLIE_API_KEY` en de bestaande geauthenticeerde WordPress HTML-mailtransportfunctie. Die transportfunctie heeft duurzame verzendbewijzen per mail-ID en vaste afzender/reply-to info@strik-patisserie.nl. De transportnamen CUSTOMER_CONFIRMATION, CUSTOMER_REMINDER en INTERNAL_CONFIRMATION zijn technische bestaande categorieën; er wordt geen bruidstaartafspraak aangemaakt.
- Vercel-cron `/api/management-payment-requests/cron` draait iedere vijftien minuten en vereist `CRON_SECRET`. Iedere uitvoering controleert maximaal twintig verzoeken, met maximaal vier gelijktijdige taken. Een mislukte statuscontrole houdt andere verzoeken niet blijvend achter.
- Mollie-webhooks zijn gekoppeld aan de opgeslagen verzoek-ID en een HMAC-token. De body bepaalt nooit de betaalstatus: de server haalt de opgeslagen Mollie-link opnieuw op en vergelijkt ID, vast EUR-bedrag, modus en eenmaligheid.

## Verzenden en bewaken

- Bedragen worden als gehele centen opgeslagen; maximaal € 100.000,00. De link is niet herbruikbaar en heeft geen automatische verloopdatum. De betaling wordt als betaald gemarkeerd na een passende Mollie-status met betaaldatum, of na expliciete handmatige registratie van een volledig ontvangen bank- of winkelbetaling.
- Het verzoek wordt vóór de Mollie-call opgeslagen. De browser behoudt één UUID per verzendpoging en Mollie ontvangt die als Idempotency-Key. Dubbele klikken of hetzelfde verzoek opnieuw aanbieden maken geen tweede link of mail. Eenzelfde UUID met gewijzigde inhoud wordt geweigerd.
- Onbevestigde aanmaak wordt uncertain en wordt niet automatisch opnieuw uitgevoerd. Mollie bewaart idempotency-resultaten maar één uur; daarom volgt geen blinde herhaling bij een onzekere uitkomst. Er blijft een zichtbare regel om handmatig met Mollie te vergelijken.
- Klantmail en interne waarschuwing hebben verschillende, vaste transport-ID’s. Een mailfout kan met de bestaande link veilig opnieuw worden geprobeerd via het duurzame WordPress-verzendbewijs. Een onzekere WordPress-verzendstatus wordt niet omzeild met een nieuw mail-ID.
- Vanaf veertien dagen na bevestigde klantmail wordt één interne waarschuwing naar info@strik-patisserie.nl verstuurd, uitsluitend na een verse geslaagde Mollie-controle die nog geen betaling toont. De klant wordt alleen herinnerd na een expliciete klik. Het overzicht bewaart alle bevestigde verzendmomenten. Een reeds verstuurde klantherinnering maakt de oorspronkelijke veertiendagenwaarschuwing overbodig.
- De bestaande bruidstaartbetaalverzoeken en andere Mollie-betalingen worden niet geïmporteerd of gewijzigd.

## Verificatie

`tests/management-payment-requests.test.cjs` controleert centen, validatie, gelijktijdige aanvragen, behoud bij onzekere aanmaak, stabiele mail-ID’s, de veertiendagengrens, betaalde en oncontroleerbare verzoeken, HTML-escaping, beheertoegang, webhook en cron-authenticatie. `app/supabase/tests/management_payment_requests_smoke.sql` controleert de live opslagbeveiliging met rollback.

Feline heeft inmiddels één echt betaalverzoek verstuurd. Bij deze uitbreiding zijn geen echte mails verstuurd, nieuwe links aangemaakt of betalingen gemarkeerd. De bestaande verstuurde mail behoudt versie 1; nieuwe aanmaak vanuit de app schrijft expliciet versie 2. De databasemigratie en uitgebreide rollback-smoke zijn op de echte database gecontroleerd. Browserbediening is niet beschikbaar voor een interactieve eindcontrole.

## Mailvoorbeeld en rustigere opmaak

Het formulier biedt Voorbeeld mail vóór verzending. Mail bekijken bij een opgeslagen verzoek haalt uitsluitend na managementauthenticatie de betreffende inhoud op, zonder mail- of Mollie-effect. De preview is een sandbox-iframe zonder scripts of interactieve betaling. Nieuwe mails hebben een witte achtergrond, compacte merknaam, bedrag/omschrijving/referentie en één groene betaalknop; geen afbeeldingen of tracking. WordPress verzendt nog steeds vanaf en met reply-to info@strik-patisserie.nl. Weergave verschilt per mailprogramma; aflevering in de inbox is hiermee niet gegarandeerd.

De oorspronkelijke HTML-generator voor versie 1 blijft intact zodat reeds verstuurde previews en eventuele retries dezelfde mailinhoud behouden. Dit voorkomt checksum-conflicten met bestaande WordPress-verzendbewijzen. Versie 2 zet de font- en kleurstijlen op de buitenste tabel zodat WordPress-sanitatie van HTML/body-elementen de basisopmaak niet verwijdert.

## Handmatig betaald en herinneringsweek

Migratie `20261029091444_payment_request_followup.sql` voegt mailversie, auditvelden, archiefstatus en aparte duurzame mail-ID’s toe. RLS en grants blijven server-only. Elke handmatige betaling registreert betaalmoment, ingelogde actor, bank/winkel en optionele toelichting. De server controleert eerst Mollie; bij een storing kan de beheerder nog steeds een werkelijk ontvangen betaling vastleggen. Een atomische update op `paid_at is null` verhindert dat concurrerende Mollie-controles handmatige betalingen overschrijven. Betaalde verzoeken worden niet opnieuw herinnerd.

Na handmatige registratie wordt de link via Mollie PATCH met archived=true gesloten. Een mislukking wist de betaalregistratie niet: een expliciete waarschuwing blijft zichtbaar en cron probeert de archivering opnieuw. De app verbergt de betaallink van betaalde verzoeken.

Vanaf veertien dagen na bevestigde eerste verzending verschijnt ! in het overzicht. Herinnering sturen · 1 week voert eerst een nieuwe Mollie-controle uit, registreert de expliciete verzendopdracht en stuurt precies één klantherinnering met het verzoek binnen één week te betalen. Dubbele klikken gebruiken dezelfde mail-ID. Een onbevestigde verzending blijft zichtbaar en wordt met dezelfde transport-ID herhaald, nooit via een nieuw verzoek. Zonder expliciete klik verstuurt cron geen klantherinnering.

Na bevestigde verzending wordt de deadline op zeven maal 24 uur later vastgelegd. De mailtekst blijft bij retries identiek (geen wisselende datum of dagtelling). Vanaf deze deadline stuurt cron één afzonderlijke vervolgmail naar info@strik-patisserie.nl als het verzoek na een verse Mollie-controle nog openstaat. De vervolgmail vermeldt ontvanger, referentie, omschrijving en bedrag. Een mislukte Mollie-controle leidt tot een controlefout en geen waarschuwing op basis van een onbekende status. Betaalde verzoeken stoppen beide meldingen. Cron draait elk kwartier; bij grote aantallen worden maximaal twintig verzoeken per ronde eerlijk verdeeld.


Bronnen: [Mollie payment links](https://docs.mollie.com/reference/create-payment-link), [opvragen](https://docs.mollie.com/reference/get-payment-link), [idempotency](https://docs.mollie.com/reference/api-idempotency), [archiveren via update](https://docs.mollie.com/reference/update-payment-link).
