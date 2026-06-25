import RecepturenApp from "../recepturen/RecepturenApp";

export default function BakkerijProductieplanningPage() {
  return (
    <RecepturenApp
      scope="bakery"
      initialTab="planning"
      lockedTab="planning"
      hideTopNav
    />
  );
}
