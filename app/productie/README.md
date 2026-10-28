# Strik Productie — eerste preview

Status: ontwikkeling, 28 oktober 2026. Geen productie-uitrol of databasewijziging uitgevoerd.

## Wat deze versie doet

`/preview/productie` is uitsluitend beschikbaar in development en gebruikt fictieve gegevens. De eigen omgeving vervangt daar de Team-appnavigatie. Via Productie is in development een previewknop beschikbaar. Geen bestaande productieroute wordt vervangen. Deze route bevat geen live receptuur- of managementdata en roept geen schrijf-API aan.

Het hoofdweekbord bevat Desserttaart & fruit, Luxe gebak, Kapseltaarten en Slagroomgebak. Bakafdeling, Brood, IJs en Chocolade hebben eigen weergaven. Kalenderdatums blijven dagen in Nederland, ook rond zomertijd. Op mobiel kiest de gebruiker een dag, met de afdelingen eronder. De XL-weergave is alleen-lezen en meldt dat er geen live verbinding is.

Er zijn herbruikbare producten, onderdelen en werkzaamheden, met optionele receptkoppeling. Taken zijn te plannen, af te ronden en te verplaatsen via slepen of formulier. Een volgende productiestap verwijst naar de eerdere taak in dezelfde batch. Die kan niet starten vóór afronding van de voorganger. Eén batch mag hoogstens één stap hebben die voorraad oplevert. Voorraad is nadrukkelijk alleen een voorbeeld: startvoorraad plus output, zonder verkoop, verbruik of uitgifte. Voorbeeldrecepten zijn geen echte productie-instructies.

Alle wijzigingen staan onder één eigen `localStorage`-sleutel. Ze blijven op deze browser; herstel vervangt alleen de voorbeeldgegevens. Er is nog geen realtime verbinding, gedeelde opslag, plannerautorisatie, capaciteitsplanning, werkelijke opbrengstregistratie of automatische productieprognose in dit nieuwe domein.

## Gecontroleerde overdracht WordPress → Supabase

De gebruiker heeft de volledige receptuurverhuizing naar Supabase geautoriseerd, met eerst een preview. De bestaande live receptuur-API blijft daarom voorlopig op WordPress werken. Geen dubbele, gelijktijdig beschrijfbare receptuurbronnen introduceren.

1. Maak een afgeschermde volledige WordPress-export via de bestaande serverautorisatie en neem de bronrevisie en een SHA-256 op. Bewaar een herstelkopie buiten Git. Geen receptuur-, factuur- of prijsdata in logs of previewbundels.
2. Gebruik `node scripts/check-production-recipe-migration.cjs /pad/naar/export.json` voor een **offline dry run**. Deze schrijft niets. Het rapport geeft alleen aantallen, bronhash en probleemcodes met collectie/index. `ready` betekent dat deze structurele controle slaagt, niet dat productie mag omschakelen.
3. Controleer unieke bron-ID's per collectie, verwijzingen naar grondstoffen, verpakkingen en halffabricaten, vervangingen, kringverwijzingen en conceptregels met onbekende hoeveelheden. Houd bestaande IDs als tekst: geen UUID-conversie van legacy IDs en geen koppeling alleen op naam. Bewaar concepten en nulhoeveelheden met een waarschuwing; verzin geen ontbrekende receptinformatie.
4. Voeg afzonderlijke Supabase-tabellen toe voor productiecatalogus, planning, batches, productiestappen, versies en mutatiehistorie. Plan tabellen voor gedeelde recepturen/grondstoffen/regels, met afzonderlijk afgeschermde financiële gegevens. Gebruik transacties en constraints voor referenties, éénmalige batchoutput en revisies. Serverautorisatie en RLS moeten beide worden getest. Rechtstreekse toegang is standaard geweigerd totdat de rollen zijn ingericht.
5. `recipeTransferSnapshot` maakt alleen een verliesvrije kopie van de gecontroleerde export; ook onbekende toekomstige velden blijven behouden. Het is geen importadapter. De latere import moet alle bestaande gegevens meenemen: recepten, halffabricaten, grondstoffen, verpakkingen, prijs- en factuurhistorie, specificaties, SpecsPlaza-snapshots, productielogs/-verzoeken, losse planningstaken, allergenenlijsten, notities/aanbiedingen en bestelgeschiedenis.
6. Foto's apart inventariseren. Inline beeldbytes behouden; WordPress-media downloaden, aantallen en checksums vergelijken, nieuwe verwijzingen testen. Een Supabase-databaseback-up is geen back-up van Storage-objecten. Maak daar een eigen herstelprocedure voor.
7. Eerst importeren in afgeschermde stagingtabellen. Vergelijk aantallen, ID-sets, volledige genormaliseerde inhoud en beeldchecksums. Test oude receptuurweergaven, berekeningen, allergenen, financiële afscherming en terugzetten. Bij bronwijzigingen sinds export: afbreken en opnieuw vergelijken/importeren.
8. Na beoordeling één omschakelmoment plannen met korte schrijfpauze op de oude bron. Laat oud en nieuw via één serveradapter dezelfde canonieke Supabase-gegevens lezen. Geen gelijktijdig schrijven naar WordPress én Supabase. Management blijft dezelfde gegevens gebruiken met eigen prijsrechten. Nieuwe productiewijzigingen na omschakeling moeten ook in het terugvalplan behouden blijven.
9. Begin met één productieafdeling. Daarna bestellingen, winkelbehoefte, voorraad/verbruik en artikelverkoop aansluiten. Prognose en definitieve order zijn herkenbare verschillende bronnen; deduplicatie op bron-ID en bronregel, inclusief wijzigingen/annuleringen. Onbekende voorraad is onbekend, geen nul. Capaciteit pas tonen wanneer werktijdnormen en beschikbare uren zijn ingevoerd.

De huidige code heeft al recepten, halffabricaten, SpecsPlaza en eenvoudige productieplanning. Die functies zijn een herbruikbare basis. De huidige planning op verkoopgemiddelden bewijst geen complete artikelverkoopkoppeling. De live toegankelijkheid van de SpecsPlaza-productieomgeving en de kwaliteit van alle brongegevens zijn voor deze preview niet opnieuw getest.

## Gerichte verificatie

`node --test tests/production-planning.test.cjs tests/production-recipe-migration.test.cjs`

Controleer daarnaast ESLint, TypeScript en Next-build; test op desktop, mobiel en groot scherm de toevoeg-, verplaats-, status- en receptkoppelflows. De ontwikkeluitzondering voor `/preview/productie` mag in productie nooit gelden; de pagina zelf geeft daar ook `notFound()`.
