import { StrikShell } from "@/app/StrikUI";
import CashCountManager from "./CashCountManager";

export default function CashCountPage() {
  return (
    <StrikShell wide>
      <header className="mb-2">
        <h1 className="text-lg font-black leading-none text-[#1a1815]">
          Geld tellen
        </h1>
      </header>

      <CashCountManager />
    </StrikShell>
  );
}
