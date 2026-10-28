# STRAK gepland

De productieomgeving gebruikt de door Strik aangeleverde Illustrator-artboards uit **strak gepland artwork.ai**. De vijf EPS-bestanden zijn alternatieve exports van deze artboards. De assets in `public/strak-gepland/` zijn kleine vectorbestanden; de originele Illustrator- en EPS-bestanden blijven onaangeroerd.

- `wordmark.svg`: woordlogo van artboard 5, met transparante achtergrond en de witte letters uitgevoerd in de aangeleverde donkerblauwe kleur. De originele lettervormen en het rode golfteken blijven vectoren; er zijn geen webfonts nodig om het logo weer te geven.
- `mark.svg`: het dubbele golfteken van artboard 2. Alleen het groene canvas is vierkant gemaakt voor app-iconen; de golven zijn niet uitgerekt of afgesneden.
- `apple-touch-icon.png`: 180 × 180-pixel export van het vierkante beeldmerk.

| Rol | Artworkkleur |
| --- | --- |
| Basisgroen | `#c3d3bb` |
| Rood accent | `#d75a4c` |
| Donkerblauw | `#1b3344` |
| Werkvlakken | Wit en lichte mengkleuren van het basisgroen |

Het gedeelde kleurgebruik staat in `app/productie/production-surfaces.css` en de huisstijllaag onderaan `app/preview/productie/production.module.css`. Zacht groen draagt de omgeving; donkerblauw dient als tekstkleur, actieve navigatie en primaire bediening. Rood markeert accenten, de huidige dag en verwijderen. Voltooide taken houden hun groene status. Schoonmaak blijft als blauwe rij herkenbaar.

De huisstijl geldt voor de volledige productieomgeving, inclusief receptuurbeheer, HACCP, temperatuurregistraties, leveranciers, rooster, feestdagen en XL. De Strik-app houdt haar eigen huisstijl; alleen de ingang naar STRAK gepland krijgt het nieuwe beeldmerk en de nieuwe naam. Technische routes, API's, toegangsrechten, gegevens en registraties houden hun bestaande identiteit.
