import RecepturenApp from "./recepturen/RecepturenApp";

export default function BakkerijPage() {
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
