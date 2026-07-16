import RecepturenApp from "./recepturen/RecepturenApp";
import { getCurrentProfile } from "../lib/auth/session";

export default async function BakkerijPage() {
  const profile = await getCurrentProfile();

  return (
    <RecepturenApp
      scope="all"
      initialTab="start"
      lockedTab="start"
      hideTopNav
      showProductionLinks
      profile={profile}
    />
  );
}
