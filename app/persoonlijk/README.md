# Persoonlijke to-do’s en Evernote

Persoonlijke pagina `/persoonlijk`; lokale, ontwikkel-only preview `/preview/persoonlijk`. Preview gebruikt uitsluitend fictieve gegevens in React-geheugen, geen browseropslag of echte API-import. De preview is in productie niet publiek beschikbaar.

## Toegang en inrichting

1. Voer `app/supabase/migrations/20261028170000_personal_notes.sql` uit in de bestaande Supabase-database.
2. De migratie registreert uitsluitend het door de gebruiker bevestigde, geverifieerde Auth-account `feline@strik-patisserie.nl`, via zijn onveranderlijke gebruikers-ID. Controleer dat er precies die inschrijving bestaat. Zonder die inschrijving blijft het menu verborgen en de pagina geblokkeerd.
3. Voer `app/supabase/tests/personal_notes_smoke.sql` uit. Dit vereist een tweede manager, simuleert eigenaar/andere manager/AAL1/verlopen MFA en rolt testgegevens terug.
4. Publiceer de app pas na deze databasecontrole. De bestaande Supabase-configuratie moet beschikbaar zijn; voor dit onderdeel is geen service-role key nodig.

Een managementrol of bewerkbare profielpermissie verleent nooit toegang. De server leest de inschrijving uit een aparte RLS-tabel; de menu-capability wordt uitsluitend daaruit berekend. Pagina en API controleren opnieuw. Notities en bestanden vereisen zowel eigenaar-ID als expliciete inschrijving, actief managementprofiel en een TOTP-verificatie van maximaal zeven dagen oud. Database- en Storage-RLS controleren dit ook bij direct gebruik van Supabase. De source-bestanden kunnen niet door browseraccounts worden overschreven of verwijderd. Restrictieve Storage-policies voorkomen dat bestaande brede opslagpolicies de privébucket alsnog openstellen.

Andere app-accounts hebben geen toegang. Dit is geen end-to-endversleutelde kluis: Supabase/projectbeheerders en infrastructuur met servicecredentials blijven technisch bij de opslag kunnen. Er gaat geen notitie-inhoud naar WordPress of AI-diensten. Responses zijn `private, no-store`; bijlagen worden na authenticatie gedownload als inert bestand, nooit als actieve HTML/SVG op de app-origin.

## Historische Evernote-overdracht (importknop verwijderd)

- Desktop-export per notitieboek als ENEX, alle eigenschappen ingeschakeld. Bestandsnaam bepaalt de notitieboeknaam; ENEX bevat geen betrouwbare volledige notitieboekstructuur. Meerdere ENEX-bestanden kunnen tegelijk worden gecontroleerd.
- Parser draait lokaal in de browser. Voor de eerste upload worden alle omgezette notities gevalideerd. Tekst, aanwezige afvinkvakjes, labels, brondata en ingebedde bestanden worden overgenomen. Tabellen/opmaak worden vereenvoudigd tot leesbare tekst. HTML wordt nooit als HTML uitgevoerd. Versleutelde inhoud blijft versleuteld in de bronexport; zelfstandige Evernote-taken worden op volgorde als afvinkbare taken overgenomen, inclusief status en vlag voor prioriteit. Lege taken krijgen een herkenbare aanduiding; terugkerende taken krijgen een controlewaarschuwing en behouden hun herhaling in de bronexport.
- De ongewijzigde bronexport wordt eerst in de private bucket bewaard en vanuit iedere bijbehorende notitie bereikbaar. Dit behoudt oorspronkelijke opmaak en metadata die niet als werkbare velden worden getoond. Alleen inhoud die daadwerkelijk in de export staat kan worden overgezet; geen volledige versiegeschiedenis of ontbrekende zelfstandige Evernote-functies.
- SHA-256 identificeert bestanden en importnotities. Identieke notities die binnen dezelfde export meerdere keren voorkomen blijven aparte notities. Dezelfde export opnieuw importeren overschrijft geen handmatige notitiewijzigingen. Bij fout stopt de import met aantallen; reeds opgeslagen notities blijven behouden en kunnen veilig worden hervat via dezelfde export.
- Limieten: 100 MB per bronbestand, 200 MB per selectie, 5.000 notities per bestand, 500.000 tekens per notitie, 199 ingebedde bestanden plus bronexport per notitie. Over de grens volgt een expliciete fout; er wordt niet stil overgeslagen. De status telt iedere verwerkte notitie en bijlage.

## Verificatie en huidige overdrachtsstatus

Gerichte tests staan in `tests/personal-notes.test.cjs`; browsercontrole gebruikt alleen fictieve ENEX met dubbele notities, meerdere bestanden, inline-checklists, actieve HTML, XML-entiteiten en een onjuiste bijlagegrootte. SQL-smoke vereist de echte database en is geen vervanging voor de JavaScript-tests.

Op 29 oktober 2026 is de bestaande migratie toegepast op Supabase-project `strik-team-app`. Er is precies één passend geverifieerd eigenaaraccount gevonden. De RLS-smoke slaagt op de echte database: eigenaar, andere manager, AAL1 en verlopen MFA zijn gecontroleerd; alle fictieve notities en bestandsmetadata zijn teruggerold. De rooktest accepteert ook de expliciete weigering van Supabase om Storage-metadata rechtstreeks te verwijderen; dit versoepelt geen toegangsbeleid.

De persoonlijke omgeving is beschikbaar voor Feline via de bestaande startpagina en `/persoonlijk`. Op 29 oktober 2026 zijn de aangeleverde exports lokaal volledig gelezen en gecontroleerd: Vergaderingen bevat één notitie met tien taken (negen open, waaronder twee lege taken); TO DO bevat één notitie met 69 taken (57 open) en vijf bijlagen; Belangrijke gegevens bevat één notitie en drie bijlagen. In totaal drie notities, 79 taken waarvan 13 afgerond, acht bijlagen en drie originele bronexports.

Feline gebruikt vanaf nu uitsluitend de eigen notitie-app. De Evernote-importknop en de volledige importdialoog zijn daarom uit de interface verwijderd. De historische parser blijft beschikbaar voor de gerichte tests. Er is geen exportinhoud in Git, publieke bestanden of logbestanden opgenomen. De eerder door de agent gecontroleerde exports zijn niet door de agent naar het account geüpload; de gebruiker heeft inmiddels aangegeven de drie onderdelen in de app te gebruiken.

## Taken indelen

Alleen het notitieboek TO DO (ook geschreven als To do’s) heeft een takenpaneel met Nu doen (open, zonder later), Prioriteit, Voor later, Afgerond en Alles. Prioriteit kies je per taak. De knop Subtaak plaatst een nieuwe taak onder de gekozen hoofdtaak, na bestaande onderliggende taken. Maximaal acht niveaus; afvinken van een hoofdtaak verandert geen subtaken. Bij gefilterde subtaken blijven bovenliggende taken zichtbaar voor context. Nieuwe taken worden toegevoegd met een invoerveld; taaktekst bewerken kan afzonderlijk via Bewerken bij de betreffende taak.

Taken blijven transparant in de bestaande notitietekst opgeslagen: `[ ] Taak`, `[ ] [prioriteit] Taak`, `[ ] [later] Taak`; twee spaties betekenen een niveau dieper. Er zijn geen aanvullende tabellen of permissies nodig. Een mislukte opslag houdt de wijziging als bewerkbaar concept zichtbaar. De importhash bevat ook zelfstandige taakgegevens zodat gewijzigde taken niet onzichtbaar dezelfde importidentiteit krijgen.

## Notitiepagina’s en categorieën

Vergaderingen, Belangrijke gegevens en andere notitieboeken zijn gewone notitiepagina’s: geen taakpaneel, taakbediening of telling. Eventuele bestaande checklistregels worden als gewone opsomming leesbaar gehouden. Bij opslaan telt de API voor deze boeken nul open taken; het overzicht Open taken beperkt zich tot to-do-boeken. Bestaande inhoud en bronbijlagen worden niet verwijderd.

TO DO heeft de standaardcategorieën Administratie to do’s, Winkel to do’s en Dagelijkse to do’s, plus Algemeen voor bestaande ongecategoriseerde taken. Zelf categorieën toevoegen kan met + Categorie. Per hoofdtaak is er een categoriekeuze; verplaatsen neemt alle subtaken, hun status en prioriteit mee. Subtaken horen bij de categorie van hun hoofdtaak. Categorieën worden als `## Naam` in de bestaande notitietekst bewaard, ook als ze nog leeg zijn; er is geen schemawijziging nodig. Categorieën filteren samen met Nu doen/Prioriteit/Voor later/Afgerond.

Alle menutoepassingen gebruiken via `strikIcons.personalTodo` het bestaande Strik-notitie-icoon `/icons_strik.svg`, zodat schaal en tekenstijl bij de overige pictogrammen passen.

## Herstel en bescherming van de takenlijst

Het gewone notitie-editorvenster biedt voor TO DO uitsluitend titel en notitieboek aan. De complete taakinhoud staat niet meer in één bewerkbaar tekstvak; taken worden afzonderlijk bewerkt in het taakpaneel. Gewone notitiepagina’s behouden hun teksteditor. Onder het taakpaneel wordt geen tweede weergave van de oude Evernote-tekst meer gerenderd.

Op 29 oktober 2026 is op expliciet verzoek een leeg gemaakte TO DO-notitie rechtstreeks hersteld vanuit de aangeleverde ENEX-export, met controle van de bestaande revisie en lege inhoud. De 69 oorspronkelijke taken (waarvan 12 afgerond) zijn ingedeeld; de elf aanvullende actiepunten uit de notitietekst zijn onder twee hoofdtaken als subtaken opgenomen. Totaal: 82 taken, 70 open. De bestaande bijlagen en bronexport bleven behouden; de opgeslagen inhoud is met SHA-256 teruggecontroleerd. Ooit/Later-groepen zijn als Voor later behouden. Geen individuele taakteksten, herstel-SQL of exportbestanden zijn in Git opgenomen.

## Categorie verwijderen en bijlagen uit beeld

Kies een categorie en klik Categorie verwijderen. Alle inhoud uit die categorie gaat naar Algemeen, inclusief afgeronde taken, prioriteiten en geneste subtaken. Ook lege en standaardcategorieën kunnen weg; Algemeen blijft de vaste opvangcategorie. Het verwijderen wordt samen met de verplaatsing als één revisiebeveiligde notitiewijziging opgeslagen. Een expliciete `## Algemeen`-sectie bewaart de gekozen categorieënset, zodat standaardcategorieën niet opnieuw verschijnen. Zelf opnieuw toevoegen blijft mogelijk.

In TO DO zijn het bijlagenblok, de bijlagentelling op de notitiekaart en de oude Evernote-brondatum verborgen. De privébestanden en hun verwijzingen blijven bewaard. Gewone notitiepagina’s behouden hun bestaande bijlagenweergave.
