import RecepturenApp from "../../recepturen/RecepturenApp";

export default function IjsChocoladeReceptenPage() {
  return (
    <RecepturenApp
      scope="iceChocolate"
      initialTab="recepten"
      lockedTab="recepten"
      hideTopNav
    />
  );
}
