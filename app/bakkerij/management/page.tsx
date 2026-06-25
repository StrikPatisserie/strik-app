import RecepturenApp from "../recepturen/RecepturenApp";

export default function BakkerijManagementPage() {
  return (
    <RecepturenApp
      scope="all"
      initialTab="beheer"
      lockedTab="beheer"
      hideTopNav
    />
  );
}
