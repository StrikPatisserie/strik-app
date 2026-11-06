# Productie opteller — lokale preview

Start met `npm run dev -- --hostname 127.0.0.1 --port 3016` en open
`http://127.0.0.1:3016/preview/b2b-productie`.

Alleen de knop **Productie opteller** wordt aan de bestaande Sint- en Kerst-B2B-lijst
voor management/logistiek toegevoegd. Geen afzonderlijke productie- of inpakpagina.
Het bestaande productie-vinkje heet nu **Klaar** (bij gemengde orders: overige
producten klaar). Producten van definitieve orders tellen niet meer mee zodra
productionDone, ingepakt of geleverd is aangevinkt. Het bestaande invoer-vinkje
in Bake-it op orderniveau blijft hiervan onafhankelijk.

Per product bevat het venster totalen en een verdeling naar klant en leverdatum.
Een handmatige Bake-it-registratie bewaart aantal, productiedatum, maker en
wijzigingshistorie. Een bestaande registratie kan worden verhoogd of een extra
batch kan op een andere datum worden geregistreerd. Dit stuurt niets naar Bake-it.

Registraties dekken de eerstvolgende open orders op leverdatum. De onderliggende
orderverdeling blijft bewaard. Als order A klaar is, financiert de oude registratie
voor A dus niet stilzwijgend nieuwe order B. Meer vraag bij dezelfde order wordt
wel als extra vraag zichtbaar. Bij kleinere/geannuleerde orders wordt geen
productie automatisch naar andere orders overgeheveld. Oude registraties blijven
bewaard en vermelden zo nodig hoeveel nog voor open orders geldt.

**Preview:** de bron wordt uitsluitend gelezen. Proefvinkjes zijn tijdelijk;
Bake-it-proefregistraties staan onder een aparte sleutel in localStorage, alleen
op dit apparaat. Ze worden nooit naar de API of echte bestellingen gestuurd.
Contactgegevens, adressen en prijzen gaan niet naar de preview. De route is alleen
in ontwikkeling op een lokale host beschikbaar; productie geeft een 404.

**Voorbereide app-integratie:** `/api/b2b-bakeit` vereist een actief management- of
logistiekprofiel. De server controleert de actuele B2B-productvraag en bewaart één
apart document per seizoen/jaar in de bestaande centrale `app_settings`-opslag.
De opslag gebruikt conditionele insert/update op documentrevisie; gelijktijdige
wijzigingen overschrijven elkaar niet. Operatie-ID's voorkomen dubbeltelling bij
herhaalde aanvragen na een verloren antwoord. Geen nieuwe tabel of publieke
schrijfroute, geen wijziging van B2B-orders en geen wijzigingsmails.

Verschillende productuitvoeringen blijven apart. Speculaasbrok met letter telt
als brok; losse letters blijven in de letterplanning. Een Strik DUO wordt alleen
bij twee bekende keuzes gesplitst in de twee zakjes. Onbekende samenstellingen
worden niet geraden. Onleesbare regels worden gemeld, ook in gekopieerde lijsten.

Er is niets gepubliceerd en er zijn geen centrale proefregistraties aangemaakt.
