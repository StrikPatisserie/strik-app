import { TemperatureRegistrationOverviewPage } from "../../../../winkel/schoonmaak-registratie/overzicht/page";
import {
  bakkerijTemperatureOptions,
  bakkerijTemperatureRows,
} from "../../../../winkel/schoonmaak-registratie/temperatureRegistrationShared";

export default function BakkerijTemperatuurregistratieOverzichtPage() {
  return (
    <TemperatureRegistrationOverviewPage
      title="Temperatuurregistratie"
      kicker="Bakkerij HACCP week- en maandoverzicht"
      locationOptions={bakkerijTemperatureOptions}
      rowsByLocation={bakkerijTemperatureRows}
      defaultLocationId="bakkerij"
      registrationHref="/bakkerij/schoonmaak/temperatuurregistratie"
      loadCleaningFallback={false}
      allLocationsLabel="Alle bakkerijlocaties"
    />
  );
}
