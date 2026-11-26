// Add as a separate file in the existing Strik Logistiek import project.
// Reuses its existing private key; never put the key in this repository.
const PN_IMPORT_CONFIG = {
  URL: 'https://strik-app.vercel.app/api/persoonlijke-noot/mail-import',
  QUERY: 'newer_than:30d {from:bestellingen@persoonlijkenoot.nl from:inkoop@persoonlijkenoot.nl "bestellingen@persoonlijkenoot.nl" "inkoop@persoonlijkenoot.nl"}',
  SOURCE_LABEL: 'Persoonlijke Noot',
  DONE_LABEL: 'Persoonlijke Noot ingelezen',
  REVIEW_LABEL: 'Persoonlijke Noot controleren',
  TEST_LABEL: 'Persoonlijke Noot test',
  VERSION: 'pn-csv-v1',
};

function maakPersoonlijkeNootTriggerAan() {
  const name='importPersoonlijkeNootTijdvenster';
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===name);
  if(!existing.length)ScriptApp.newTrigger(name).timeBased().everyMinutes(30).create();
  Logger.log('Persoonlijke Noot: iedere 30 minuten controle tussen 07:00 en 22:00; bestaande triggers behouden.');
}
function importPersoonlijkeNootTijdvenster() {
  const hour=Number(Utilities.formatDate(new Date(),'Europe/Amsterdam','H'));
  if(hour>=7&&hour<22)importPersoonlijkeNoot();
}
function pnLabel_(name) {return GmailApp.getUserLabelByName(name)||GmailApp.createLabel(name);}
function pnTrusted_(message) {
  const from=message.getFrom().toLowerCase();
  if(/<(bestellingen|inkoop)@persoonlijkenoot\.nl>/.test(from)||/^(bestellingen|inkoop)@persoonlijkenoot\.nl$/.test(from))return true;
  return /(?:<|^)[^<>\s]+@strik-patisserie\.nl>?$/.test(from)&&/(?:bestellingen|inkoop)@persoonlijkenoot\.nl/i.test(message.getPlainBody());
}
function pnOrderDate_(message) {
  const date=message.getSubject().match(/Nieuwe bestelling\s+(\d{2})-(\d{2})-(\d{4})/i);
  return date?`${date[3]}-${date[2]}-${date[1]}`:Utilities.formatDate(message.getDate(),'Europe/Amsterdam','yyyy-MM-dd');
}
function pnCsvText_(file) {
  if(file.getBytes().length>2000000)throw new Error('CSV groter dan 2 MB; handmatig controleren.');
  const utf=file.getDataAsString('UTF-8');
  return utf.indexOf('\uFFFD')>=0?file.getDataAsString('Windows-1252'):utf;
}
function pnPost_(body) {
  const key=WEBSHOP_IMAGE_CONFIG.IMPORT_KEY;
  if(!key||key==='zet-hier-dezelfde-logistiek-sleutel')throw new Error('De bestaande logistiek-sleutel ontbreekt.');
  const response=UrlFetchApp.fetch(PN_IMPORT_CONFIG.URL,{method:'post',contentType:'application/json',headers:{'x-strik-logistics-key':key},payload:JSON.stringify(body),muteHttpExceptions:true});
  let result;try{result=JSON.parse(response.getContentText());}catch{throw new Error('De importserver gaf geen geldig antwoord.');}
  if(response.getResponseCode()!==200||!result.ok)throw new Error(result.message||`Importserver ${response.getResponseCode()}`);
  return result;
}
function importPersoonlijkeNoot() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    const props=PropertiesService.getScriptProperties(),offset=Number(props.getProperty('PN_SCAN_OFFSET')||0);
    const threads=GmailApp.search(PN_IMPORT_CONFIG.QUERY,offset,30);
    let waitingLinks=0,handled=0;
    for(const thread of threads) {
      let imported=false,review=false,sample=false;
      for(const message of thread.getMessages()) {
        if(!pnTrusted_(message))continue;
        const key=PN_IMPORT_CONFIG.VERSION+':'+message.getId(),saved=props.getProperty(key);
        if(saved==='done'||saved==='test')continue;
        if(saved==='review'){review=true;continue;}
        let retry={attempts:0,next:0};if(saved){try{retry=JSON.parse(saved);}catch{/* retry legacy state */}}
        if(retry.next>Date.now()){review=true;continue;}
        const files=message.getAttachments({includeInlineImages:false,includeAttachments:true}).filter(f=>/\.csv$/i.test(f.getName()));
        if(!files.length) {
          if(/mijnpersoonlijkenoot\.nl\/supplier-order|Download CSV/i.test(message.getPlainBody())) {
            review=true;waitingLinks++;props.setProperty(key,'review');
            Logger.log('Persoonlijke Noot: downloadlink wacht op aansluiting; mail blijft in inbox.');
          }
          continue;
        }
        try {
          if(files.length>10)throw new Error('Meer dan 10 CSV-bijlagen; handmatig controleren.');
          for(const file of files) {
            const result=pnPost_({csv:pnCsvText_(file),sourceName:file.getName(),orderDate:pnOrderDate_(message)});
            if(!result.complete)throw new Error('Bestaande bestelling wijkt af: controleer de mail en de afhaallijst.');
            sample ||=result.sample===true;
            Logger.log(`Persoonlijke Noot: ${result.sample?'voorbeeld gecontroleerd, niets opgeslagen':result.added+' nieuw, '+result.unchanged+' al aanwezig'}.`);
          }
          props.setProperty(key,sample?'test':'done');imported=true;handled++;
        }catch(error) {
          const attempts=retry.attempts+1;review=true;
          props.setProperty(key,attempts>=3?'review':JSON.stringify({attempts,next:Date.now()+2*3600000}));
          Logger.log('Persoonlijke Noot import niet afgerond: '+String(error.message||error).slice(0,400));
        }
      }
      if(review){thread.addLabel(pnLabel_(PN_IMPORT_CONFIG.SOURCE_LABEL));thread.addLabel(pnLabel_(PN_IMPORT_CONFIG.REVIEW_LABEL));thread.moveToInbox();}
      else if(imported){thread.addLabel(pnLabel_(PN_IMPORT_CONFIG.SOURCE_LABEL));thread.removeLabel(pnLabel_(PN_IMPORT_CONFIG.REVIEW_LABEL));thread.addLabel(pnLabel_(sample?PN_IMPORT_CONFIG.TEST_LABEL:PN_IMPORT_CONFIG.DONE_LABEL));if(!sample)thread.moveToArchive();}
    }
    props.setProperty('PN_SCAN_OFFSET',String(threads.length===30?offset+30:0));
    pnPost_({action:'check',waitingLinks});
    Logger.log('Persoonlijke Noot: mailboxcontrole voltooid, '+handled+' mails verwerkt.');
  }finally{lock.releaseLock();}
}

// Tests the actual supplier attachment without creating orders or changing mail.
function controleerPersoonlijkeNootVoorbeeld() {
  const threads=GmailApp.search('filename:csv "Supplier order voorbeeld cadeaukaart Strik"',0,10);
  for(const thread of threads)for(const message of thread.getMessages()) {
    if(!pnTrusted_(message))continue;
    for(const file of message.getAttachments({includeInlineImages:false,includeAttachments:true})) {
      if(!/voorbeeld.*\.csv$/i.test(file.getName()))continue;
      const result=pnPost_({csv:pnCsvText_(file),sourceName:file.getName(),orderDate:pnOrderDate_(message),dryRun:true});
      if(!result.complete||!result.sample||!result.preview.length)throw new Error('Het voorbeeld werd niet volledig herkend.');
      Logger.log('Persoonlijke Noot CSV-test geslaagd: '+result.preview.length+' voorbeeldregel(s), '+result.preview[0].product+', '+result.preview[0].store+'. Geen echte bestelling opgeslagen.');
      return;
    }
  }
  throw new Error('De voorbeeldmail met CSV is niet gevonden.');
}
