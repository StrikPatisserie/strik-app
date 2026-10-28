# Persoonlijke to-do’s en Evernote

Persoonlijke pagina `/persoonlijk`; lokale, ontwikkel-only preview `/preview/persoonlijk`. Preview gebruikt uitsluitend fictieve gegevens in React-geheugen, geen browseropslag of echte API-import. De preview is in productie niet publiek beschikbaar.

## Toegang en inrichting

1. Voer `app/supabase/migrations/20261028170000_personal_notes.sql` uit in de bestaande Supabase-database.
2. De migratie registreert uitsluitend het door de gebruiker bevestigde, geverifieerde Auth-account `feline@strik-patisserie.nl`, via zijn onveranderlijke gebruikers-ID. Controleer dat er precies die inschrijving bestaat. Zonder die inschrijving blijft het menu verborgen en de pagina geblokkeerd.
3. Voer `app/supabase/tests/personal_notes_smoke.sql` uit. Dit vereist een tweede manager, simuleert eigenaar/andere manager/AAL1/verlopen MFA en rolt testgegevens terug.
4. Publiceer de app pas na deze databasecontrole. De bestaande Supabase-configuratie moet beschikbaar zijn; voor dit onderdeel is geen service-role key nodig.

Een managementrol of bewerkbare profielpermissie verleent nooit toegang. De server leest de inschrijving uit een aparte RLS-tabel; de menu-capability wordt uitsluitend daaruit berekend. Pagina en API controleren opnieuw. Notities en bestanden vereisen zowel eigenaar-ID als expliciete inschrijving, actief managementprofiel en een TOTP-verificatie van maximaal zeven dagen oud. Database- en Storage-RLS controleren dit ook bij direct gebruik van Supabase. De source-bestanden kunnen niet door browseraccounts worden overschreven of verwijderd. Restrictieve Storage-policies voorkomen dat bestaande brede opslagpolicies de privébucket alsnog openstellen.

Andere app-accounts hebben geen toegang. Dit is geen end-to-endversleutelde kluis: Supabase/projectbeheerders en infrastructuur met servicecredentials blijven technisch bij de opslag kunnen. Er gaat geen notitie-inhoud naar WordPress of AI-diensten. Responses zijn `private, no-store`; bijlagen worden na authenticatie gedownload als inert bestand, nooit als actieve HTML/SVG op de app-origin.

## Evernote-overdracht

- Desktop-export per notitieboek als ENEX, alle eigenschappen ingeschakeld. Bestandsnaam bepaalt de notitieboeknaam; ENEX bevat geen betrouwbare volledige notitieboekstructuur. Meerdere ENEX-bestanden kunnen tegelijk worden gecontroleerd.
- Parser draait lokaal in de browser. Voor de eerste upload worden alle omgezette notities gevalideerd. Tekst, aanwezige afvinkvakjes, labels, brondata en ingebedde bestanden worden overgenomen. Tabellen/opmaak worden vereenvoudigd tot leesbare tekst. HTML wordt nooit als HTML uitgevoerd. Versleutelde inhoud blijft versleuteld in de bronexport; aanvullende taakgegevens krijgen een expliciete controlewaarschuwing.
- De ongewijzigde bronexport wordt eerst in de private bucket bewaard en vanuit iedere bijbehorende notitie bereikbaar. Dit behoudt oorspronkelijke opmaak en metadata die niet als werkbare velden worden getoond. Alleen inhoud die daadwerkelijk in de export staat kan worden overgezet; geen volledige versiegeschiedenis of ontbrekende zelfstandige Evernote-functies.
- SHA-256 identificeert bestanden en importnotities. Identieke notities die binnen dezelfde export meerdere keren voorkomen blijven aparte notities. Dezelfde export opnieuw importeren overschrijft geen handmatige notitiewijzigingen. Bij fout stopt de import met aantallen; reeds opgeslagen notities blijven behouden en kunnen veilig worden hervat via dezelfde export.
- Limieten: 100 MB per bronbestand, 200 MB per selectie, 5.000 notities per bestand, 500.000 tekens per notitie, 199 ingebedde bestanden plus bronexport per notitie. Over de grens volgt een expliciete fout; er wordt niet stil overgeslagen. De status telt iedere verwerkte notitie en bijlage.

## Verificatie en huidige overdrachtsstatus

Gerichte tests staan in `tests/personal-notes.test.cjs`; browsercontrole gebruikt alleen fictieve ENEX met dubbele notities, meerdere bestanden, inline-checklists, actieve HTML, XML-entiteiten en een onjuiste bijlagegrootte. SQL-smoke vereist de echte database en is geen vervanging voor de JavaScript-tests.

De echte Evernote-bibliotheek is nog niet gelezen of overgezet. De computerbediening kon niet starten (`Sky Computer Use native pipe startup failed`); er is geen bestaande ENEX-export gevonden. De huidige lokale configuratie bevat geen Supabase-verbinding, CLI of databasecredentials, dus migratie en RLS-smoke zijn nog niet in de live database uitgevoerd. Geen live-publicatie of privé-import gedaan.
