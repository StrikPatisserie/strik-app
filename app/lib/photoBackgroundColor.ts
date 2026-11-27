// Only inspect the outside edge: foreground colours must not determine the fill.
// A colour suggestion does not alter or regenerate the original photograph.
export function photoBackgroundColor(pixels: Uint8Array, width: number, height: number) {
  const samples: number[][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue;
      const offset = (y * width + x) * 3;
      samples.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
    }
  }
  if (!samples.length) throw new Error("Geen kleuren gevonden.");
  const bins = new Map<string, number[][]>();
  for (const sample of samples) {
    const key = sample.map(value => Math.floor(value / 24)).join(":");
    const bin = bins.get(key) || [];
    bin.push(sample);
    bins.set(key, bin);
  }
  const dominant = [...bins.values()].sort((a, b) => b.length - a.length)[0];
  const seed = [0, 1, 2].map(channel => dominant.reduce((sum, sample) => sum + sample[channel], 0) / dominant.length);
  const nearby = samples.filter(sample => Math.hypot(...sample.map((value, channel) => value - seed[channel])) < 32);
  const rgb = [0, 1, 2].map(channel => Math.round(nearby.reduce((sum, sample) => sum + sample[channel], 0) / nearby.length));
  return { color: "#" + rgb.map(value => value.toString(16).padStart(2, "0")).join(""), uniform: nearby.length / samples.length >= 0.8 };
}

export function allowedPhotoColorUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "webshop.strik-patisserie.nl" && !url.port && !url.username && !url.password
      && /^\/Media\/userupload\/[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(url.pathname)
      && !url.search && !url.hash;
  } catch { return false; }
}
