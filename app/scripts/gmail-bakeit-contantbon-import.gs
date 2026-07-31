const BAKEIT_CONTANTBON_CONFIG = {
  IMPORT_URL: 'https://strik-app.vercel.app/api/bakkerij-logistiek/import',
  IMPORT_KEY: 'zet-hier-dezelfde-logistiek-sleutel',

  SOURCE_LABEL: 'Contantbonnen',
  PROCESSED_LABEL: 'Ingelezen',
  ERROR_LABEL: 'Fout',

  QUERY: 'subject:"contantbon Bake-it email" newer_than:30d',
  MAX_THREADS: 30,
  MAX_PDF_ATTACHMENTS: 4,
  MAX_PDF_ATTACHMENT_BYTES: 8000000,
  IMPORT_WAVE_BUCKET_MS: 5 * 60 * 1000,
  MIN_MESSAGE_AGE_MS: 60 * 1000,
  IMPORT_VERSION: 'split-mails-v1',
};

function importBakeItContantbonnen() {
  const processedLabel = getOrCreateBakeItLabel_(
    BAKEIT_CONTANTBON_CONFIG.PROCESSED_LABEL
  );
  const errorLabel = getOrCreateBakeItLabel_(BAKEIT_CONTANTBON_CONFIG.ERROR_LABEL);
  const props = PropertiesService.getScriptProperties();
  const threads = GmailApp.search(
    BAKEIT_CONTANTBON_CONFIG.QUERY,
    0,
    BAKEIT_CONTANTBON_CONFIG.MAX_THREADS
  );

  threads.forEach((thread) => {
    let hasImported = false;
    let successThisRun = false;
    let failed = false;

    thread.getMessages().forEach((message) => {
      const importId = `bakeit-contantbon:${BAKEIT_CONTANTBON_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      if (props.getProperty(importId)) {
        hasImported = true;
        return;
      }

      try {
        const messageAgeMs = Date.now() - message.getDate().getTime();
        if (messageAgeMs < BAKEIT_CONTANTBON_CONFIG.MIN_MESSAGE_AGE_MS) {
          logBakeIt_(
            `Bericht is net binnen, wacht op eventuele deelmail: ${message.getSubject()}`
          );
          return;
        }

        const attachments = extractBakeItPdfAttachments_(message);
        if (!attachments.length) {
          logBakeIt_(
            `Geen PDF-bijlagen gevonden, bericht overgeslagen: ${message.getSubject()}`
          );
          return;
        }

        attachments.forEach((attachment) => {
          sendBakeItPdfAttachment_(message, attachment);
        });

        props.setProperty(importId, new Date().toISOString());
        logBakeIt_(
          `Bake-it contantbonnen ingelezen: ${attachments.length} PDF(s) uit ${message.getSubject()}`
        );
        hasImported = true;
        successThisRun = true;
      } catch (error) {
        console.error(error);
        failed = true;
      }
    });

    if (successThisRun) {
      thread.addLabel(processedLabel);
      thread.removeLabel(errorLabel);
    } else if (hasImported) {
      thread.removeLabel(errorLabel);
    } else if (failed) {
      thread.addLabel(errorLabel);
    }
  });

  herstelBakeItFoutLabels();
}

function herstelBakeItFoutLabels() {
  const errorLabel = GmailApp.getUserLabelByName(
    BAKEIT_CONTANTBON_CONFIG.ERROR_LABEL
  );
  if (!errorLabel) return;

  const threads = GmailApp.search(
    `label:"${BAKEIT_CONTANTBON_CONFIG.ERROR_LABEL}" label:"${BAKEIT_CONTANTBON_CONFIG.PROCESSED_LABEL}" ${BAKEIT_CONTANTBON_CONFIG.QUERY}`,
    0,
    100
  );

  threads.forEach((thread) => {
    thread.removeLabel(errorLabel);
  });
}

function getOrCreateBakeItLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function sendBakeItPdfAttachment_(message, attachment) {
  const response = UrlFetchApp.fetch(BAKEIT_CONTANTBON_CONFIG.IMPORT_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-strik-logistics-key': BAKEIT_CONTANTBON_CONFIG.IMPORT_KEY,
    },
    payload: JSON.stringify({
      key: BAKEIT_CONTANTBON_CONFIG.IMPORT_KEY,
      messageId: message.getId(),
      subject: message.getSubject(),
      from: message.getFrom(),
      receivedAt: message.getDate().toISOString(),
      source: 'gmail',
      status: inferBakeItStatus_(message),
      importWaveId: buildBakeItImportWaveId_(message),
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      attachmentBase64: attachment.attachmentBase64,
      attachments: [attachment],
      sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${message.getId()}`,
    }),
  });

  const status = response.getResponseCode();
  const responseText = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(responseText);
  }

  logBakeItImportResult_(attachment.fileName, responseText);
}

function inferBakeItStatus_(message) {
  const labelText = message
    .getThread()
    .getLabels()
    .map((label) => label.getName())
    .join(' ');
  const haystack = `${message.getSubject()} ${labelText}`.toLowerCase();

  if (haystack.indexOf('definitief') >= 0) return 'definitief';
  if (haystack.indexOf('prognose') >= 0) return 'prognose';

  return '';
}

function buildBakeItImportWaveId_(message) {
  const bucket = Math.round(
    message.getDate().getTime() / BAKEIT_CONTANTBON_CONFIG.IMPORT_WAVE_BUCKET_MS
  );
  const subject = normalizeBakeItSubjectForWave_(message.getSubject());
  const status = inferBakeItStatus_(message) || 'auto';

  return `bakeit:${status}:${subject}:${bucket}`;
}

function normalizeBakeItSubjectForWave_(subject) {
  return String(subject || '')
    .toLowerCase()
    .replace(/\bemail\s+2\b/g, 'email')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBakeItPdfAttachments_(message) {
  const attachments = message.getAttachments({
    includeInlineImages: false,
    includeAttachments: true,
  });
  const pdfs = [];

  attachments.forEach((attachment) => {
    if (pdfs.length >= BAKEIT_CONTANTBON_CONFIG.MAX_PDF_ATTACHMENTS) return;

    const fileName = attachment.getName() || 'contantbon.pdf';
    const contentType = String(attachment.getContentType() || '').toLowerCase();
    const bytes = attachment.getBytes();
    const isPdf =
      contentType.indexOf('pdf') >= 0 ||
      /\.pdf$/i.test(String(fileName)) ||
      looksLikePdfBytes_(bytes);
    if (!isPdf) return;

    if (
      bytes.length <= 0 ||
      bytes.length > BAKEIT_CONTANTBON_CONFIG.MAX_PDF_ATTACHMENT_BYTES
    ) {
      return;
    }

    pdfs.push({
      fileName,
      contentType: contentType || 'application/pdf',
      size: bytes.length,
      attachmentBase64: Utilities.base64Encode(bytes),
    });
  });

  return pdfs;
}

function looksLikePdfBytes_(bytes) {
  if (!bytes || bytes.length < 4) return false;

  return (
    bytes[0] === 37 &&
    bytes[1] === 80 &&
    bytes[2] === 68 &&
    bytes[3] === 70
  );
}

function logBakeItImportResult_(fileName, responseText) {
  try {
    const data = JSON.parse(responseText || '{}');
    const batches = data.batches || (data.batch ? [data.batch] : []);
    const summary = batches
      .map((batch) => {
        return [
          batch.date || '?',
          batch.status || '?',
          `${batch.orderCount || 0} bonnen`,
          batch.fileName || fileName,
        ].join(' · ');
      })
      .join(' | ');

    logBakeIt_(`Import OK ${fileName}: ${summary || 'geen batchinfo'}`);
  } catch (error) {
    logBakeIt_(
      `Import OK ${fileName}: ${String(responseText || '').slice(0, 500)}`
    );
  }
}

function debugBakeItBatchMorgen() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = Utilities.formatDate(tomorrow, 'Europe/Amsterdam', 'yyyy-MM-dd');

  debugBakeItBatchDatum_(date);
}

function debugBakeItBatchDatum_(date) {
  const response = UrlFetchApp.fetch(
    `https://strik-app.vercel.app/api/bakkerij-logistiek?date=${date}&debug=1`,
    {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        'x-strik-logistics-key': BAKEIT_CONTANTBON_CONFIG.IMPORT_KEY,
      },
    }
  );

  logBakeIt_(`Debug ${date}: status ${response.getResponseCode()}`);
  logBakeIt_(response.getContentText());
}

function logBakeIt_(message) {
  console.log(message);
  Logger.log(message);
}
