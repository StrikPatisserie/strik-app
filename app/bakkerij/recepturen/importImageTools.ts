const OCR_IMAGE_MAX_SOURCE_BYTES = 35 * 1024 * 1024;
const OCR_IMAGE_MAX_SIDES = [1600, 1200, 900];
const OCR_IMAGE_QUALITIES = [0.78, 0.66, 0.55];
const OCR_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

export function isRecipeImportImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  return (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "tif", "tiff", "heic", "heif"].includes(
      extension
    )
  );
}

export async function prepareRecipeImportFile(file: File) {
  if (!isRecipeImportImage(file)) return file;

  if (file.size > OCR_IMAGE_MAX_SOURCE_BYTES) {
    throw new Error("Foto is te groot. Maak de foto iets dichterbij of lager in kwaliteit.");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Foto kon niet worden voorbereid.");
  }

  let bestBlob: Blob | null = null;

  for (const maxSide of OCR_IMAGE_MAX_SIDES) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    enhanceCanvasForOcr(context, canvas.width, canvas.height);

    for (const quality of OCR_IMAGE_QUALITIES) {
      const blob = await canvasToJpegBlob(canvas, quality);
      bestBlob = !bestBlob || blob.size < bestBlob.size ? blob : bestBlob;

      if (blob.size <= OCR_IMAGE_MAX_BYTES) {
        return new File([blob], ocrJpegFileName(file.name), {
          type: "image/jpeg",
        });
      }
    }
  }

  if (!bestBlob) {
    throw new Error("Foto kon niet worden voorbereid.");
  }

  return new File([bestBlob], ocrJpegFileName(file.name), {
    type: "image/jpeg",
  });
}

function enhanceCanvasForOcr(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (luminance - 128) * 1.7 + 128));
    pixels[index] = contrast;
    pixels[index + 1] = contrast;
    pixels[index + 2] = contrast;
  }

  context.putImageData(imageData, 0, 0);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Foto kon niet gelezen worden."));
    reader.onerror = () => reject(new Error("Foto kon niet gelezen worden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "Foto kon niet worden geopend. Probeer JPG/PNG of zet livefoto/HEIC uit."
        )
      );
    image.src = dataUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Foto kon niet worden verkleind.")),
      "image/jpeg",
      quality
    );
  });
}

function ocrJpegFileName(fileName: string) {
  const cleanName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return `${cleanName || "receptfoto"}-ocr.jpg`;
}
