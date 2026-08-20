import hotspotData from "../../../public/magazijn/verpakking/strik-magazijn-hotspots.json";
import MagazijnVerpakkingClient from "./MagazijnVerpakkingClient";

export default function MagazijnVerpakkingPage() {
  return <MagazijnVerpakkingClient data={hotspotData} />;
}
