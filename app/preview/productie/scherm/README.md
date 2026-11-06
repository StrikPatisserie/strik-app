# Bakkerijscherm — lokale ontwerp- en werkstroompreview

Open `/preview/productie?scherm=1` tijdens `next dev`. Dit blijft de geïsoleerde ontwerpversie met voorbeeldgegevens. De goedgekeurde indeling is ook geïntegreerd in de bestaande live `ProductionPreview`-component, met echte gegevens en rechten. De previewroute geeft in productie een 404.

Deze preview gebruikt uitsluitend fictieve voorbeeldtaken/recepten en één eigen localStorage-sleutel (`strik-screen-preview-v1`). Er zijn geen API-aanroepen of live databasewrites. Productieverzoeken en receptberekeningen gebruiken de bestaande pure planningsfuncties.

Te beoordelen: contrast op het matte scherm, compacte dagkoppen, verzoeken rechts, aanbieding rechtsonder, nieuwe producten zonder recept, eenmalige/vastgelegde receptwijzigingen, oude/nieuwe receptwaarden, werktijdregistratie en vaste voorbereidingsdagen per halffabricaat. De aanbieding-tegel accepteert een afbeelding per week via `offers`; zonder afbeelding toont hij alleen het groene vlak. Proefwijzigingen zijn via Herstel terug te zetten.

De compacte werkbladstijl gebruikt licht afgeronde kaarten zonder schaduwen, donkerblauwe dagkoppen en mintgroene afdelingslabels met donkerblauwe tekst. De kleuren volgen STRAK gepland: mint `#C3D3BC`, navy `#1B3344`, koraalaccent `#D75A4C`. Klaar is mintgroen; koraal markeert bezig, controles en vandaag. De witte werkruimte blijft leidend.

De normale weergave toont het bestaande productiemenu links (op mobiel de onderdeelkeuze). XL-weergave verbergt het menu; uitschakelen toont het menu weer. Beide desktopstanden passen de volledige schermindeling aan de beschikbare ruimte aan, inclusief menu, bovenbalken, planning en aanbieding. Eerst worden tussenruimtes compacter, daarna wordt de grootste passende schaal berekend op basis van de werkelijk gerenderde inhoud. Geen taak wordt verborgen of afgekapt. Op mobiel blijft de normale dagweergave met scrollen beschikbaar.

Productnamen bestaan uit hele woordgroepen: ook namen met een koppelteken blijven intact. Als een woordgroep te breed is, schaalt de lettergrootte binnen die taak mee. Nieuwe taken, verzoeken, geladen afbeeldingen, fonts en gewijzigde schermmaten worden opnieuw gemeten. Dezelfde planningstate blijft tijdens het wisselen bestaan, inclusief week, filters en timers. De route opent standaard in normale weergave.

De productietimer start op naam, loopt door bij sluiten van de receptkaart en herladen, en kan worden gepauzeerd/hervat. `Af` pauzeert de meting en opent de controle van werktijd, gemaakte hoeveelheid en naam. Pas bevestiging markeert de taak als klaar en legt de waarden vast. Teruggaan laat de klok gepauzeerd. De oorspronkelijke geplande hoeveelheid en de ruwe meting blijven bewaard naast eventueel gecorrigeerde waarden. Heropenen bewaart eerdere registraties, maar begint een volgende meting met een nieuwe timer. Zonder timer kan een handmatige werktijd worden bevestigd. Dit blijft lokale opslag op één apparaat.

## Gedeelde uitvoering in de echte app

De echte planning gebruikt `app/productie/useScreenLayout.ts` en `productionWork.ts`. `POST /api/productie/werk` verwerkt expliciete opdrachten met bestaande afdelingsrechten, servertijd, ingelogde account-ID en plannerrevisie. Actie-ID's voorkomen dubbele verwerking bij herhalen. Alle tijden, bevestigde aantallen en historie zitten in het bestaande gedeelde planningsdocument; de oorspronkelijke geplande hoeveelheid blijft apart bewaard. De algemene planning-update kan deze registraties niet overschrijven.

Receptwijzigingen lopen via de bestaande gecontroleerde werkreceptopslag, met een verplichte operatornaam en éénmalige/vastgelegde keuze. Eenmalige wijzigingen bewaren een gevalideerde taakversie en raken het bronrecept niet. Permanente wijzigingen bewaren de bestaande receptidentiteit en financiële metadata en worden als concept opgeslagen. De opgegeven bakkernaam is een operatorvermelding; de ingelogde account-ID wordt daarnaast apart vastgelegd.

Voorbereidingsdagen gelden voor nieuwe receptproducties; expliciet gekozen datums en bestaande producties blijven behouden. Schoonmaak, bruidstaarten, productieverzoeken, weekaanbiedingen en verwijder-/herstelfuncties gebruiken hun bestaande opslag en rechten. Zonder recept kan vanuit Inplannen direct een nieuw onderdeel worden aangemaakt.
