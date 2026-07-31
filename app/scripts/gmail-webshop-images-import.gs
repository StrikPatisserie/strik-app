const WEBSHOP_IMAGE_CONFIG = {
  IMPORT_URL:
    'https://strik-app.vercel.app/api/bakkerij-logistiek/webshop-images/import',
  IMPORT_KEY: 'zet-hier-dezelfde-logistiek-sleutel',

  SOURCE_LABEL: 'Afbeeldingen Webshop',
  PROCESSED_LABEL: 'Ingelezen',
  ERROR_LABEL: 'Fout',

  QUERY: 'label:"Afbeeldingen Webshop" newer_than:30d',
  MAX_THREADS: 20,
  MAX_IMAGE_ATTACHMENTS: 4,
  MAX_IMAGE_ATTACHMENT_BYTES: 1500000,
  IMPORT_VERSION: 'inline-image-v3',
};

function importWebshopAfbeeldingen() {
  const processedLabel = getOrCreateWebshopLabel_(
    WEBSHOP_IMAGE_CONFIG.PROCESSED_LABEL
  );
  const errorLabel = getOrCreateWebshopLabel_(WEBSHOP_IMAGE_CONFIG.ERROR_LABEL);
  const props = PropertiesService.getScriptProperties();
  const threads = GmailApp.search(
    WEBSHOP_IMAGE_CONFIG.QUERY,
    0,
    WEBSHOP_IMAGE_CONFIG.MAX_THREADS
  );

  threads.forEach((thread) => {
    let imported = false;
    let failed = false;

    thread.getMessages().forEach((message) => {
      const importId = `webshop-image:${WEBSHOP_IMAGE_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      if (props.getProperty(importId)) return;

      try {
        const bodyHtml = message.getBody();
        const bodyText = message.getPlainBody();
        const links = uniqueWebshopLinks_([
          ...extractWebshopHtmlLinks_(bodyHtml),
          ...extractWebshopPlainLinks_(bodyText),
        ]);
        const imageAttachments = extractWebshopImageAttachments_(message);

        const response = UrlFetchApp.fetch(WEBSHOP_IMAGE_CONFIG.IMPORT_URL, {
          method: 'post',
          contentType: 'application/json',
          muteHttpExceptions: true,
          headers: {
            'x-strik-logistics-key': WEBSHOP_IMAGE_CONFIG.IMPORT_KEY,
          },
          payload: JSON.stringify({
            key: WEBSHOP_IMAGE_CONFIG.IMPORT_KEY,
            messageId: message.getId(),
            subject: message.getSubject(),
            from: message.getFrom(),
            receivedAt: message.getDate().toISOString(),
            bodyText,
            bodyHtml,
            links,
            imageAttachments,
            sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${message.getId()}`,
          }),
        });

        const status = response.getResponseCode();
        if (status < 200 || status >= 300) {
          throw new Error(response.getContentText());
        }

        props.setProperty(importId, new Date().toISOString());
        imported = true;
      } catch (error) {
        console.error(error);
        failed = true;
      }
    });

    if (imported) thread.addLabel(processedLabel);
    if (failed) thread.addLabel(errorLabel);
  });
}

function getOrCreateWebshopLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function extractWebshopHtmlLinks_(html) {
  const links = [];
  const pattern = /\b(?:href|src)=["']([^"']+)["']/gi;
  let match;

  while ((match = pattern.exec(html || ''))) {
    links.push(decodeWebshopHtml_(match[1]));
  }

  return links;
}

function extractWebshopPlainLinks_(text) {
  return (text || '').match(/https?:\/\/[^\s"'<>]+/gi) || [];
}

function extractWebshopImageAttachments_(message) {
  const attachments = message.getAttachments({
    includeInlineImages: true,
    includeAttachments: true,
  });
  const images = [];

  attachments.forEach((attachment) => {
    if (images.length >= WEBSHOP_IMAGE_CONFIG.MAX_IMAGE_ATTACHMENTS) return;

    const contentType = String(attachment.getContentType() || '').toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(contentType)) return;

    const bytes = attachment.getBytes();
    if (
      bytes.length <= 0 ||
      bytes.length > WEBSHOP_IMAGE_CONFIG.MAX_IMAGE_ATTACHMENT_BYTES
    ) {
      return;
    }

    images.push({
      fileName: attachment.getName() || 'webshop-foto.png',
      contentType,
      size: bytes.length,
      dataBase64: Utilities.base64Encode(bytes),
    });
  });

  return images;
}

function uniqueWebshopLinks_(links) {
  const seen = {};

  return links
    .map((link) => String(link || '').trim())
    .filter((link) => /^https?:\/\//i.test(link))
    .filter((link) => {
      if (seen[link]) return false;
      seen[link] = true;
      return true;
    });
}

function decodeWebshopHtml_(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
