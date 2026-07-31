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
        const attachments = extractBakeItPdfAttachments_(message);
        if (!attachments.length) {
          console.log(
            `Geen PDF-bijlagen gevonden, bericht overgeslagen: ${message.getSubject()}`
          );
          return;
        }

        attachments.forEach((attachment) => {
          sendBakeItPdfAttachment_(message, attachment);
        });

        props.setProperty(importId, new Date().toISOString());
        console.log(
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
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      attachmentBase64: attachment.attachmentBase64,
      attachments: [attachment],
      sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${message.getId()}`,
    }),
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(response.getContentText());
  }
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
