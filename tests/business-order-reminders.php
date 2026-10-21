<?php
// No network or real mail: the WordPress fixtures capture every wp_mail call.
require __DIR__ . '/b2b-confirmation.php';
$wpdb->available = true; $options = array(); $fail_option_key = ''; reset_mails();
function attention_fixture($id = 'attention', $changes = array()) {
    return strik_sinterklaas_sanitize_b2b_order(array_merge(final_fixture($id), array('status' => 'akkoord', 'deliveryDate' => '2026-10-28', 'deliveryWindowType' => 'date', 'deliveryDateEnd' => '', 'entered' => false), $changes));
}
function seed_attention($order) {
    $orders = get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME, array());
    $orders[strik_sinterklaas_order_key($order['id'])] = $order;
    update_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
}
$base = attention_fixture();
check(strik_business_b2b_attention($base, '2026-10-20') === null, 'Eight days away is outside the reminder window.');
check(strik_business_b2b_attention($base, '2026-10-21')['stage'] === 'one-week', 'Seven days away is included.');
check(strik_business_b2b_attention($base, '2026-10-26')['stage'] === 'two-days', 'Two days away has its own escalation.');
check(strik_business_b2b_attention($base, '2026-10-28')['stage'] === 'delivery-day', 'The delivery day has a final check.');
check(strik_business_b2b_attention($base, '2026-10-29') === null, 'An expired fixed date is not mailed as a future delivery.');
foreach (array(array('entered' => true), array('cancelled' => true), array('delivered' => true), array('status' => 'afgewezen'), array('id' => 'historie-2026-order'), array('deliveryDate' => '2026-02-30')) as $changes) check(strik_business_b2b_attention(array_merge($base, $changes), '2026-10-21') === null, 'Resolved, cancelled, historical or invalid entries are excluded.');
foreach (array('aanvraag', 'offerte') as $status) check(strik_business_b2b_attention(array_merge($base, array('status' => $status, 'entered' => true)), '2026-10-21')['reason'] === 'not-confirmed', 'An entered concept/offer still needs customer approval.');
$range = array_merge($base, array('deliveryWindowType' => 'range', 'deliveryDate' => '2026-10-28', 'deliveryDateEnd' => '2026-11-03'));
check(strik_business_b2b_attention($range, '2026-10-21')['days'] === 7 && strik_business_b2b_attention($range, '2026-10-30')['stage'] === 'delivery-day', 'Delivery periods use their earliest day and remain relevant while open.');
$week = array_merge($base, array('deliveryWindowType' => 'week', 'deliveryWeek' => '2026-W44', 'deliveryDate' => '2026-10-30'));
check(strik_business_b2b_attention($week, '2026-10-21')['window']['start'] === '2026-10-26', 'A week means Monday, even if a later date was stored.');
check(strik_business_b2b_delivery_window(array_merge($week, array('deliveryWeek' => '2026-W54'))) === null, 'Invalid ISO weeks cannot silently move to another year.');
check(strik_business_b2b_attention(array_merge($base, array('deliveryDate' => '2026-10-31')), '2026-10-24')['days'] === 7, 'Seven calendar days remain seven across daylight saving.');
check(strik_business_b2b_delivery_window(array_merge($base, array('sourceSheet' => '__STRIK_LEVERPERIODE__range|2026-11-03|')))['end'] === '2026-11-03', 'Legacy delivery windows remain lossless.');
echo "PASS seven-day boundary, phases, resolved orders, earliest delivery dates, ISO weeks and DST\n";
seed_attention($base); $before = $options;
$preview = strik_business_b2b_reminders_unlocked('2026-10-21', true);
check($preview['eligible'] === 1 && count($mail_calls) === 0 && $options === $before, 'Dry runs cannot send or change receipts.');
$first = strik_business_b2b_reminders_unlocked('2026-10-21');
check($first['sent'] === 1 && count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'One internal warning goes only to the bakery recipient.');
check(has($mail_calls[0]['subject'], 'nog invoeren in Bake-it') && has($mail_calls[0]['body'], 'background:#244b37') && has($mail_calls[0]['body'], 'Voorbeeldstraat') && has($mail_calls[0]['body'], 'ALLEEN INTERN'), 'Warning includes the clear action, green design and full operational details.');
check(in_array('Content-Type: text/html; charset=UTF-8', $mail_calls[0]['headers']), 'Reminder is HTML.');
strik_business_b2b_reminders_unlocked('2026-10-21'); strik_business_b2b_reminders_unlocked('2026-10-22');
check(count($mail_calls) === 1, 'Repeated jobs and later checks in the same stage do not spam.');
strik_business_b2b_reminders_unlocked('2026-10-26'); strik_business_b2b_reminders_unlocked('2026-10-28');
check(count($mail_calls) === 3, 'Unresolved orders get at most the week, two-day and delivery-day escalation.');
$resolved = array_merge($base, array('entered' => true)); seed_attention($resolved); strik_business_b2b_reminders_unlocked('2026-10-28');
check(count($mail_calls) === 3, 'Marking the final order entered stops warnings.');
$offer = attention_fixture('offer', array('season' => 'kerst', 'status' => 'offerte', 'entered' => true)); seed_attention($offer);
strik_business_b2b_reminders_unlocked('2026-10-21');
check(count($mail_calls) === 4 && has($mail_calls[3]['subject'], 'bestelling definitief en ingevoerd?') && has($mail_calls[3]['body'], 'Offerte') && !has($mail_calls[3]['body'], 'Uw bestelling is bevestigd'), 'Tentative Christmas orders use the correct internal warning and never look confirmed.');
$offer['status'] = 'akkoord'; $offer['entered'] = false; seed_attention($offer); strik_business_b2b_reminders_unlocked('2026-10-21');
check(count($mail_calls) === 5, 'Moving from offer to final-but-not-entered creates the appropriate new warning.');
echo "PASS internal-only green mails, staged duplicate protection, finalization and resolution\n";
$options = array(); reset_mails(array(false)); $failed = attention_fixture('retry'); seed_attention($failed);
$result = strik_business_b2b_reminders_unlocked('2026-10-21'); check($result['failed'] === 1, 'Transport failure remains explicit.');
reset_mails(); $result = strik_business_b2b_reminders_unlocked('2026-10-21'); check($result['sent'] === 1 && count($mail_calls) === 1, 'A failed transport is safely retryable.');
$options = array(); reset_mails(); $blocked = attention_fixture('blocked'); seed_attention($blocked);
$attention = strik_business_b2b_attention($blocked, '2026-10-21'); $receipt_key = 'strik_b2b_attention_' . $attention['version']; $fail_option_key = $receipt_key;
$result = strik_business_b2b_reminders_unlocked('2026-10-21'); check(count($mail_calls) === 0 && $result['failed'] === 1, 'No outgoing mail without a durable receipt.');
$fail_option_key = ''; $mail_after_send = function () use ($receipt_key) { global $fail_option_key; $fail_option_key = $receipt_key; };
$result = strik_business_b2b_reminders_unlocked('2026-10-21'); $mail_after_send = null; $fail_option_key = '';
check($result['uncertain'] === 1 && count($mail_calls) === 1, 'An uncertain post-send write is not claimed successful.');
strik_business_b2b_reminders_unlocked('2026-10-21'); check(count($mail_calls) === 1, 'Uncertain sends never automatically duplicate.');
$protected = strik_sinterklaas_sanitize_b2b_order(array_merge($blocked, array('attentionMail' => array('state' => 'forged'))), array('attentionMail' => array('state' => 'sent')));
check($protected['attentionMail']['state'] === 'sent', 'Reminder history belongs to the server.');
if (getenv('STRIK_MAIL_PREVIEW_DIR')) {
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR') . '/definitief.html', strik_business_b2b_attention_html($base, strik_business_b2b_attention($base, '2026-10-21')));
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR') . '/offerte.html', strik_business_b2b_attention_html($offer = array_merge($offer, array('status' => 'offerte')), strik_business_b2b_attention($offer, '2026-10-21')));
}
echo "PASS dry runs, failed retries, durable/uncertain sends and protected reminder history\nAll reminder tests passed; no real emails sent.\n";
