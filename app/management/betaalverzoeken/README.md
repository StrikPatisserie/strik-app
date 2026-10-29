# Snelle betaalverzoeken

`/management/betaalverzoeken` is alleen beschikbaar voor actieve beheerders met de bestaande MFA-controle. De managementstartpagina bevat een directe tegel. E-mailadres en bedrag zijn verplicht, omschrijving is optioneel. Eén klik maakt een Mollie-betaallink en verstuurt de Strik-mail; er wordt geen betaling geïncasseerd door de app.

## Inrichting

- Migratie `20261029080056_management_payment_requests.sql` is op 29 oktober 2026 toegepast op de bestaande Supabase-database `strik-team-app`. RLS staat aan; browserrollen hebben geen directe tabelrechten. De server kan de historie niet verwijderen. De SQL-smoke slaagt en rolt zijn fictieve record terug.
- Hergebruik van de aanwezige `MOLLIE_API_KEY` en de bestaande geauthenticeerde WordPress HTML-mailtransportfunctie. Die transportfunctie heeft duurzame verzendbewijzen per mail-ID en vaste afzender/reply-to info@strik-patisserie.nl. De transportnamen CUSTOMER_CONFIRMATION en INTERNAL_CONFIRMATION zijn technische bestaande categorieën; er wordt geen bruidstaartafspraak aangemaakt.
- Vercel-cron `/api/management-payment-requests/cron` draait iedere vijftien minuten en vereist `CRON_SECRET`. Iedere uitvoering controleert maximaal twintig verzoeken, met maximaal vier gelijktijdige taken. Een mislukte statuscontrole houdt andere verzoeken niet blijvend achter.
- Mollie-webhooks zijn gekoppeld aan de opgeslagen verzoek-ID en een HMAC-token. De body bepaalt nooit de betaalstatus: de server haalt de opgeslagen Mollie-link opnieuw op en vergelijkt ID, vast EUR-bedrag, modus en eenmaligheid.

## Verzenden en bewaken

- Bedragen worden als gehele centen opgeslagen; maximaal € 100.000,00. De link is niet herbruikbaar en heeft geen automatische verloopdatum. De betaling wordt als betaald gemarkeerd na een passende Mollie-status met betaaldatum.
- Het verzoek wordt vóór de Mollie-call opgeslagen. De browser behoudt één UUID per verzendpoging en Mollie ontvangt die als Idempotency-Key. Dubbele klikken of hetzelfde verzoek opnieuw aanbieden maken geen tweede link of mail. Eenzelfde UUID met gewijzigde inhoud wordt geweigerd.
- Onbevestigde aanmaak wordt uncertain en wordt niet automatisch opnieuw uitgevoerd. Mollie bewaart idempotency-resultaten maar één uur; daarom volgt geen blinde herhaling bij een onzekere uitkomst. Er blijft een zichtbare regel om handmatig met Mollie te vergelijken.
- Klantmail en interne waarschuwing hebben verschillende, vaste transport-ID’s. Een mailfout kan met de bestaande link veilig opnieuw worden geprobeerd via het duurzame WordPress-verzendbewijs. Een onzekere WordPress-verzendstatus wordt niet omzeild met een nieuw mail-ID.
- Vanaf veertien dagen na bevestigde klantmail wordt één interne waarschuwing naar info@strik-patisserie.nl verstuurd, uitsluitend na een verse geslaagde Mollie-controle die nog geen betaling toont. Geen automatische herinnering aan de klant. Het overzicht bewaart de betaaldatum en het moment van de interne waarschuwing.
- De bestaande bruidstaartbetaalverzoeken en andere Mollie-betalingen worden niet geïmporteerd of gewijzigd.

## Verificatie

`tests/management-payment-requests.test.cjs` controleert centen, validatie, gelijktijdige aanvragen, behoud bij onzekere aanmaak, stabiele mail-ID’s, de veertiendagengrens, betaalde en oncontroleerbare verzoeken, HTML-escaping, beheertoegang, webhook en cron-authenticatie. `app/supabase/tests/management_payment_requests_smoke.sql` controleert de live opslagbeveiliging met rollback.

Geen echte betaallink aangemaakt, klant gemaild of betaling uitgevoerd tijdens de ontwikkeling. De eerste echte verzending moet nog met een door Feline gekozen ontvanger en bedrag worden gecontroleerd. Computer-/browserbediening was in deze sessie niet beschikbaar; interactieve verificatie is nog niet uitgevoerd.

Bronnen: [Mollie payment links](https://docs.mollie.com/reference/create-payment-link), [opvragen](https://docs.mollie.com/reference/get-payment-link), [idempotency](https://docs.mollie.com/reference/api-idempotency).
