# Lettershop: veilige activatie

De publieke checkout staat standaard uit (`LETTERSHOP_CHECKOUT_ENABLED` is niet `true`).
De pagina blijft dan een concept en de API geeft 503. Zet de vlag pas aan na alle controles.

1. Voer `app/supabase/migrations/20260916030000_create_lettershop_checkout_function.sql` uit na de drie eerdere chocoladeletter-migraties. Draai daarna `app/supabase/tests/lettershop_checkout_smoke.sql`; de test eindigt met `ROLLBACK`. Voer daarna `20260916040000_seed_letter_production_days_2026.sql` uit voor de voorlopige datums 10/24 november en 1 december (afhalen vanaf 12/26 november en 3 december).
2. Installeer `app/wordpress-snippets/strik-lettershop-mail-api.php` als aparte WordPress Code Snippet. De route vereist een WordPress-administrator met een Application Password.
3. Configureer op Vercel (alleen serverzijde): `WORDPRESS_MEDIA_USERNAME` en `WORDPRESS_MEDIA_APPLICATION_PASSWORD` (of bestaande `WORDPRESS_USERNAME` / `WORDPRESS_APPLICATION_PASSWORD`), `SUPABASE_SERVICE_ROLE_KEY`, een willekeurige `LETTERSHOP_RATE_SALT` en `CRON_SECRET`. Deel deze waarden niet in chat of broncode.
4. Zet `LETTERSHOP_CHECKOUT_ENABLED=true` eerst uitsluitend op een Vercel Preview-deployment. Bestel één letter met foto/logo op een geldige afhaaldatum. Controleer de order op `/sinterklaas/letters/online`, de privéafbeelding, de klantmail en de back-upmail aan `info@strik-patisserie.nl` inclusief afbeelding.
5. Controleer ook een bestelling zonder foto, dubbele klik/herhaalverzoek en een opzettelijk ongeldige upload. De uitkomst mag nooit als succesvol verschijnen zonder opgeslagen order.
6. Integreer centrale online orders in de productie- en klaarzetoverzichten voordat de shop voor klanten opengaat. `/sinterklaas/letters/centrale-productie` toont al een eerste read-only overzicht; productie registreren en klaarzetten ontbreken daar nog. De bestaande productiepagina leest nog de oudere WordPress-orders.
7. Pas daarna de vlag op productie aan en herbouw/deploy de app.

Online testorders kunnen door management definitief worden verwijderd via
`/sinterklaas/letters/online`, maar uitsluitend zolang er geen productie of
voorraadboeking aan hangt. Hiervoor moeten eerst
`20260916050000_delete_unproduced_online_orders.sql` en de vernieuwde
WordPress-snippet zijn geïnstalleerd. De order, regels, planning en oude
mailkopieën worden in één database-transactie gewist. Een tijdelijke
annuleringsmail blijft in de outbox totdat de klantmail is verstuurd en de
privéfoto's zijn opgeruimd. Voor betrouwbaar opnieuw proberen moeten de
WordPress-mailvariabelen en `CRON_SECRET` ook in Production staan voordat
management op Production orders verwijdert; dit schakelt de publieke
checkout niet in.

Bij een tijdelijke mailfout blijft de order opgeslagen en staat de mail in `letter_mail_outbox` op `FAILED`. De retry-route wordt dagelijks via Vercel Cron aangeroepen; op Vercel Hobby zijn cronjobs maximaal dagelijks beschikbaar. Controleer die wachtrij actief tijdens de eerste live-dagen.
