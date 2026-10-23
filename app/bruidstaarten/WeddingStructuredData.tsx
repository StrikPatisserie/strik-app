import { weddingPageSchema } from "../lib/weddingSeo";

export default function WeddingStructuredData({ appointment = false }: { appointment?: boolean }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(weddingPageSchema(appointment)).replace(/</g, "\\u003c") }} />;
}
