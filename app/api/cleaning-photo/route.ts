export const runtime = "nodejs";

const WORDPRESS_MEDIA_URL =
  process.env.WORDPRESS_MEDIA_URL ||
  "https://strik-patisserie.nl/wp-json/wp/v2/media";

function getWordPressCredentials() {
  return {
    username:
      process.env.WORDPRESS_MEDIA_USERNAME || process.env.WORDPRESS_USERNAME,
    password:
      process.env.WORDPRESS_MEDIA_APPLICATION_PASSWORD ||
      process.env.WORDPRESS_APPLICATION_PASSWORD,
  };
}

function sanitizeFileName(fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeName || "schoonmaak-foto.jpg";
}

function createBasicAuthHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

export async function POST(request: Request) {
  const { username, password } = getWordPressCredentials();

  if (!username || !password) {
    return Response.json(
      {
        message:
          "WordPress media upload is nog niet ingesteld in Vercel.",
      },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { message: "Geen foto ontvangen om te uploaden." },
      { status: 400 }
    );
  }

  const fileName = sanitizeFileName(file.name);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const res = await fetch(WORDPRESS_MEDIA_URL, {
    method: "POST",
    headers: {
      Authorization: createBasicAuthHeader(username, password),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: fileBuffer,
  });

  const data = (await res.json().catch(() => null)) as {
    id?: number;
    source_url?: string;
    message?: string;
  } | null;

  if (!res.ok || !data?.source_url) {
    return Response.json(
      { message: data?.message || "Foto uploaden naar WordPress mislukt." },
      { status: res.ok ? 502 : res.status }
    );
  }

  return Response.json({
    id: data.id,
    url: data.source_url,
    fileName,
  });
}
