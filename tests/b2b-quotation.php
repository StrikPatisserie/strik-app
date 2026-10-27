<?php
// Reuse the durable-storage and mail-capture fixtures. No real mail or orders.
require __DIR__ . '/b2b-confirmation.php';
function preview_quote($id) { return b2b_save(array('id' => $id, 'previewCustomerQuotation' => true)); }
function send_quote($order, $extra = array()) { return b2b_save(array_merge(array('id' => $order['id'], 'sendCustomerQuotation' => true, 'quotationVersion' => $order['quotationMail']['version']), $extra)); }

foreach (array('aanvraag', 'offerte') as $stage) {
    reset_mails();
    $draft = b2b_save(array_merge(final_fixture('quote-' . $stage), array('status' => $stage)));
    $original = $draft;
    $preview = preview_quote($draft['id']);
    check(!is_wp_error($preview) && count($mail_calls) === 0, 'Saving and previewing never send an inquiry or quotation.');
    check($preview['order']['status'] === $stage && $preview['order']['productionDate'] === $draft['productionDate'], 'Preview leaves stage and production untouched.');
    check(has($preview['html'], 'background:#244b37') && has($preview['html'], '25 × Kerststol') && has($preview['html'], '347,50'), 'Customer gets saved products and price in the green design.');
    check(has($preview['html'], 'vr 18 dec') && has($preview['html'], 'zo 20 dec 2026'), 'Desired delivery uses actual Dutch weekdays.');
    check(has($preview['html'], 'Dit is nog geen definitieve bestelling.') && !has($preview['html'], 'Uw bestelling is bevestigd') && !has($preview['html'], 'BESTELBEVESTIGING'), 'Never describe a quotation as final.');
    check(!has($preview['html'], 'ALLEEN INTERN') && !has($preview['html'], 'ALLEEN FACTURATIE') && !has($preview['html'], '<test>'), 'No internal data or executable customer HTML.');
    check(has($preview['subject'], $stage === 'offerte' ? 'Offerte' : 'Overzicht van uw aanvraag'), 'Subject matches the saved stage.');
    $sent = send_quote($draft, array('customerEmail' => 'forged@example.invalid', 'status' => 'akkoord', 'orderText' => 'Forged products', 'quotationMail' => array('version' => 'forged')));
    check(!is_wp_error($sent) && count($mail_calls) === 1 && $mail_calls[0]['to'] === $draft['customerEmail'], 'Send uses only saved recipient and content, ignoring replacement fields.');
    check($mail_calls[0]['body'] === $preview['html'] && $mail_calls[0]['subject'] === $preview['subject'], 'Actual mail matches the exact reviewed preview.');
    check($sent['status'] === $stage && $sent['orderText'] === $original['orderText'] && $sent['productionDate'] === $original['productionDate'], 'Sending never confirms, reprices or schedules an order.');
    check($sent['quotationMail']['customer']['state'] === 'sent' && empty($sent['confirmationMail']['customer']), 'Quotation receipt is separate from final confirmation.');
    send_quote($sent); b2b_save(array('id' => $sent['id'], 'importantNotes' => 'Only internal'));
    check(count($mail_calls) === 1, 'Repeated sends and private updates do not duplicate mail.');
    $forged=b2b_save(array('id'=>$sent['id'],'quotationMail'=>array('version'=>'forged','customer'=>array('state'=>'sent'))));
    check($forged['quotationMail']['version']===$sent['quotationMail']['version'] && $forged['quotationMail']['customer']['email']===$sent['customerEmail'], 'Ordinary saves cannot forge or erase quotation history.');
    check(preview_quote($sent['id'])['order']['quotationMail']['customer']['state'] === 'sent', 'Readback retains sent state.');
}
echo "PASS request/offer mail, exact preview, saved recipient, separate history, no approval or unsolicited backup\n";

reset_mails();
$draft = b2b_save(array_merge(final_fixture('quote-revisions'), array('status' => 'aanvraag')));
$sent = send_quote($draft);
$changed = b2b_save(array('id' => $draft['id'], 'totalExVat' => '300.00', 'customerEmail' => 'new@example.invalid'));
check($changed['quotationMail']['version'] !== $draft['quotationMail']['version'], 'Recipient or content changes create a new review version.');
check(is_wp_error(send_quote($draft)) && count($mail_calls) === 1, 'Stale preview cannot mail changed content or a different recipient.');
$new_preview = preview_quote($changed['id']); $resent = send_quote($changed);
check(count($mail_calls) === 2 && $mail_calls[1]['to'] === 'new@example.invalid' && $mail_calls[1]['body'] === $new_preview['html'], 'Explicit revision sends only the newly reviewed contents.');
$reverted=b2b_save(array('id'=>$draft['id'],'totalExVat'=>$draft['totalExVat'],'customerEmail'=>$draft['customerEmail']));
check($reverted['quotationMail']['version']!==$draft['quotationMail']['version'], 'Returning to earlier contents remains a new review version.');
$offered = b2b_save(array('id' => $draft['id'], 'status' => 'offerte'));
check($offered['quotationMail']['version'] !== $changed['quotationMail']['version'], 'Changing inquiry to offer requires a new review.');
$before_final_count = count($mail_calls);
$final = b2b_save(array('id' => $draft['id'], 'status' => 'akkoord'));
check(count($mail_calls) === $before_final_count + 1, 'Finalization still sends only its ordinary internal backup.');
check(empty($final['confirmationMail']['customer']) && is_wp_error(send_quote($final)), 'A prior quotation neither counts as final customer confirmation nor enables mailing a final order as a quotation.');
check(!is_wp_error(mail_final($final)) && count($mail_calls) === $before_final_count + 2, 'Final confirmation remains an independent deliberate customer action.');
echo "PASS changed recipient/content/status, stale previews and separate definitive confirmation\n";

foreach (array(array('status'=>'afgewezen'), array('status'=>'akkoord'), array('cancelled'=>true), array('id'=>'historie-blocked')) as $override) {
    reset_mails();
    $blocked = b2b_save(array_merge(final_fixture('blocked-' . md5(json_encode($override))), array('status'=>'aanvraag'), $override));
    reset_mails();check(is_wp_error(preview_quote($blocked['id'])) && is_wp_error(send_quote($blocked)) && count($mail_calls) === 0, 'Inactive, final and historical orders are rejected.');
}
reset_mails();
$missing = b2b_save(array_merge(final_fixture('quotation-no-email'), array('customerEmail'=>'', 'status'=>'offerte')));
check(!is_wp_error(preview_quote($missing['id'])) && is_wp_error(send_quote($missing)) && count($mail_calls) === 0, 'Missing email can preview, but cannot send.');
$undated = b2b_save(array_merge(final_fixture('quotation-undated'), array('status'=>'aanvraag', 'deliveryDate'=>'', 'deliveryDateEnd'=>'', 'deliveryWindowType'=>'date', 'totalExVat'=>'')));
$undated_preview = preview_quote($undated['id']);
check(has($undated_preview['html'], 'Nog af te spreken') && !has($undated_preview['html'], 'AFGESPROKEN TOTAAL'), 'Missing date/price stays explicitly unknown.');
echo "PASS stage restrictions, cancellation, archival protection and missing details\n";

reset_mails();
$failure = b2b_save(array_merge(final_fixture('quotation-failure'), array('status'=>'offerte')));
reset_mails(array(false));$failed = send_quote($failure);
check($failed['quotationMail']['customer']['state'] === 'failed' && count($mail_calls) === 1, 'Known transport failure is retryable and visible.');
reset_mails();$recovered = send_quote($failed);send_quote($recovered);
check($recovered['quotationMail']['customer']['state'] === 'sent' && count($mail_calls) === 1, 'Known failure retries once, successful version deduplicates.');
$failure = b2b_save(array_merge(final_fixture('quotation-uncertain'), array('status'=>'aanvraag')));
$receipt_key = 'strik_b2b_mail_' . hash('sha256', $failure['id'] . '|quotation|' . $failure['quotationMail']['version']);
$mail_after_send = function () use ($receipt_key) { global $fail_option_key; $fail_option_key = $receipt_key; };
reset_mails();$uncertain = send_quote($failure);unset($mail_after_send);$fail_option_key='';
check($uncertain['quotationMail']['customer']['state'] === 'sending', 'Receipt failure after transport is uncertain.');
$readback = preview_quote($uncertain['id']);send_quote($uncertain);
check($readback['order']['quotationMail']['customer']['state'] === 'sending' && count($mail_calls) === 1, 'Preview recovers durable uncertainty and repeated send never duplicates it.');
$blocked_storage = b2b_save(array_merge(final_fixture('quotation-storage'), array('status'=>'offerte')));
$stored_orders=get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME);unset($stored_orders[strik_sinterklaas_order_key($blocked_storage['id'])]['quotationMail']);update_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME,$stored_orders);
reset_mails();$fail_option_key=STRIK_SINTERKLAAS_B2B_OPTION_NAME;check(is_wp_error(send_quote($blocked_storage)) && count($mail_calls) === 0, 'Order storage failure prevents transport.');$fail_option_key='';
$key = 'strik_b2b_mail_' . hash('sha256', $blocked_storage['id'] . '|quotation|' . $blocked_storage['quotationMail']['version']);
$fail_option_key=$key;$not_sent=send_quote($blocked_storage);$fail_option_key='';
check($not_sent['quotationMail']['customer']['state'] === 'failed' && count($mail_calls) === 0, 'Receipt claim failure prevents transport.');
echo "PASS failed transport, uncertainty recovery, duplicate protection and durable storage gates\n";

if (getenv('STRIK_QUOTATION_PREVIEW_DIR')) {
    $dir=getenv('STRIK_QUOTATION_PREVIEW_DIR');
    foreach (array('aanvraag','offerte') as $stage) {
        $example=b2b_save(array_merge(final_fixture('preview-'.$stage),array('status'=>$stage,'contactName'=>'Sanne','season'=>'kerst','customerName'=>'Voorbeeldbedrijf','importantNotes'=>'INTERNE NOTITIE','invoiceInfo'=>'PRIVE')));
        $preview=preview_quote($example['id']);
        file_put_contents($dir.'/'.$stage.'.html',$preview['html']);
        file_put_contents($dir.'/'.$stage.'.json',wp_json_encode($preview));
    }
}
echo "All quotation mail tests passed; no real emails sent.\n";
