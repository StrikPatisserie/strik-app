const BAKEIT_CONTANTBON_CONFIG = {
  IMPORT_URL: 'https://strik-app.vercel.app/api/bakkerij-logistiek/import',
  IMPORT_KEY: 'zet-hier-dezelfde-logistiek-sleutel',

  SOURCE_LABEL: 'Contantbonnen',
  BAKEIT_LABEL: 'Bake-it',
  PROCESSED_LABEL: 'Ingelezen',
  ERROR_LABEL: 'Fout',

  QUERY:
    'newer_than:30d {subject:"contantbon Bake-it" subject:"Orders email-Contantbonnen" subject:"Orders email-Contantbon A5" subject:"Orders email-Contantbon" subject:"Contantbonnen" subject:"Contantbon" label:"Contantbonnen"}',
  MAX_THREADS: 60,
  MAX_PDF_ATTACHMENTS: 4,
  MAX_PDF_ATTACHMENT_BYTES: 8000000,
  MIN_MESSAGE_AGE_MS: 60 * 1000,
  SPLIT_PART_WINDOW_MS: 4 * 60 * 60 * 1000,
  PROGNOSE_MAIL_START_HOUR: 8,
  PROGNOSE_MAIL_START_MINUTE: 20,
  DEFINITIVE_MAIL_START_HOUR: 20,
  DEFINITIVE_MAIL_START_MINUTE: 15,
  IMPORT_VERSION: 'split-mails-v1',
};

function importBakeItBonnen() {
  importBakeItContantbonnen();
}

function importBakeItContantbonnen() {
  const processedLabel = getOrCreateBakeItLabel_(
    BAKEIT_CONTANTBON_CONFIG.PROCESSED_LABEL
  );
  const bakeItLabel = getOrCreateBakeItLabel_(
    BAKEIT_CONTANTBON_CONFIG.BAKEIT_LABEL
  );
  const errorLabel = getOrCreateBakeItLabel_(BAKEIT_CONTANTBON_CONFIG.ERROR_LABEL);
  const props = PropertiesService.getScriptProperties();
  const threads = GmailApp.search(
    BAKEIT_CONTANTBON_CONFIG.QUERY,
    0,
    BAKEIT_CONTANTBON_CONFIG.MAX_THREADS
  );
  const importRunId = Utilities.getUuid();
  const waitingGroups = findBakeItWaitingGroups_(threads, props);
  const importWaveIds = buildBakeItImportWaveIds_(
    threads,
    props,
    waitingGroups,
    importRunId
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
        const groupKey = buildBakeItImportGroupKey_(message);
        if (waitingGroups[groupKey]) {
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
          sendBakeItPdfAttachment_(
            message,
            attachment,
            importWaveIds[groupKey] ||
              buildBakeItImportWaveId_(groupKey, importRunId)
          );
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
      thread.addLabel(bakeItLabel);
      thread.addLabel(processedLabel);
      thread.removeLabel(errorLabel);
    } else if (hasImported) {
      thread.addLabel(bakeItLabel);
      thread.addLabel(processedLabel);
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

function sendBakeItPdfAttachment_(message, attachment, importWaveId) {
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
      importWaveId,
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

  return inferBakeItMailTimeStatus_(message);
}

function inferBakeItMailTimeStatus_(message) {
  const hour = Number(
    Utilities.formatDate(message.getDate(), 'Europe/Amsterdam', 'H')
  );
  const minute = Number(
    Utilities.formatDate(message.getDate(), 'Europe/Amsterdam', 'm')
  );

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';

  const receivedMinuteOfDay = hour * 60 + minute;
  const definitiveStartMinuteOfDay =
    BAKEIT_CONTANTBON_CONFIG.DEFINITIVE_MAIL_START_HOUR * 60 +
    BAKEIT_CONTANTBON_CONFIG.DEFINITIVE_MAIL_START_MINUTE;
  const prognoseStartMinuteOfDay =
    BAKEIT_CONTANTBON_CONFIG.PROGNOSE_MAIL_START_HOUR * 60 +
    BAKEIT_CONTANTBON_CONFIG.PROGNOSE_MAIL_START_MINUTE;

  if (receivedMinuteOfDay >= definitiveStartMinuteOfDay) {
    return 'definitief';
  }
  if (receivedMinuteOfDay >= prognoseStartMinuteOfDay) {
    return 'prognose';
  }

  return '';
}

function findBakeItWaitingGroups_(threads, props) {
  const waitingGroups = {};

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      const importId = `bakeit-contantbon:${BAKEIT_CONTANTBON_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      if (props.getProperty(importId)) return;

      const messageAgeMs = Date.now() - message.getDate().getTime();
      if (messageAgeMs < BAKEIT_CONTANTBON_CONFIG.MIN_MESSAGE_AGE_MS) {
        waitingGroups[buildBakeItImportGroupKey_(message)] = true;
      }
    });
  });

  return waitingGroups;
}

function buildBakeItImportWaveIds_(
  threads,
  props,
  waitingGroups,
  importRunId
) {
  const groups = {};

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      const importId = `bakeit-contantbon:${BAKEIT_CONTANTBON_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      if (props.getProperty(importId)) return;

      const groupKey = buildBakeItImportGroupKey_(message);
      if (waitingGroups[groupKey]) return;

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(message);
    });
  });

  const waveIds = {};

  Object.keys(groups).forEach((groupKey) => {
    const messages = groups[groupKey].sort(
      (first, second) => first.getDate().getTime() - second.getDate().getTime()
    );
    const firstPart = messages.find(
      (message) => !isBakeItSecondPart_(message.getSubject())
    );
    const storedWave = readBakeItImportWaveState_(props, groupKey);
    let importWaveId = '';

    if (firstPart) {
      importWaveId = buildBakeItImportWaveId_(groupKey, importRunId);
      writeBakeItImportWaveState_(props, groupKey, {
        importWaveId,
        startedAt: firstPart.getDate().toISOString(),
      });
    } else if (
      storedWave &&
      isBakeItStoredWaveUsable_(storedWave, messages[0])
    ) {
      importWaveId = storedWave.importWaveId;
    } else {
      importWaveId = buildBakeItImportWaveId_(groupKey, importRunId);
      writeBakeItImportWaveState_(props, groupKey, {
        importWaveId,
        startedAt: messages[0].getDate().toISOString(),
      });
    }

    waveIds[groupKey] = importWaveId;
  });

  return waveIds;
}

function buildBakeItImportWaveId_(groupKey, importRunId) {
  return `${groupKey}:${importRunId}`;
}

function buildBakeItImportGroupKey_(message) {
  const subject = normalizeBakeItSubjectForWave_(message.getSubject());
  const status = inferBakeItStatus_(message) || 'auto';

  return `bakeit:${status}:${subject}`;
}

function normalizeBakeItSubjectForWave_(subject) {
  return String(subject || '')
    .toLowerCase()
    .replace(/\bemail[\s-]*\d+(?:\s*(?:van|of|\/)\s*\d+)?\b/g, 'email')
    .replace(/\b(?:deel|part)[\s-]*\d+(?:\s*(?:van|of|\/)\s*\d+)?\b/g, '')
    .replace(/\(\s*\d+\s*\/\s*\d+\s*\)/g, '')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBakeItSecondPart_(subject) {
  return getBakeItMailPartNumber_(subject) > 1;
}

function getBakeItMailPartNumber_(subject) {
  const text = String(subject || '');
  const namedPart = text.match(
    /\b(?:email|deel|part)[\s-]*(\d+)(?:\s*(?:van|of|\/)\s*\d+)?\b/i
  );
  if (namedPart) return Number(namedPart[1]) || 1;

  const fractionPart = text.match(/(?:^|[\s(])(\d+)\s*\/\s*\d+(?:[\s)]|$)/);
  if (fractionPart) return Number(fractionPart[1]) || 1;

  return 1;
}

function buildBakeItImportWaveStateKey_(groupKey) {
  return `bakeit-contantbon-wave:${groupKey}`;
}

function readBakeItImportWaveState_(props, groupKey) {
  try {
    const raw = props.getProperty(buildBakeItImportWaveStateKey_(groupKey));
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (
      data &&
      typeof data.importWaveId === 'string' &&
      typeof data.startedAt === 'string'
    ) {
      return data;
    }
  } catch (error) {
    console.error(error);
  }

  return null;
}

function writeBakeItImportWaveState_(props, groupKey, state) {
  props.setProperty(
    buildBakeItImportWaveStateKey_(groupKey),
    JSON.stringify(state)
  );
}

function isBakeItStoredWaveUsable_(storedWave, message) {
  const startedAt = new Date(storedWave.startedAt).getTime();
  const receivedAt = message.getDate().getTime();

  return (
    isFinite(startedAt) &&
    receivedAt >= startedAt &&
    receivedAt - startedAt <= BAKEIT_CONTANTBON_CONFIG.SPLIT_PART_WINDOW_MS
  );
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

function debugBakeItBatchVandaag() {
  const date = Utilities.formatDate(
    new Date(),
    'Europe/Amsterdam',
    'yyyy-MM-dd'
  );

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

function debugBakeItLaatsteMails() {
  const props = PropertiesService.getScriptProperties();
  const threads = GmailApp.search(BAKEIT_CONTANTBON_CONFIG.QUERY, 0, 30);

  logBakeIt_(`Gevonden threads: ${threads.length}`);

  threads.forEach((thread, threadIndex) => {
    const labels = thread
      .getLabels()
      .map((label) => label.getName())
      .join(', ');

    thread.getMessages().forEach((message) => {
      const importId = `bakeit-contantbon:${BAKEIT_CONTANTBON_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      const attachments = message.getAttachments({
        includeInlineImages: false,
        includeAttachments: true,
      });
      const pdfNames = attachments
        .map((attachment) => attachment.getName() || 'naamloos')
        .filter((fileName) => /\.pdf$/i.test(String(fileName)));

      logBakeIt_(
        [
          `thread ${threadIndex + 1}`,
          message.getDate().toISOString(),
          props.getProperty(importId) ? 'al verwerkt' : 'nog niet verwerkt',
          `deel: ${getBakeItMailPartNumber_(message.getSubject())}`,
          `status: ${inferBakeItStatus_(message) || 'automatisch'}`,
          `pdfs: ${pdfNames.length ? pdfNames.join(', ') : 'geen'}`,
          `labels: ${labels || 'geen'}`,
          `subject: ${message.getSubject()}`,
        ].join(' | ')
      );
    });
  });
}

function herimporteerLaatsteBakeItContantbonnen() {
  const props = PropertiesService.getScriptProperties();
  const processedLabel = GmailApp.getUserLabelByName(
    BAKEIT_CONTANTBON_CONFIG.PROCESSED_LABEL
  );
  const errorLabel = GmailApp.getUserLabelByName(
    BAKEIT_CONTANTBON_CONFIG.ERROR_LABEL
  );
  const threads = GmailApp.search(BAKEIT_CONTANTBON_CONFIG.QUERY, 0, 30);
  let resetCount = 0;

  threads.forEach((thread) => {
    let threadReset = false;

    thread.getMessages().forEach((message) => {
      if (!isBakeItOrdersEmailContantbonMail_(message)) return;

      const importId = `bakeit-contantbon:${BAKEIT_CONTANTBON_CONFIG.IMPORT_VERSION}:${message.getId()}`;
      const groupKey = buildBakeItImportGroupKey_(message);

      props.deleteProperty(importId);
      props.deleteProperty(buildBakeItImportWaveStateKey_(groupKey));
      resetCount += 1;
      threadReset = true;
    });

    if (threadReset) {
      if (processedLabel) thread.removeLabel(processedLabel);
      if (errorLabel) thread.removeLabel(errorLabel);
    }
  });

  logBakeIt_(
    `Bake-it Orders email herimport reset: ${resetCount} bericht(en) opnieuw klaar gezet. Draai nu importBakeItContantbonnen().`
  );
}

function isBakeItOrdersEmailContantbonMail_(message) {
  const subject = String(message.getSubject() || '');

  return /orders\s+email(?:[-\s]*\d+)?[-\s]+contantbon(?:nen)?(?:\s+a5)?/i.test(
    subject
  );
}

function maakBakeItImportTriggerAan() {
  const functionName = 'importBakeItContantbonnen';
  const legacyFunctionNames = ['importBakeItBonnen'];
  const existingTriggers = ScriptApp.getProjectTriggers().filter(
    (trigger) =>
      trigger.getHandlerFunction() === functionName ||
      legacyFunctionNames.indexOf(trigger.getHandlerFunction()) >= 0
  );

  existingTriggers.forEach((trigger) => {
    ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger(functionName).timeBased().everyMinutes(5).create();
  logBakeIt_('Bake-it importtrigger aangemaakt: elke 5 minuten.');
}

function logBakeIt_(message) {
  console.log(message);
  Logger.log(message);
}
