# Persoonlijke Noot mailimport

In het bestaande Google Apps Script-project **Strik Logistiek import** staat een apart bestand `Persoonlijke Noot.gs`, overeenkomstig `gmail-persoonlijke-noot-import.gs`. Het gebruikt de bestaande logistiek-sleutel uit `WEBSHOP_IMAGE_CONFIG`; geen sleutel in Git plaatsen.

1. Publiceer de app vóór het Apps Script.
2. Voer `controleerPersoonlijkeNootVoorbeeld` uit. Deze leest het werkelijk ontvangen voorbeeldbestand, doet een dry run en bewaart alleen de geslaagde teststatus. Geen klantbestelling of afhaalregistratie ontstaat.
3. Voer eenmalig `maakPersoonlijkeNootTriggerAan` uit, daarna `importPersoonlijkeNoot`. De trigger controleert iedere 30 minuten van 07:00 tot 22:00. Andere imports/triggers blijven intact.

## CSV, seizoen en prijzen

Ondersteunde bron: de elf kolommen van het supplier-order-voorbeeld van 26 november 2026. `firstname`, `middlename`, `lastname` worden samengevoegd; `code` blijft als klantcode zichtbaar. De kaartwaarde staat in `sku`, de winkel in `option`. De volgordeletter voor de winkel is niet bepalend; de winkelnaam/adres is dat wel. Wijchen wordt niet toegewezen.

Een regel is uniek op seizoen, bestelnummer, klantcode en SKU. Herhalen overschrijft nooit een afhaalvinkje, factuur of handmatige correctie. Bij een afwijkende bestaande regel blijft de oude regel staan en krijgt de mail een controlelabel. Annuleringen en gewijzigde SKU's moeten handmatig worden gecontroleerd; het voorbeeld definieert hiervoor geen status- of regel-ID-kolom.

De besteldatum komt uit `Nieuwe bestelling dd-mm-jjjj` in het onderwerp, anders uit de ontvangstdatum. Ophalen vanaf twee werkdagen daarna (weekenden, 1 januari, 25/26 december overgeslagen). Januari t/m april vallen onder het voorgaande seizoen. De afspraak in de meegestuurde 2026-mail is: €17,50 → €12,84 excl., €25 → €18,35 excl., €45 → €33,03 excl., €50 → €36,70 excl. Andere waarden en toekomstige seizoenen houden een onbekende factuurprijs. Het facturatieoverzicht rekent uitsluitend werkelijk afgehaalde regels mee. De 2% eindbonus uit de afspraak wordt niet automatisch als factuurkorting toegepast.

## Bij fouten en downloadlinks

CSV-bijlagen worden ingelezen; tijdelijke fouten krijgen maximaal drie pogingen met minstens twee uur ertussen. Mislukte mails blijven in de inbox onder **Persoonlijke Noot controleren**. De uitvoeringslog vermeldt de reden. Voor opnieuw proberen na correctie verwijder je de betreffende `pn-csv-v1:<messageId>` Script Property, of importeer je het gecorrigeerde CSV-bestand via de app.

Mails met alleen een CSV/XML-downloadlink krijgen hetzelfde controlelabel. Er worden nog geen links automatisch opgehaald: de definitieve aanlevering en een werkende link moeten eerst gecontroleerd worden. Mail en originele CSV blijven bewaard. Voorbeeld-/samplebestanden en rijen met de aangeleverde voorbeeldnamen worden altijd als test behandeld, ook als `dryRun` ontbreekt.

De app toont onder de importsectie de laatste mailboxcontrole, test en succesvolle import. Als `laatste mailboxcontrole` een werkdag achterloopt, controleer de trigger en uitvoeringslog in Apps Script. De endpoint accepteert alleen de bestaande geconfigureerde logistiek-sleutel in de header; gewone winkellogins geven geen toegang tot deze import.
