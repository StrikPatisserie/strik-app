import {
  StrikPageHeader,
  StrikShell,
  strikIcons,
} from "@/app/StrikUI";
import CashCountManager from "./CashCountManager";
import { readCashCountView } from "./cashCountView";

export default async function CashCountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["date", "shop", "kind"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const initialView = readCashCountView(query, "");
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Geld tellen"
        description="Kluiscontrole door de geldteller, weektotalen en definitieve stortingen per filiaal."
        icon={strikIcons.management}
        kicker="Management"
        tone="honey"
      />

      <CashCountManager initialView={initialView} />
    </StrikShell>
  );
}
