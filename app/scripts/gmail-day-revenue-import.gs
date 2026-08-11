const DAGOMZET_IMPORT_CONFIG = {
  IMPORT_URL: 'https://strik-app.vercel.app/api/management-revenue/day-import',
  IMPORT_KEY: 'zet-hier-dezelfde-logistiek-sleutel',

  SOURCE_LABEL: 'Dagomzet',
  PROCESSED_LABEL: 'Ingelezen',
  ERROR_LABEL: 'Fout',

  QUERY: 'label:"Dagomzet" newer_than:7d -label:"Ingelezen" -label:"Fout"',
  SEARCH_QUERIES: [
    'label:"Dagomzet" newer_than:7d -label:"Ingelezen" -label:"Fout"',
    'newer_than:7d -label:"Ingelezen" -label:"Fout" subject:"Dag Rapport ijs"',
    'newer_than:7d -label:"Ingelezen" -label:"Fout" subject:"Dagafsluiting email-Filiaal" subject:ijs',
  ],
  RECOVERY_QUERY: 'label:"Dagomzet" newer_than:30d',
  RECOVERY_SEARCH_QUERIES: [
    'label:"Dagomzet" newer_than:30d',
    'newer_than:30d subject:"Dag Rapport ijs"',
    'newer_than:30d subject:"Dagafsluiting email-Filiaal" subject:ijs',
  ],
  MAX_THREADS: 10,
  RECOVERY_MAX_THREADS: 30,
  MAX_PDF_ATTACHMENTS: 5,
  MAX_PDF_ATTACHMENT_BYTES: 6000000,
  IMPORT_VERSION: 'dagomzet-v1',
};

function importDagomzet() {
  const processedLabel = getOrCreateDagomzetLabel_(
    DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL
  );
  const errorLabel = getOrCreateDagomzetLabel_(DAGOMZET_IMPORT_CONFIG.ERROR_LABEL);
  const props = PropertiesService.getScriptProperties();
  const threads = searchDagomzetThreads_(DAGOMZET_IMPORT_CONFIG.MAX_THREADS);

  threads.forEach((thread) => {
    let imported = false;
    let failed = false;

    thread.getMessages().forEach((message) => {
      const importId = `dagomzet:${DAGOMZET_IMPORT_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      if (props.getProperty(importId)) return;

      try {
        const bodyHtml = message.getBody();
        const bodyText = message.getPlainBody();
        const attachments = extractDagomzetPdfAttachments_(message);

        const response = UrlFetchApp.fetch(DAGOMZET_IMPORT_CONFIG.IMPORT_URL, {
          method: 'post',
          contentType: 'application/json',
          muteHttpExceptions: true,
          headers: {
            'x-strik-logistics-key': DAGOMZET_IMPORT_CONFIG.IMPORT_KEY,
          },
          payload: JSON.stringify({
            key: DAGOMZET_IMPORT_CONFIG.IMPORT_KEY,
            messageId: message.getId(),
            subject: message.getSubject(),
            from: message.getFrom(),
            receivedAt: message.getDate().toISOString(),
            bodyText,
            bodyHtml,
            attachments,
            labels: thread.getLabels().map((label) => label.getName()),
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

function debugDagomzetLaatsteMails() {
  const props = PropertiesService.getScriptProperties();
  const threads = searchDagomzetRecoveryThreads_(
    DAGOMZET_IMPORT_CONFIG.RECOVERY_MAX_THREADS
  );

  console.log(`Dagomzet gevonden threads: ${threads.length}`);
  Logger.log(`Dagomzet gevonden threads: ${threads.length}`);

  threads.forEach((thread, threadIndex) => {
    const labels = thread
      .getLabels()
      .map((label) => label.getName())
      .join(', ');

    thread.getMessages().forEach((message) => {
      const importId = `dagomzet:${DAGOMZET_IMPORT_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      const attachments = message.getAttachments({
        includeInlineImages: false,
        includeAttachments: true,
      });
      const pdfNames = attachments
        .map((attachment) => attachment.getName() || 'naamloos')
        .filter((fileName) => /\.pdf$/i.test(String(fileName)));

      const line = [
        `thread ${threadIndex + 1}`,
        message.getDate().toISOString(),
        props.getProperty(importId) ? 'al verwerkt' : 'nog niet verwerkt',
        `pdfs: ${pdfNames.length ? pdfNames.join(', ') : 'geen'}`,
        `labels: ${labels || 'geen'}`,
        `subject: ${message.getSubject()}`,
      ].join(' | ');

      console.log(line);
      Logger.log(line);
    });
  });
}

function searchDagomzetThreads_(maxThreads, queriesOverride) {
  const queries =
    queriesOverride ||
    DAGOMZET_IMPORT_CONFIG.SEARCH_QUERIES ||
    [DAGOMZET_IMPORT_CONFIG.QUERY];
  const threadByKey = {};
  const threads = [];

  queries.forEach((query) => {
    try {
      GmailApp.search(query, 0, maxThreads).forEach((thread) => {
        const key = getDagomzetThreadKey_(thread);
        if (threadByKey[key]) return;

        threadByKey[key] = true;
        threads.push(thread);
      });
    } catch (error) {
      console.error(error);
      Logger.log(`Dagomzet zoekquery mislukt: ${query}`);
    }
  });

  return threads.slice(0, maxThreads);
}

function searchDagomzetRecoveryThreads_(maxThreads) {
  return searchDagomzetThreads_(
    maxThreads,
    DAGOMZET_IMPORT_CONFIG.RECOVERY_SEARCH_QUERIES ||
      [DAGOMZET_IMPORT_CONFIG.RECOVERY_QUERY]
  );
}

function getDagomzetThreadKey_(thread) {
  try {
    return thread.getId();
  } catch (error) {
    const messages = thread.getMessages();
    return messages.length ? messages[0].getId() : Utilities.getUuid();
  }
}

function getOrCreateDagomzetLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function extractDagomzetPdfAttachments_(message) {
  const attachments = message.getAttachments({
    includeInlineImages: false,
    includeAttachments: true,
  });
  const pdfs = [];

  attachments.forEach((attachment) => {
    if (pdfs.length >= DAGOMZET_IMPORT_CONFIG.MAX_PDF_ATTACHMENTS) return;

    const fileName = attachment.getName() || 'dagomzet.pdf';
    const contentType = String(attachment.getContentType() || '').toLowerCase();
    const isPdf =
      contentType.indexOf('pdf') >= 0 || /\.pdf$/i.test(String(fileName));
    if (!isPdf) return;

    const bytes = attachment.getBytes();
    if (
      bytes.length <= 0 ||
      bytes.length > DAGOMZET_IMPORT_CONFIG.MAX_PDF_ATTACHMENT_BYTES
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
