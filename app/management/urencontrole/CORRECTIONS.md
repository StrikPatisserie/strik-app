# Tamigo-correcties

Lokale implementatie; niet naar productie gepubliceerd. Bestaande werkelijke diensten kunnen worden aangepast via een voorstel of handmatige invoer. Nieuwe diensten, verlof, ziekte, salarisexports en het openen/sluiten van dagen vallen buiten deze functie.

## Activering

1. Voer `app/supabase/migrations/20261023170000_tamigo_hours_corrections.sql` uit in de bedoelde omgeving. De migratie is lokaal getest met een echte Postgres-engine (PGlite); niet op de productiedatabase toegepast.
2. Laat Tamigo bevestigen dat de bestaande applicatie toegang krijgt tot `GET /actualshifts/status/day/{date}/` en `PUT /Shifts/{ShiftId}/`. De alleen-lezen proef op 23 oktober 2026 geeft voor dagstatus nog HTTP 401. Schrijfrechten zijn niet met een echte wijziging getest.
3. Pas na bevestigde toegang en een afgesproken gecontroleerde praktijkproef `TAMIGO_HOURS_WRITE_ENABLED=1` instellen. Deze variabele is nu niet aangezet. Een onbekende dagstatus blijft blokkeren, ook met de variabele aan.

De frontend kan een wijziging voorbereiden en de blokkades tonen zolang terugschrijven uitstaat. Er ontstaat pas een bevestigbaar correctierecord als bron, drempels, overlap, alle geraakte dagen en beveiligde opslag beschikbaar zijn. Het bevestigingsrecord is tien minuten geldig en gekoppeld aan de voorbereidend beheerder.

## Bevestigde gegevens en grenzen

- Bestaande `GET /v2/Shifts/` levert dienst-, medewerker- en afdelings-ID, tijden, pauze, netto uren, opmerkingen, status, IsAvailable, IsExchange en ShiftActivityId.
- De huidige eenvoudige pauzecodes zijn `1`: 15 minuten vanaf 6 bruto uren; `2`: 30 minuten vanaf 8 bruto uren. Dit zijn Tamigo-codevoorwaarden. De bedrijfscontrole blijft afzonderlijk: geplande bruto duur **strikt meer dan 8 uur**.
- Alleen vlakke, actieve pauzecodes zonder samengestelde of loonafhankelijke configuratie worden aangeboden. Er wordt geen tweede pauzeaftrek of los netto urentotaal geschreven.
- Alleen status 3 (werkelijk), een bevestigde open dag en een ondersteunde bron kunnen worden aangepast. Extra Comments2, taken, samengestelde activiteiten, competenties en pauzestartdetails worden geblokkeerd, omdat de gedocumenteerde schrijf-DTO die niet volledig vertegenwoordigt.
- Opmerkingen worden niet aangepast of aangevuld. De correctiereden staat apart in de beveiligde historie.
- De startdatum blijft gelijk. Een nachtdienst heeft expliciete begin- en einddatum; alle geraakte dagen worden gecontroleerd. Ambigue lokale tijden bij wintertijd worden niet geraden. Expliciete ISO-offsets van een berekend voorstel blijven behouden.
- Voorstellen worden op de server opnieuw berekend met de gecontroleerde regels; browserbedragen worden niet vertrouwd. Handmatige correcties mogen van de afrondingsregels afwijken en vereisen een reden.

## Bewaren en versturen

- Alleen actieve managementrollen met de bestaande MFA-controle krijgen toegang. POST vereist dezelfde origin en JSON. Directe database-toegang voor medewerkers, anonieme gebruikers en browserclients is ingetrokken.
- Oorspronkelijke bron, bedoelde correctie, gebruikte regels, reden en verantwoordelijke beheerder worden vóór de Tamigo-call opgeslagen. De oorspronkelijke snapshot is onveranderlijk.
- De database claimt een poging atomair. Een unieke index voorkomt twee actieve/onzekere pogingen op dezelfde dienst, ook vanuit verschillende app-processen. Een herhaalde bevestiging verstuurt niets opnieuw.
- Vlak vóór de PUT worden bronversie, pauzecodevoorwaarden, overlap en dagstatus opnieuw gecontroleerd. Na de PUT worden tijden, pauze, netto uren, identiteit, activiteit, status en opmerkingen teruggelezen.
- Een time-out, onleesbaar antwoord of afwijkend resultaat wordt **onzeker**, nooit automatisch opnieuw verstuurd. Een nieuwe leespoging kan een exact overeenkomend resultaat alsnog bevestigen; een niet bevestigd resultaat blijft geblokkeerd.
- De Tamigo-documentatie beschrijft geen ETag/conditionele update voor dit endpoint. De lokale blokkering beschermt app-verzoeken onderling, maar kan gelijktijdige wijzigingen rechtstreeks in Tamigo tussen de laatste GET en de PUT niet atomair verhinderen. Dit moet bij de praktijkproef met Tamigo worden besproken. Er is geen blinde automatische herstel- of herhaalactie.
- Er worden geen personeelsgegevens naar AI-diensten verstuurd. Tests en preview gebruiken uitsluitend fictieve diensten.

## Controle

```sh
node --test tests/tamigo-hours-review.test.cjs tests/tamigo-hours-corrections.test.cjs tests/management-security.test.cjs
npx eslint app/management/urencontrole app/api/tamigo-hours-review app/tamigoApi.ts
npm run build
npm run typecheck
```

Optionele SQL-proef, zonder productiedatabase of wijziging aan package.json:

```sh
npm install --prefix /private/tmp/strik-tamigo-sqlcheck --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.11
node scripts/check-tamigo-corrections-sql.cjs /private/tmp/strik-tamigo-sqlcheck
```

Deze SQL-proef controleert migratie, onveranderlijke snapshots, idempotente claims, de blokkering van een onzekere poging, hercontrole, auditvermelding van de controleur en ingetrokken directe lees-/schrijf-/verwijderrechten. Hierbij worden ook ruime Supabase-defaultgrants gesimuleerd.

Bronnen: [actuele volledige Tamigo-documentatie met bijlagen](https://support.tamigo.no/support/solutions/articles/5000867116-api-dok-pr-01-04-2024-full-versjon), [diensten bijwerken](https://support.tamigo.no/support/solutions/articles/5000793326-shift-services-), [open/gesloten urenstaat](https://support.tamigo.no/support/solutions/articles/5000793327-actual-shift-services-).
