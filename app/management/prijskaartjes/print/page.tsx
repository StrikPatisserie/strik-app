import Link from "next/link";
import { requireAdminProfile } from "../../../lib/auth/session";
import { readPriceCardState } from "../../../lib/priceCardStorage";
import PriceCardPreview from "../PriceCardPreview";
import PrintActions from "./PrintActions";
import styles from "./print.module.css";

export const dynamic = "force-dynamic";

export default async function PriceCardPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  await requireAdminProfile();
  const { session: sessionId = "" } = await searchParams;
  const state = await readPriceCardState();
  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return (
      <main className={styles.missing}>
        <h1>Printsessie niet gevonden</h1>
        <p>Maak de sessie opnieuw vanuit de kaartjesbibliotheek.</p>
        <Link href="/management/prijskaartjes">Terug naar prijskaartjes</Link>
      </main>
    );
  }

  const pages = session.items.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, index) => ({
      key: `${item.cardId}-${index}`,
      card: item.card,
    }))
  );

  return (
    <main className={styles.printRoot}>
      <PrintActions
        sessionId={session.id}
        initialEmailedAt={session.emailedAt}
        initialEmailedTo={session.emailedTo}
      />
      <div className={styles.sessionInfo}>
        <strong>{session.name}</strong>
        <span>{pages.length} kaartjes · {pages.length} losse PDF-pagina&apos;s</span>
      </div>
      <div className={styles.pages}>
        {pages.map((page) => (
          <div
            className={`${styles.printPage} ${page.card.category === "brood" ? styles.portraitPage : ""}`}
            key={page.key}
          >
            <PriceCardPreview card={page.card} />
          </div>
        ))}
      </div>
    </main>
  );
}
