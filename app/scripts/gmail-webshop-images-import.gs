const WEBSHOP_IMAGE_CONFIG = {
  IMPORT_URL:
    'https://strik-app.vercel.app/api/bakkerij-logistiek/webshop-images/import',
  IMPORT_KEY: 'zet-hier-dezelfde-logistiek-sleutel',

  SOURCE_LABEL: 'Afbeeldingen Webshop',
  PROCESSED_LABEL: 'Ingelezen',
  ERROR_LABEL: 'Fout',

  QUERY:
    'label:"Afbeeldingen Webshop" newer_than:7d -label:"Ingelezen" -label:"Fout"',
  RECOVERY_QUERY: 'label:"Afbeeldingen Webshop" newer_than:30d',
  MAX_THREADS: 4,
  RECOVERY_MAX_THREADS: 30,
  CLEANUP_MAX_THREADS: 25,
  MAX_IMAGE_ATTACHMENTS: 4,
  MAX_IMAGE_ATTACHMENT_BYTES: 1500000,
  IMPORT_VERSION: 'strict-match-v4',
  SCRIPT_VERSION: 'gmail-quota-v1',
  MIN_RUN_INTERVAL_MINUTES: 60,
  CLEANUP_INTERVAL_HOURS: 12,
  GMAIL_QUOTA_BACKOFF_HOURS: 12,
};

function importWebshopAfbeeldingen() {
  const props = PropertiesService.getScriptProperties();
  if (isWebshopGmailBackoffActive_(props) || !claimWebshopImportRun_(props)) {
    return;
  }

  let threads = [];
  try {
    threads = GmailApp.search(
      WEBSHOP_IMAGE_CONFIG.QUERY,
      0,
      WEBSHOP_IMAGE_CONFIG.MAX_THREADS
    );
  } catch (error) {
    if (handleWebshopGmailQuotaError_(props, error)) return;
    throw error;
  }

  if (!threads.length) {
    verplaatsWebshopIngelezenThreads_(props, false);
    return;
  }

  let processedLabel;
  let errorLabel;
  try {
    processedLabel = getOrCreateWebshopLabel_(
      WEBSHOP_IMAGE_CONFIG.PROCESSED_LABEL
    );
    errorLabel = getOrCreateWebshopLabel_(WEBSHOP_IMAGE_CONFIG.ERROR_LABEL);
  } catch (error) {
    if (handleWebshopGmailQuotaError_(props, error)) return;
    throw error;
  }
  let quotaFailed = false;

  threads.forEach((thread) => {
    if (quotaFailed) return;

    let imported = false;
    let failed = false;
    let messages = [];

    try {
      messages = thread.getMessages();
    } catch (error) {
      if (handleWebshopGmailQuotaError_(props, error)) {
        quotaFailed = true;
        return;
      }

      throw error;
    }

    messages.forEach((message) => {
      if (quotaFailed) return;

      try {
        const importId = `webshop-image:${WEBSHOP_IMAGE_CONFIG.IMPORT_VERSION}:${message.getId()}`;
        if (props.getProperty(importId)) return;

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
        if (handleWebshopGmailQuotaError_(props, error)) {
          quotaFailed = true;
          return;
        }

        console.error(error);
        failed = true;
      }
    });

    if (quotaFailed) return;

    try {
      if (imported) {
        thread.addLabel(processedLabel);
        thread.moveToArchive();
      }
      if (failed) thread.addLabel(errorLabel);
    } catch (error) {
      if (handleWebshopGmailQuotaError_(props, error)) {
        quotaFailed = true;
        return;
      }

      throw error;
    }
  });

  if (!quotaFailed) {
    verplaatsWebshopIngelezenThreads_(props, false);
  }
}

function getOrCreateWebshopLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function verplaatsWebshopIngelezenThreads_(props, force) {
  props = props || PropertiesService.getScriptProperties();
  if (!force && !shouldRunWebshopCleanup_(props)) return;

  let threads = [];
  try {
    threads = GmailApp.search(
      `newer_than:45d in:inbox label:"${WEBSHOP_IMAGE_CONFIG.SOURCE_LABEL}" label:"${WEBSHOP_IMAGE_CONFIG.PROCESSED_LABEL}"`,
      0,
      WEBSHOP_IMAGE_CONFIG.CLEANUP_MAX_THREADS
    );
  } catch (error) {
    if (handleWebshopGmailQuotaError_(props, error)) return;
    throw error;
  }

  try {
    threads.forEach((thread) => {
      thread.moveToArchive();
    });
  } catch (error) {
    if (handleWebshopGmailQuotaError_(props, error)) return;
    throw error;
  }

  props.setProperty('webshop-image:last-cleanup-at', new Date().toISOString());

  if (threads.length) {
    Logger.log(
      `Webshop afbeeldingen Gmail cleanup: ${threads.length} ingelezen thread(s) uit Inbox gehaald.`
    );
  }
}

function ruimWebshopIngelezenInboxOp() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('webshop-image:gmail-backoff-until');
  verplaatsWebshopIngelezenThreads_(props, true);
}

function claimWebshopImportRun_(props) {
  const key = 'webshop-image:last-run-started-at';
  const lastRunAt = Date.parse(props.getProperty(key) || '');
  const minIntervalMs = WEBSHOP_IMAGE_CONFIG.MIN_RUN_INTERVAL_MINUTES * 60 * 1000;

  if (Number.isFinite(lastRunAt) && Date.now() - lastRunAt < minIntervalMs) {
    Logger.log('Webshop afbeeldingen import overgeslagen: recente run.');
    return false;
  }

  props.setProperty(key, new Date().toISOString());
  return true;
}

function shouldRunWebshopCleanup_(props) {
  const lastCleanupAt = Date.parse(
    props.getProperty('webshop-image:last-cleanup-at') || ''
  );
  const intervalMs = WEBSHOP_IMAGE_CONFIG.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;

  return !Number.isFinite(lastCleanupAt) || Date.now() - lastCleanupAt >= intervalMs;
}

function isWebshopGmailBackoffActive_(props) {
  const key = 'webshop-image:gmail-backoff-until';
  const backoffUntil = Date.parse(props.getProperty(key) || '');

  if (!Number.isFinite(backoffUntil)) return false;
  if (Date.now() >= backoffUntil) {
    props.deleteProperty(key);
    return false;
  }

  Logger.log(
    `Webshop afbeeldingen import in Gmail-pauze tot ${new Date(backoffUntil).toISOString()}.`
  );
  return true;
}

function handleWebshopGmailQuotaError_(props, error) {
  const message = String(error && error.message ? error.message : error);
  if (
    message.indexOf('Service invoked too many times') < 0 ||
    message.toLowerCase().indexOf('gmail') < 0
  ) {
    return false;
  }

  const backoffUntil = new Date(
    Date.now() + WEBSHOP_IMAGE_CONFIG.GMAIL_QUOTA_BACKOFF_HOURS * 60 * 60 * 1000
  );
  props.setProperty('webshop-image:gmail-backoff-until', backoffUntil.toISOString());
  Logger.log(
    `Webshop afbeeldingen import gepauzeerd tot ${backoffUntil.toISOString()}: ${message}`
  );
  return true;
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
