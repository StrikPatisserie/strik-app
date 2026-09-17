import "server-only";

type SignupNotification = {
  id: string;
  fullName: string;
  email: string;
  department: string;
  store: string;
};

export async function notifyNewSignup(request: SignupNotification) {
  const username = process.env.WORDPRESS_MEDIA_USERNAME || process.env.WORDPRESS_USERNAME;
  const password = process.env.WORDPRESS_MEDIA_APPLICATION_PASSWORD || process.env.WORDPRESS_APPLICATION_PASSWORD;
  if (!username || !password) {
    console.error("Accountaanvraagmail niet verzonden: WordPress-mail is niet ingesteld.");
    return;
  }

  try {
    const response = await fetch("https://strik-patisserie.nl/wp-json/strik/v1/account-request-mail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify(request),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error("Accountaanvraagmail niet verzonden:", error);
  }
}
