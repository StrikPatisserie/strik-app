import StrikWebsiteHeader from "../StrikWebsiteHeader";
import { WEDDING_WEBSITE_ORIGIN, WEDDING_WEBSITE_PATH } from "../lib/weddingPublicSite";

export default function BridalHeader({ website = false, preview = false, booking = false }: { website?: boolean; preview?: boolean; booking?: boolean }) {
  const home = preview ? "/bruidstaarten/voorbeeld" : website ? `${WEDDING_WEBSITE_ORIGIN}${WEDDING_WEBSITE_PATH}` : "/bruidstaart";
  return <StrikWebsiteHeader bridalHref={home} booking={booking} />;
}
