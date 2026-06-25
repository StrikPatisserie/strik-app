import RecepturenApp from "../recepturen/RecepturenApp";

export default function BakkerijOverzichtPage() {
  return (
    <RecepturenApp
      scope="all"
      initialTab="start"
      lockedTab="start"
      hideTopNav
      showProductionLinks
    />
  );
}
