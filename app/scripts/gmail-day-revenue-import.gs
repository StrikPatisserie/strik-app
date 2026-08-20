const DAGOMZET_IMPORT_CONFIG = {
  IMPORT_URL: 'https://strik-app.vercel.app/api/management-revenue/day-import',
  IMPORT_KEY: 'zet-hier-dezelfde-logistiek-sleutel',

  SOURCE_LABEL: 'Dagomzet',
  PROCESSED_LABEL: 'Ingelezen',
  ERROR_LABEL: 'Fout',

  QUERY: 'label:"Dagomzet" newer_than:7d -label:"Ingelezen" -label:"Fout"',
  SEARCH_QUERIES: [
    'label:"Dagomzet" newer_than:7d -label:"Ingelezen" -label:"Fout"',
    'newer_than:7d -label:"Ingelezen" -label:"Fout" subject:"Cash-it Filiaal Dag Rapport"',
    'newer_than:7d -label:"Ingelezen" -label:"Fout" subject:"Dag Rapport ijs"',
    'newer_than:7d -label:"Ingelezen" -label:"Fout" subject:"Dagafsluiting email-Filiaal" subject:ijs',
  ],
  RECOVERY_QUERY: 'label:"Dagomzet" newer_than:45d',
  RECOVERY_SEARCH_QUERIES: [
    'label:"Dagomzet" newer_than:45d',
    'newer_than:45d subject:"Cash-it Filiaal Dag Rapport"',
    'newer_than:45d subject:"Dag Rapport ijs"',
    'newer_than:45d subject:"Dagafsluiting email-Filiaal" subject:ijs',
  ],
  MAX_THREADS: 10,
  RECOVERY_MAX_THREADS: 80,
  CLEANUP_MAX_THREADS: 100,
  MAX_PDF_ATTACHMENTS: 5,
  MAX_PDF_ATTACHMENT_BYTES: 6000000,
  IMPORT_VERSION: 'dagomzet-v1',
  SCRIPT_VERSION: 'gmail-archive-v10',
};

function importDagomzet() {
  importDagomzetThreads_(
    searchDagomzetThreads_(DAGOMZET_IMPORT_CONFIG.MAX_THREADS)
  );
}

function importDagomzetHerstel() {
  importDagomzetThreads_(
    searchDagomzetRecoveryThreads_(DAGOMZET_IMPORT_CONFIG.RECOVERY_MAX_THREADS)
  );
}

function importDagomzetThreads_(threads) {
  const sourceLabel = getOrCreateDagomzetLabel_(
    DAGOMZET_IMPORT_CONFIG.SOURCE_LABEL
  );
  const processedLabel = getOrCreateDagomzetLabel_(
    DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL
  );
  const errorLabel = getOrCreateDagomzetLabel_(DAGOMZET_IMPORT_CONFIG.ERROR_LABEL);
  const props = PropertiesService.getScriptProperties();

  console.log(
    `Dagomzet import ${DAGOMZET_IMPORT_CONFIG.SCRIPT_VERSION}: ${threads.length} thread(s) gevonden.`
  );
  Logger.log(
    `Dagomzet import ${DAGOMZET_IMPORT_CONFIG.SCRIPT_VERSION}: ${threads.length} thread(s) gevonden.`
  );

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

        logDagomzetImportResult_(response.getContentText());
        props.setProperty(importId, new Date().toISOString());
        imported = true;
      } catch (error) {
        console.error(error);
        failed = true;
      }
    });

    if (imported) {
      thread.addLabel(sourceLabel);
      thread.addLabel(processedLabel);
      thread.moveToArchive();
    }
    if (failed) {
      thread.addLabel(sourceLabel);
      thread.addLabel(errorLabel);
      thread.moveToArchive();
    }
  });

  verplaatsDagomzetIngelezenThreads_();
  verplaatsDagomzetFoutThreads_();
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

function herimporteerLaatsteDagomzet() {
  herimporteerLaatsteDagomzet_();
  importDagomzetHerstel();
}

function herimporteerEnImporteerLaatsteDagomzet() {
  herimporteerLaatsteDagomzet();
}

function herimporteerLaatsteDagomzet_() {
  const props = PropertiesService.getScriptProperties();
  const processedLabel = GmailApp.getUserLabelByName(
    DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL
  );
  const errorLabel = GmailApp.getUserLabelByName(
    DAGOMZET_IMPORT_CONFIG.ERROR_LABEL
  );
  const threads = searchDagomzetRecoveryThreads_(
    DAGOMZET_IMPORT_CONFIG.RECOVERY_MAX_THREADS
  );
  let resetCount = 0;

  threads.forEach((thread) => {
    let threadReset = false;

    thread.getMessages().forEach((message) => {
      const importId = `dagomzet:${DAGOMZET_IMPORT_CONFIG.IMPORT_VERSION}:${message.getId()}`;

      props.deleteProperty(importId);
      resetCount += 1;
      threadReset = true;
    });

    if (threadReset) {
      if (processedLabel) thread.removeLabel(processedLabel);
      if (errorLabel) thread.removeLabel(errorLabel);
    }
  });

  console.log(
    `Dagomzet herimport reset: ${resetCount} bericht(en) opnieuw klaar gezet. Herstelimport start automatisch via herimporteerLaatsteDagomzet().`
  );
  Logger.log(
    `Dagomzet herimport reset: ${resetCount} bericht(en) opnieuw klaar gezet. Herstelimport start automatisch via herimporteerLaatsteDagomzet().`
  );
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

function verplaatsDagomzetIngelezenThreads_() {
  const sourceLabel = getOrCreateDagomzetLabel_(
    DAGOMZET_IMPORT_CONFIG.SOURCE_LABEL
  );
  const processedLabel = GmailApp.getUserLabelByName(
    DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL
  );
  if (!processedLabel) return;

  const queries = [
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.SOURCE_LABEL}" label:"${DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL}"`,
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL}" subject:"Dag Rapport ijs"`,
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL}" subject:"Dagafsluiting email-Filiaal" subject:ijs`,
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.PROCESSED_LABEL}" subject:"Cash-it Filiaal Dag Rapport"`,
  ];
  const threadByKey = {};
  const threads = [];

  queries.forEach((query) => {
    GmailApp.search(
      query,
      0,
      DAGOMZET_IMPORT_CONFIG.CLEANUP_MAX_THREADS
    ).forEach((thread) => {
      const key = getDagomzetThreadKey_(thread);
      if (threadByKey[key]) return;

      threadByKey[key] = true;
      threads.push(thread);
    });
  });

  threads.forEach((thread) => {
    thread.addLabel(sourceLabel);
    thread.moveToArchive();
  });

  if (threads.length) {
    Logger.log(
      `Dagomzet Gmail cleanup: ${threads.length} ingelezen thread(s) uit Inbox gehaald.`
    );
  }
}

function verplaatsDagomzetFoutThreads_() {
  const sourceLabel = getOrCreateDagomzetLabel_(
    DAGOMZET_IMPORT_CONFIG.SOURCE_LABEL
  );
  const errorLabel = GmailApp.getUserLabelByName(
    DAGOMZET_IMPORT_CONFIG.ERROR_LABEL
  );
  if (!errorLabel) return;

  const queries = [
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.ERROR_LABEL}" label:"${DAGOMZET_IMPORT_CONFIG.SOURCE_LABEL}"`,
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.ERROR_LABEL}" subject:"Dag Rapport ijs"`,
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.ERROR_LABEL}" subject:"Dagafsluiting email-Filiaal" subject:ijs`,
    `newer_than:45d in:inbox label:"${DAGOMZET_IMPORT_CONFIG.ERROR_LABEL}" subject:"Cash-it Filiaal Dag Rapport"`,
  ];
  const threadByKey = {};
  const threads = [];

  queries.forEach((query) => {
    GmailApp.search(
      query,
      0,
      DAGOMZET_IMPORT_CONFIG.CLEANUP_MAX_THREADS
    ).forEach((thread) => {
      const key = getDagomzetThreadKey_(thread);
      if (threadByKey[key]) return;

      threadByKey[key] = true;
      threads.push(thread);
    });
  });

  threads.forEach((thread) => {
    thread.addLabel(sourceLabel);
    thread.addLabel(errorLabel);
    thread.moveToArchive();
  });

  if (threads.length) {
    Logger.log(
      `Dagomzet Gmail cleanup: ${threads.length} fout gelabelde thread(s) uit Inbox gehaald.`
    );
  }
}

function getOrCreateDagomzetLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function logDagomzetImportResult_(responseText) {
  try {
    const data = JSON.parse(responseText || '{}');
    const records = data.records || [];
    const cashRecords = data.cashRecords || [];
    const receiptTotal =
      typeof data.receiptTotal === 'number'
        ? data.receiptTotal
        : cashRecords.reduce((total, record) => {
            return (
              total +
              (Number(record.receipts) || 0) +
              (Number(record.iceReceipts) || 0)
            );
          }, 0);
    const receiptDetails = Array.isArray(data.receiptDetails)
      ? data.receiptDetails
          .map((detail) => {
            const shop = String(detail.shop || '').trim();
            const amount = Number(detail.amount) || 0;

            return shop && amount
              ? `${shop} ${formatDagomzetEuro_(amount)}`
              : '';
          })
          .filter(Boolean)
      : [];
    const cashTemplateDetails = Array.isArray(data.cashTemplateDetails)
      ? data.cashTemplateDetails
          .map((detail) => {
            const shop = String(detail.shop || '').trim();
            if (!shop) return '';

            return [
              shop,
              `omzet ${formatDagomzetEuro_(detail.dailyRevenue)}`,
              `kas ${formatDagomzetEuro_(detail.cashRevenue)}`,
              `bonnen ${formatDagomzetEuro_(detail.receipts)}`,
              `geteld ${formatDagomzetEuro_(detail.countedCash)}`,
            ].join(' ');
          })
          .filter(Boolean)
      : [];
    const warnings = Array.isArray(data.warnings)
      ? data.warnings.map((warning) => String(warning || '').trim()).filter(Boolean)
      : [];
    const summary = [
      `parser: ${data.parserVersion || 'onbekend'}`,
      `datum: ${data.date || '?'}`,
      `omzetregels: ${records.length}`,
      `kasregels: ${cashRecords.length}`,
      cashRecords.length
        ? `bonnen: ${formatDagomzetEuro_(receiptTotal)}`
        : 'bonnen: geen kasblok',
      receiptDetails.length ? `bonnenregels: ${receiptDetails.join(', ')}` : '',
      cashTemplateDetails.length
        ? `template: ${cashTemplateDetails.join(' / ')}`
        : '',
      warnings.length ? `waarschuwing: ${warnings.join(' / ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    console.log(`Dagomzet import OK: ${summary}`);
    Logger.log(`Dagomzet import OK: ${summary}`);
  } catch (error) {
    console.log(
      `Dagomzet import OK: ${String(responseText || '').slice(0, 500)}`
    );
    Logger.log(
      `Dagomzet import OK: ${String(responseText || '').slice(0, 500)}`
    );
  }
}

function formatDagomzetEuro_(value) {
  const amount = Number(value) || 0;

  return `€ ${amount.toFixed(2).replace('.', ',')}`;
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
