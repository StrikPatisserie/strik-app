import RecepturenApp from "../recepturen/RecepturenApp";

export default function BakkerijReceptenPage() {
  return (
    <RecepturenApp
      scope="bakery"
      initialTab="recepten"
      lockedTab="recepten"
      hideTopNav
    />
  );
}
