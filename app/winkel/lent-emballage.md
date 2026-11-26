# Emballagemelding Lent

- Alleen actieve profielen van winkel Lent (inclusief het bestaande winkelaccount) zien de melding op `/` en `/winkel`. Algemene managementtoegang geeft deze melding niet.
- Vercel controleert dagelijks om 08:00 Europe/Amsterdam de opgeslagen route. De UTC-schedules 06:00 en 07:00 worden door de lokale tijdcontrole teruggebracht tot één dagelijkse uitvoering. Vereist de bestaande `CRON_SECRET` en productieomgeving.
- De ochtendcontrole bewaart uitsluitend datum, controletijd en de minimale melding in `app_settings/lent-emballage-morning-check`. De winkel leest altijd opnieuw de actuele route; een ochtendmomentopname kan dus geen inmiddels verwijderde stop terugbrengen.
- Een geopende app controleert vanaf 08:00 elke minuut en bij terugkeer naar het scherm. Een slapende/gesloten app toont de actuele melding bij openen; dit is geen pushbericht.
- Alleen `shop:lent:emballage` (of een expliciet zo genoemde handmatige stop) telt. Een gewone levering aan Lent telt niet. Verwijderde stops, andere datums en fouten leveren geen ophaalbelofte op.
- Gebruik dezelfde opgeslagen volgorde, vertrektijden, rijtijden en servicetijden als de chauffeursroute. De verwachte tijd is een planning, geen GPS-positie. Ontbrekende/bij een ander adres horende rijtijden geven ‘Verwachte tijd volgt’. ‘Indien tijd’ en een conceptstatus blijven zichtbaar.
- Logistiek moet de route opslaan; automatisch gegenereerde maar nog nergens opgeslagen voorstellen worden niet als toezegging aan de winkel gebruikt.
- De ontwikkelpreview `/preview/lent-emballage` bevat alleen voorbeelddata en geeft in productie een 404.

Controle: `node --test tests/lent-emballage.test.cjs tests/logistics-route-editing.test.cjs`.
