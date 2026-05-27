export const runtime = "nodejs";

const WORDPRESS_MEDIA_URL =
  process.env.WORDPRESS_MEDIA_URL ||
  "https://strik-patisserie.nl/wp-json/wp/v2/media";
const WORDPRESS_CLEANING_PHOTO_URL =
  process.env.WORDPRESS_CLEANING_PHOTO_URL ||
  "https://strik-patisserie.nl/wp-json/strik/v1/cleaning-photo";
const WORDPRESS_CLEANING_API_KEY =
  process.env.WORDPRESS_CLEANING_API_KEY || "schoonmaak-ijs-strik";
const MAX_CLEANING_PHOTO_BYTES = 750_000;

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

function bufferToArrayBuffer(buffer: Buffer) {
  return new Uint8Array(buffer).buffer;
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

async function uploadViaCleaningEndpoint(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  sourceFormData: FormData
) {
  const url = new URL(WORDPRESS_CLEANING_PHOTO_URL);
  url.searchParams.set("key", WORDPRESS_CLEANING_API_KEY);

  const formData = new FormData();
  formData.set(
    "file",
    new Blob([bufferToArrayBuffer(fileBuffer)], { type: contentType }),
    fileName
  );

  ["label", "winkel", "datum", "planType"].forEach((key) => {
    const value = getFormValue(sourceFormData, key);
    if (value) formData.set(key, value);
  });

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = (await res.json().catch(() => null)) as {
    id?: number;
    url?: string;
    fileName?: string;
    message?: string;
  } | null;

  if (!res.ok || !data?.url) {
    return {
      ok: false as const,
      status: res.status,
      message: data?.message || "Foto uploaden naar WordPress mislukt.",
    };
  }

  return {
    ok: true as const,
    id: data.id,
    url: data.url,
    fileName: data.fileName || fileName,
  };
}

async function uploadViaWordPressMedia(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
) {
  const { username, password } = getWordPressCredentials();

  if (!username || !password) {
    return {
      ok: false as const,
      status: 503,
      message: "WordPress media upload is nog niet ingesteld in Vercel.",
    };
  }

  const res = await fetch(WORDPRESS_MEDIA_URL, {
    method: "POST",
    headers: {
      Authorization: createBasicAuthHeader(username, password),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": contentType,
    },
    body: bufferToArrayBuffer(fileBuffer),
  });

  const data = (await res.json().catch(() => null)) as {
    id?: number;
    source_url?: string;
    message?: string;
  } | null;

  if (!res.ok || !data?.source_url) {
    return {
      ok: false as const,
      status: res.status,
      message: data?.message || "Foto uploaden naar WordPress mislukt.",
    };
  }

  return {
    ok: true as const,
    id: data.id,
    url: data.source_url,
    fileName,
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { message: "Geen foto ontvangen om te uploaden." },
      { status: 400 }
    );
  }

  if (file.size > MAX_CLEANING_PHOTO_BYTES) {
    return Response.json(
      {
        message:
          "Foto is nog te groot om veilig naar WordPress te sturen. Maak de foto opnieuw of probeer een kleinere uitsnede.",
      },
      { status: 413 }
    );
  }

  const fileName = sanitizeFileName(file.name);
  const contentType = file.type || "application/octet-stream";
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const cleaningUpload = await uploadViaCleaningEndpoint(
    fileBuffer,
    fileName,
    contentType,
    formData
  );

  if (cleaningUpload.ok) {
    return Response.json(cleaningUpload);
  }

  const mediaUpload = await uploadViaWordPressMedia(
    fileBuffer,
    fileName,
    contentType
  );

  if (mediaUpload.ok) {
    return Response.json(mediaUpload);
  }

  return Response.json(
    {
      message:
        cleaningUpload.message ||
        mediaUpload.message ||
        "Foto uploaden naar WordPress mislukt.",
    },
    { status: cleaningUpload.status || mediaUpload.status || 502 }
  );
}
