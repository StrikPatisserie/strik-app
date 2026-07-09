import { TemperatureRegistrationPage } from "../../../winkel/schoonmaak-registratie/page";
import {
  bakkerijTemperatureOptions,
  bakkerijTemperatureRows,
} from "../../../winkel/schoonmaak-registratie/temperatureRegistrationShared";

export default function BakkerijTemperatuurregistratiePage() {
  return (
    <TemperatureRegistrationPage
      title="Temperatuurregistratie"
      kicker="Bakkerij HACCP"
      locationOptions={bakkerijTemperatureOptions}
      rowsByLocation={bakkerijTemperatureRows}
      defaultLocationId="bakkerij"
      overviewHref={null}
      loadCleaningFallback={false}
    />
  );
}
