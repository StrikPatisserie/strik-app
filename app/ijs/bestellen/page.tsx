import { redirect } from "next/navigation";

const BESTELSITE_URL =
  "https://evstrikb2b.extravestiging.nl/SignOn.aspx?ReturnUrl=%2f";

export default function IjsBestellenPage() {
  redirect(BESTELSITE_URL);
}
