<?php
// The shared fixtures capture all mail locally. No real messages are sent.
require __DIR__ . '/business-quotes.php';
$wpdb->available = true; $options = array(); $fail_option_key = ''; reset_mails();
function final_fixture($id = 'final-order', $season = 'sint') {
    return array('id' => $id, 'year' => '2026', 'season' => $season, 'customerName' => 'Voorbeeld & Co', 'contactName' => 'Sanne <test>', 'customerEmail' => 'sanne@example.invalid', 'phone' => '0612345678', 'status' => 'aanvraag', 'department' => 'bakkerij', 'orderText' => "PRODUCTEN EN PRIJS\n25 × Kerststol · 800 gram · € 13,90 p.s. ex btw · € 347,50", 'deliveryDate' => '2026-12-18', 'deliveryDateEnd' => '2026-12-20', 'deliveryWindowType' => 'range', 'deliveryMethod' => 'Bezorgen volgens afspraak', 'deliveryAddress' => "Voorbeeldstraat 1\n6511 AA Nijmegen", 'totalExVat' => '347.50', 'priceAgreement' => 'Inclusief cadeauverpakking; bezorgen volgens afspraak.', 'packaging' => 'Feestelijke doos met kaartje', 'importantNotes' => 'ALLEEN INTERN: klant belt nog over facturatie', 'invoiceInfo' => 'ALLEEN FACTURATIE', 'productionDate' => '2026-12-17');
}
function b2b_save($params) { return strik_sinterklaas_b2b_save(new QuoteRequest($params)); }
function preview_final($id) { return b2b_save(array('id' => $id, 'previewCustomerConfirmation' => true)); }
function mail_final($order, $overrides = array()) { return b2b_save(array_merge(array('id' => $order['id'], 'sendCustomerConfirmation' => true, 'confirmationVersion' => $order['confirmationMail']['version']), $overrides)); }

$draft = b2b_save(final_fixture());
check(!is_wp_error($draft) && count($mail_calls) === 0, 'An inquiry does not send a final confirmation.');
$final = b2b_save(array('id' => $draft['id'], 'status' => 'akkoord'));
check(!is_wp_error($final) && count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'Finalizing automatically sends exactly one internal backup.');
check(has($mail_calls[0]['body'], 'INTERNE BACK-UP') && has($mail_calls[0]['body'], 'background:#244b37') && has($mail_calls[0]['body'], 'ALLEEN INTERN') && has($mail_calls[0]['body'], 'ALLEEN FACTURATIE'), 'Green backup includes internal order information.');
check(in_array('Content-Type: text/html; charset=UTF-8', $mail_calls[0]['headers']), 'Backup is HTML.');
$preview = preview_final($final['id']);
check(!is_wp_error($preview) && count($mail_calls) === 1, 'Opening the popup/preview never sends a customer mail.');
check(has($preview['html'], 'Uw bestelling is bevestigd!') && has($preview['html'], '€ 347,50') && has($preview['html'], '18-12-2026 t/m 20-12-2026'), 'Customer preview shows the agreed amount and complete delivery window.');
check(!has($preview['html'], 'ALLEEN INTERN') && !has($preview['html'], 'ALLEEN FACTURATIE') && !has($preview['html'], '2026-12-17') && !has($preview['html'], '<test>'), 'Customer mail excludes internal notes, invoicing, planning, and escapes names.');
check(is_wp_error(mail_final($final, array('confirmationVersion' => 'stale'))) && count($mail_calls) === 1, 'A stale or missing version cannot send.');
$sent = mail_final($final, array('customerEmail' => 'forged@example.invalid', 'orderText' => 'Forged content'));
check(!is_wp_error($sent) && count($mail_calls) === 2 && $mail_calls[1]['to'] === 'sanne@example.invalid' && !has($mail_calls[1]['body'], 'Forged content'), 'Explicit confirmation uses the saved recipient and order, never supplied replacements.');
check($mail_calls[1]['body'] === $preview['html'], 'The actual customer mail exactly matches its reviewed preview.');
check($sent['confirmationMail']['customer']['state'] === 'sent' && $sent['confirmationMail']['customer']['sentAt'] !== '', 'Customer send status is recorded separately.');
mail_final($sent); b2b_save(array('id' => $sent['id'], 'status' => 'akkoord')); b2b_save(array('id' => $sent['id'], 'packed' => true));
check(count($mail_calls) === 2, 'Duplicate clicks, ordinary saves and production flags do not send again.');
echo "PASS finalization, explicit customer choice, exact preview, current details and duplicate protection\n";

$private = b2b_save(array('id' => $sent['id'], 'importantNotes' => 'Nieuwe interne afspraak'));
check(count($mail_calls) === 3 && $private['confirmationMail']['version'] === $sent['confirmationMail']['version'], 'Internal notes update only the backup, not the customer version.');
mail_final($private);
check(count($mail_calls) === 3, 'An internal update cannot resend the customer mail.');
$changed = b2b_save(array('id' => $sent['id'], 'totalExVat' => '300.00', 'deliveryDateEnd' => '2026-12-21'));
check(count($mail_calls) === 4 && $changed['confirmationMail']['version'] !== $sent['confirmationMail']['version'], 'A changed amount/delivery creates a new version and an internal backup.');
check(is_wp_error(mail_final($sent)) && count($mail_calls) === 4, 'An open stale popup cannot send old details after another edit.');
$changed_preview = preview_final($sent['id']);
$changed_sent = mail_final($changed);
check(count($mail_calls) === 5 && has($mail_calls[4]['body'], '€ 300,00') && has($mail_calls[4]['body'], '21-12-2026') && $mail_calls[4]['body'] === $changed_preview['html'] && has($mail_calls[4]['body'], 'Uw bestelling is aangepast'), 'Changed confirmation is deliberate, current and matches its preview.');
$reverted = b2b_save(array('id' => $sent['id'], 'totalExVat' => '347.50', 'deliveryDateEnd' => '2026-12-20'));
check($reverted['confirmationMail']['version'] !== $sent['confirmationMail']['version'], 'Reverting to an earlier value is a new version, not an old already-sent receipt.');
$forged = b2b_save(array('id' => $sent['id'], 'confirmationMail' => array('version' => 'forged'), 'confirmationEmailedAt' => 'forged'));
check($forged['confirmationMail']['version'] === $reverted['confirmationMail']['version'] && $forged['confirmationEmailedAt'] !== 'forged', 'Clients cannot forge or erase server-owned mail history.');
echo "PASS revised orders, stale popups, private notes, reversions and protected history\n";

reset_mails();
$no_address = b2b_save(array_merge(final_fixture('no-email', 'kerst'), array('status' => 'akkoord', 'customerEmail' => '')));
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT && has($mail_calls[0]['body'], 'Kerst'), 'A Christmas backup is sent without a customer address.');
check(is_wp_error(mail_final($no_address)) && count($mail_calls) === 1, 'A customer address is required only for the customer send.');
$failure = b2b_save(array_merge(final_fixture('failed-customer'), array('status' => 'akkoord')));
reset_mails(array(false));
$failure = mail_final($failure);
check(count($mail_calls) === 1 && $failure['confirmationMail']['customer']['state'] === 'failed' && $failure['confirmationMail']['customer']['error'] !== '', 'Customer transport failure remains visible and retryable.');
reset_mails(); $failure = mail_final($failure);
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === 'sanne@example.invalid' && $failure['confirmationMail']['customer']['state'] === 'sent', 'Retry sends only the failed customer mail.');
reset_mails(array(false));
$backup_failure = b2b_save(array_merge(final_fixture('failed-backup'), array('status' => 'akkoord')));
check($backup_failure['confirmationEmailError'] !== '', 'A backup failure is reported separately.');
reset_mails(array(false, true)); $backup_failure = mail_final($backup_failure);
check(count($mail_calls) === 2 && $backup_failure['confirmationMail']['customer']['state'] === 'sent' && $backup_failure['confirmationEmailError'] !== '', 'Backup failure does not block the explicitly requested customer mail.');
reset_mails(); $backup_failure = b2b_save(array('id' => $backup_failure['id'], 'resendConfirmation' => true));
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT && $backup_failure['confirmationEmailError'] === '', 'Backup retry never resends a successful customer mail.');
echo "PASS missing email, independent customer/backup failures and targeted retries\n";

reset_mails();
$fail_option_key = STRIK_SINTERKLAAS_B2B_OPTION_NAME;
check(is_wp_error(b2b_save(array_merge(final_fixture('storage-fail'), array('status' => 'akkoord')))) && count($mail_calls) === 0, 'No mail before durable order storage.');
$fail_option_key = '';
$uncertain = b2b_save(array_merge(final_fixture('uncertain-send'), array('status' => 'akkoord')));
$receipt_key = 'strik_b2b_mail_' . hash('sha256', $uncertain['id'] . '|customer|' . $uncertain['confirmationMail']['version']);
$fail_option_key = $receipt_key;
reset_mails(); $blocked = mail_final($uncertain);
check(count($mail_calls) === 0 && $blocked['confirmationMail']['customer']['state'] === 'failed', 'A missing durable send receipt prevents outgoing mail.');
$fail_option_key = '';
$mail_after_send = function () use ($receipt_key) { global $fail_option_key; $fail_option_key = $receipt_key; };
$uncertain = mail_final($uncertain); $mail_after_send = null; $fail_option_key = '';
check(count($mail_calls) === 1 && $uncertain['confirmationMail']['customer']['state'] === 'sending', 'An uncertain post-send database result is not recorded as a successful send.');
mail_final($uncertain);
check(count($mail_calls) === 1, 'An uncertain transport outcome cannot automatically send twice.');
$wpdb->available = false;
check(is_wp_error(mail_final($sent)) && count($mail_calls) === 1, 'Concurrent or unavailable lock stops confirmation.');
$wpdb->available = true;
$cancelled = b2b_save(array('id' => $sent['id'], 'cancelled' => true));
check(is_wp_error(mail_final($cancelled)), 'Cancelled orders cannot be confirmed to the customer.');
echo "PASS durable sends, uncertain outcomes, concurrency and cancellation\n";

$legacy = strik_sinterklaas_sanitize_b2b_order(array_merge(final_fixture('folder-final'), array('status' => 'akkoord', 'department' => 'chocolade', 'letterLines' => array(array('id' => 's', 'letter' => 'M', 'chocolate' => 'puur', 'style' => 'spuit', 'size' => 'groot', 'quantity' => 30, 'exceptions' => array('vegan'))), 'totalExVat' => '250.00', 'priceAgreement' => 'Prijsindicatie: OUD BEDRAG', 'orderText' => "BEDRIJF EN CONTACT\nBedrijf: OUD CONTACT\nGEKOZEN SINTERKLAASPRODUCTEN\n3 × Chocolade spuitletters · spuitletter S groot · melk\n  € 12,80 p.s. excl. btw · OUD PRODUCTBEDRAG\n\nPRIJSINDICATIE\nOUD TOTAAL\n\nGEWENSTE LEVERING\nOUDE DATUM\n\nWENSEN\nOUD VERZOEK")), array('folderQuote' => array('reference' => 'SINT26-F12345671234')));
$legacy_html = strik_business_b2b_confirmation_html($legacy);
foreach (array('OUD CONTACT', 'OUD PRODUCTBEDRAG', 'OUD TOTAAL', 'OUDE DATUM', 'OUD BEDRAG', '3×', 'Spuitletter S') as $old) check(!has($legacy_html, $old), 'Final mail excludes stale inquiry value: ' . $old);
check(has($legacy_html, '30×') && has($legacy_html, 'Spuitletter M') && has($legacy_html, 'vegan') && has($legacy_html, '€ 250,00'), 'Edited letter rows and agreed total are authoritative.');
$legacy['sourceSheet'] = '__STRIK_LEVERPERIODE__range|2026-12-22|';
check(has(strik_business_b2b_confirmation_html($legacy), '18-12-2026 t/m 22-12-2026'), 'The existing delivery-window marker is rendered losslessly.');
$historic = b2b_save(array_merge(final_fixture('historical-import'), array('status' => 'akkoord', 'source' => 'excel')));
check(!is_wp_error($historic), 'Historical imports still save without customer mail.');
echo "PASS final folder conversions, edited letters and complete delivery windows\n";

if (getenv('STRIK_MAIL_PREVIEW_DIR')) {
    $dir = getenv('STRIK_MAIL_PREVIEW_DIR');
    $example = strik_sinterklaas_sanitize_b2b_order(array_merge(final_fixture('preview-kerst', 'kerst'), array('status' => 'akkoord', 'contactName' => 'Sanne', 'deliveryWindowType' => 'date', 'deliveryDateEnd' => '', 'totalExVat' => '347.50', 'orderText' => "25 × Kerststol · 800 gram\n€ 13,90 per stuk excl. btw", 'importantNotes' => 'Invoeren in Bake-it; productie afstemmen.', 'invoiceInfo' => 'Factuur na levering.')));
    $example = strik_business_b2b_prepare_confirmation($example);
    $example['confirmationEmailedAt'] = '2026-10-21T10:00:00+02:00';
    file_put_contents($dir . '/klant.html', strik_business_b2b_confirmation_html($example));
    file_put_contents($dir . '/backup.html', strik_business_b2b_confirmation_html($example, true));
    file_put_contents($dir . '/order.json', wp_json_encode($example));
}
echo "All B2B confirmation tests passed; no real emails sent.\n";
