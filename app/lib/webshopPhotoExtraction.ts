/** Deterministic extraction: each uploaded photo stays attached to its own order line. */
export type WebshopPhotoSource = {
  bodyHtml: string;
  bodyText: string;
  links: string[];
  photoUrl: string;
  fileName: string;
  productSummary: string;
  imageAttachments: { fileName: string; dataUrl: string }[];
};
export type ExtractedWebshopPhoto = {
  photoUrl: string;
  fileName: string;
  sourceLineId: string;
  sourceLineNumber: number;
  productSummary: string;
  productQuantity?: number;
};
type HtmlRow = { html: string; start: number; end: number };
type Reference = { fileName: string; urls: string[]; preferredUrls?: string[]; product: string; quantity?: number; line: string; number: number };

function decode(value: string) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp|euro);|&#(?:x[0-9a-f]+|\d+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&euro;': '€' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = Number.parseInt(entity.slice(2, -1).replace(/^x/i, ''), /^&#x/i.test(entity) ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}
function text(html: string) {
  return decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<wbr\b[^>]*>/gi, '').replace(/<br\b[^>]*>|<(?:ul|ol|li)\b[^>]*>|<\/(?:p|div|tr|li|dt|dd|h\d)>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .split(/\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}
function http(value: string) {
  try { const url = new URL(decode(value).trim()); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function urls(html: string, attribute = '(?:href|src)') {
  return [...html.matchAll(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, 'gi'))].map(match => http(match[1])).filter(Boolean);
}
function fileBase(value: string) {
  let decoded = decode(value);
  try { decoded = decodeURIComponent(decoded); } catch { /* A malformed escape never causes a guessed match. */ }
  return decoded.split(/[?#]/)[0].split(/[\\/]/).pop()?.trim() || '';
}
function fileNames(value: string) {
  // Work on visible upload metadata, not image URLs (which also include the shop logo).
  return [...value.matchAll(/(?:^|[\s:>(])([\w%][\w% .()+-]*?\.(?:jpe?g|png|webp))(?=$|[\s<)"'?#])/gi)]
    .map(match => fileBase(match[1]));
}
function matchesFile(url: string, fileName: string) {
  const expected = fileBase(fileName).toLowerCase();
  if (fileBase(url).toLowerCase() === expected) return true;
  try { return [...new URL(url).searchParams.values()].some(value => fileBase(value).toLowerCase() === expected); } catch { return false; }
}
function unique<T>(values: T[]) { return [...new Set(values)]; }
const photoLabel = /(?:foto\s*\/\s*logo|(?:foto|logo|afbeelding)\s*(?:op (?:de|uw|je) taart|upload|bestand|:)|wilt u[^\n]{0,60}(?:foto|logo))/i;
function metadataFileNames(value: string) {
  const lines = value.split(/\n/);
  const result: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!photoLabel.test(lines[index])) continue;
    // WooCommerce can put the upload value in a separate <dd> after the label.
    const afterLabel = lines[index].replace(/^.*?(?:\?:|:)/, '');
    result.push(...fileNames(afterLabel));
    if (!fileNames(afterLabel).length && lines[index + 1] && !/^(?:vulling|tekst|kleur|subtotaal|totaal)\b/i.test(lines[index + 1])) result.push(...fileNames(lines[index + 1]));
  }
  return unique(result);
}
function rowsIn(html: string): HtmlRow[] {
  const stack: number[] = [], result: HtmlRow[] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>|<\/tr\s*>/gi)) {
    if (!match[0].startsWith('</')) stack.push(match.index!);
    else {
      const start = stack.pop();
      if (start !== undefined) result.push({ html: html.slice(start, match.index! + match[0].length), start, end: match.index! + match[0].length });
    }
  }
  return result.sort((a, b) => a.start - b.start);
}
function cellsIn(html: string) {
  const cells: string[] = [];
  let depth = 0, start = 0;
  for (const match of html.matchAll(/<t[dh]\b[^>]*>|<\/t[dh]\s*>/gi)) {
    if (!match[0].startsWith('</')) { if (!depth) start = match.index! + match[0].length; depth++; }
    else if (depth && !--depth) cells.push(html.slice(start, match.index!));
  }
  return cells;
}
function rowInfo(row: HtmlRow) {
  const cells = cellsIn(row.html), first = text(cells[0] || row.html);
  const quantity = text(cells[1] || '').match(/^(?:×\s*|x\s*)?(\d{1,4})(?:\s*[x×])?$/i);
  const product = first.split('\n').find(line => !photoLabel.test(line) && !/^(?:product|aantal|totaal|vulling)\b/i.test(line)) || '';
  return { row, declared: photoLabel.test(first) && !/(?:foto\s*\/\s*logo|foto|afbeelding)[^\n]*:\s*(?:nee|geen|nvt)\b/i.test(first), names: metadataFileNames(first), product: product.slice(0, 300), quantity: quantity && +quantity[1] > 0 ? +quantity[1] : undefined };
}

export function extractWebshopPhotos(input: WebshopPhotoSource) {
  const warnings: string[] = [];
  const allUrls = unique([...input.links.map(http), ...urls(input.bodyHtml), ...(input.bodyText.match(/https?:\/\/[^\s<>"']+/gi) || []).map(http)].filter(Boolean));
  const candidates = rowsIn(input.bodyHtml).map(rowInfo).filter(row => row.names.length || row.declared);
  // Layout tables can contain the whole order. Prefer actual product rows with a quantity;
  // otherwise use the innermost row containing upload metadata, never the surrounding layout.
  const productRows = candidates.filter(row => row.quantity !== undefined);
  const chosen = productRows.length ? productRows : candidates.filter(row => !candidates.some(other => other.row.start > row.row.start && other.row.end < row.row.end));
  const references: Reference[] = [];
  chosen.forEach((item, index) => {
    const stableId = item.row.html.match(/^<tr\b[^>]*\b(?:data-order-item-id|data-item-id|id)\s*=\s*["']([^"']+)["']/i)?.[1] || `line-${index + 1}`;
    (item.names.length ? item.names : ["" ]).forEach((fileName, photoIndex) => references.push({ fileName, urls: urls(item.row.html), preferredUrls: urls(item.row.html, "href"), product: item.product, quantity: item.quantity, line: `${stableId}:photo-${photoIndex + 1}`, number: index + 1 }));
  });
  const plainNames = metadataFileNames(input.bodyText + (chosen.length ? "" : `\n${text(input.bodyHtml)}`));
  for (const fileName of plainNames) if (!references.some(reference => reference.fileName.toLowerCase() === fileName.toLowerCase())) {
    references.push({ fileName, urls: [], product: input.productSummary, line: `text-photo-${references.length + 1}`, number: references.length + 1 });
  }
  const entries: ExtractedWebshopPhoto[] = [];
  const missing: string[] = [];
  for (const reference of references) {
    const localLinks = unique((reference.preferredUrls || []).filter(url => reference.fileName ? matchesFile(url, reference.fileName) : /\/userUpload\/[^?#]+\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(url)));
    const local = localLinks.length ? localLinks : unique(reference.urls.filter(url => reference.fileName ? matchesFile(url, reference.fileName) : /\/userUpload\/[^?#]+\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(url)));
    const global = reference.fileName ? unique(allUrls.filter(url => matchesFile(url, reference.fileName))) : [];
    const attachments = unique(input.imageAttachments.filter(item => fileBase(item.fileName).toLowerCase() === fileBase(reference.fileName).toLowerCase()).map(item => item.dataUrl));
    const direct = input.photoUrl && (input.fileName.toLowerCase() === reference.fileName.toLowerCase() || matchesFile(input.photoUrl, reference.fileName)) ? input.photoUrl : '';
    const resolved = local.length === 1 ? local[0] : !local.length && global.length === 1 ? global[0] : !local.length && !global.length && attachments.length === 1 ? attachments[0] : direct && !local.length && !global.length && !attachments.length ? direct : '';
    if (!resolved) { missing.push(reference.fileName || `Bestelregel ${reference.number}: upload zonder bestandsnaam`); continue; }
    entries.push({ photoUrl: resolved, fileName: reference.fileName || fileBase(resolved), sourceLineId: reference.line, sourceLineNumber: reference.number, productSummary: reference.product, productQuantity: reference.quantity });
  }
  if (!references.length) {
    // Backwards-compatible explicit imports. Never pick an arbitrary high-scoring logo from the email.
    if (input.photoUrl) entries.push({ photoUrl: input.photoUrl, fileName: input.fileName || fileBase(input.photoUrl), sourceLineId: '', sourceLineNumber: 1, productSummary: input.productSummary });
    else {
      const labelledUrls = allUrls.filter(url => /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(url) && !/strik[^/]*(?:logo|header)|(?:logo|header)[^/]*strik|facebook|instagram|spacer|signature|icon|banner/i.test(fileBase(url)));
      if (photoLabel.test(`${input.bodyText}\n${text(input.bodyHtml)}`) && labelledUrls.length === 1) entries.push({ photoUrl: labelledUrls[0], fileName: fileBase(labelledUrls[0]), sourceLineId: '', sourceLineNumber: 1, productSummary: input.productSummary });
      else if (photoLabel.test(`${input.bodyText}\n${text(input.bodyHtml)}`) && input.imageAttachments.length === 1 && !labelledUrls.length) {
        const attachment = input.imageAttachments[0];
        entries.push({ photoUrl: attachment.dataUrl, fileName: attachment.fileName, sourceLineId: '', sourceLineNumber: 1, productSummary: input.productSummary });
      } else warnings.push('Geen eenduidige koppeling tussen upload, foto en bestelregel. Controleer de oorspronkelijke mail; er wordt geen willekeurige afbeelding gekozen.');
    }
  }
  const plainRequests = !chosen.length ? input.bodyText.split(/\n/).filter(line => photoLabel.test(line) && !/:\s*(?:nee|geen|nvt)\b/i.test(line)).length : 0;
  if (plainRequests > references.length && references.length) warnings.push('Meer foto-opties dan eenduidige fotoverwijzingen gevonden. Controleer de oorspronkelijke bestelregels.');
  if (missing.length) warnings.push(`${missing.length} aangekondigde foto('s) ontbreken of zijn niet eenduidig te koppelen: ${missing.join(', ')}.`);
  return { entries, expectedCount: Math.max(plainRequests, references.length || entries.length), missing, warnings, complete: entries.length > 0 && missing.length === 0 && warnings.length === 0 };
}
