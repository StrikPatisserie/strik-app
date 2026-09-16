# Lettershop: veilige activatie

De publieke checkout staat standaard uit (`LETTERSHOP_CHECKOUT_ENABLED` is niet `true`).
De pagina blijft dan een concept en de API geeft 503. Zet de vlag pas aan na alle controles.

1. Voer `app/supabase/migrations/20260916030000_create_lettershop_checkout_function.sql` uit na de drie eerdere chocoladeletter-migraties. Draai daarna `app/supabase/tests/lettershop_checkout_smoke.sql`; de test eindigt met `ROLLBACK`.
2. Installeer `app/wordpress-snippets/strik-lettershop-mail-api.php` als aparte WordPress Code Snippet. De route vereist een WordPress-administrator met een Application Password.
3. Configureer op Vercel (alleen serverzijde): `WORDPRESS_MEDIA_USERNAME` en `WORDPRESS_MEDIA_APPLICATION_PASSWORD` (of bestaande `WORDPRESS_USERNAME` / `WORDPRESS_APPLICATION_PASSWORD`), `SUPABASE_SERVICE_ROLE_KEY`, een willekeurige `LETTERSHOP_RATE_SALT` en `CRON_SECRET`. Deel deze waarden niet in chat of broncode.
4. Zet `LETTERSHOP_CHECKOUT_ENABLED=true` eerst uitsluitend op een Vercel Preview-deployment. Bestel één letter met foto/logo op een geldige afhaaldatum. Controleer de order op `/sinterklaas/letters/online`, de privéafbeelding, de klantmail en de back-upmail aan `info@strik-patisserie.nl` inclusief afbeelding.
5. Controleer ook een bestelling zonder foto, dubbele klik/herhaalverzoek en een opzettelijk ongeldige upload. De uitkomst mag nooit als succesvol verschijnen zonder opgeslagen order.
6. Integreer centrale online orders in de productie- en klaarzetoverzichten voordat de shop voor klanten opengaat. Op dit moment is er alleen het aparte managementoverzicht; de bestaande productiepagina leest nog de oudere WordPress-orders.
7. Pas daarna de vlag op productie aan en herbouw/deploy de app.

Bij een tijdelijke mailfout blijft de order opgeslagen en staat de mail in `letter_mail_outbox` op `FAILED`. De retry-route wordt dagelijks via Vercel Cron aangeroepen; op Vercel Hobby zijn cronjobs maximaal dagelijks beschikbaar. Controleer die wachtrij actief tijdens de eerste live-dagen.
