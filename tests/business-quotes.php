<?php
// All email is captured by the existing fixtures; no real messages are sent.
require __DIR__ . '/business-mailing.php';
if (!defined('HOUR_IN_SECONDS')) define('HOUR_IN_SECONDS', 3600);
$transients = array();
function get_transient($key) { global $transients; return isset($transients[$key]) ? $transients[$key] : false; }
function set_transient($key, $value, $duration) { global $transients; $transients[$key] = $value; }
class QuoteDatabase {
    public $prefix = 'test_'; public $available = true;
    function prepare($query, $name) { return $query; }
    function get_var($query) { return $this->available ? '1' : '0'; }
}
$wpdb = new QuoteDatabase();
class QuoteRequest {
    private $input;
    function __construct($input) { $this->input = $input; }
    function get_json_params() { return $this->input; }
}
function quote_fixture($id = 'f1234567-1234-4567-8123-123456789abc', $consent = false) {
    return array('requestId' => $id, 'reference' => 'KERST26-F12345671234', 'payloadHash' => str_repeat('a', 64),
        'quoteText' => "25 × Bonbons\n25 gelijke pakketten\n3 × Kerstchocolade\nTelefoon: 0612345678\nE-mail: quote@example.invalid\nAdres: Voorbeeldstraat 1\nDatum: 2026-12-18\nWensen: <script>alert(1)</script>",
        'snapshot' => array('consent' => $consent, 'selection' => array('contents' => array('kerstchocolade' => 3), 'packageCount' => 25)),
        'order' => array('customerName' => 'Voorbeeld & Co', 'customerEmail' => 'quote@example.invalid', 'phone' => '0612345678', 'season' => 'kerst', 'status' => 'akkoord', 'year' => '2026', 'department' => 'bakkerij', 'orderText' => 'Complete aanvraag', 'deliveryDate' => '2026-12-18', 'totalExVat' => '839.50', 'importantNotes' => 'Kaartje per pakket', 'productionScheduled' => true));
}
function submit_quote($input) { return strik_business_folder_quote(new QuoteRequest($input)); }
$options = array(); reset_mails();
$input = quote_fixture();
$received = submit_quote($input);
check(!is_wp_error($received) && $received['ok'] && $received['saved'] && $received['mailSent'], 'Success means both B2B storage and mail transport accepted.');
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === 'info@strik-patisserie.nl', 'Exactly one internal notification; no unsolicited customer email.');
check(has($mail_calls[0]['body'], 'background:#244b37') && has($mail_calls[0]['body'], '25 gelijke pakketten') && has($mail_calls[0]['body'], 'Voorbeeldstraat 1') && has($mail_calls[0]['body'], '0612345678'), 'Green internal notification contains the complete request.');
check(!has($mail_calls[0]['body'], '<script>'), 'Customer content cannot inject HTML.');
$orders = get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
check(count($orders) === 1, 'One B2B inquiry was created.');
$order = array_values($orders)[0];
check($order['status'] === 'aanvraag' && !$order['productionScheduled'], 'Website requests never become confirmed or scheduled orders.');
check($order['folderQuote']['snapshot']['selection']['contents']['kerstchocolade'] === 3, 'Original structured selection is retained.');
submit_quote($input);
check(count($mail_calls) === 1 && count(get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME)) === 1, 'Retry cannot duplicate the saved order or successful mail.');
$input['payloadHash'] = str_repeat('b', 64);
check(is_wp_error(submit_quote($input)), 'An idempotency key cannot be reused for different content.');
$book = get_option('strik_business_mailing_contacts_v1');
check($book['customers'][0]['recipients'][0]['doNotEmail'], 'Submitting a quote is not newsletter consent.');
echo "PASS complete quote saved as inquiry, green internal mail, safe content and idempotent retry\n";

$input = quote_fixture('e1234567-1234-4567-8123-123456789abc');
reset_mails(array(false));
$pending = submit_quote($input);
check($pending['saved'] && !$pending['ok'] && !$pending['mailSent'], 'Mail failure reports partial success truthfully.');
$count = count(get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME));
reset_mails(); $retried = submit_quote($input);
check($retried['ok'] && count($mail_calls) === 1 && count(get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME)) === $count, 'Retry sends only the failed mail without another inquiry.');
check(get_option('strik_business_mailing_contacts_v1')['customers'][0]['recipients'][0]['doNotEmail'], 'Existing unsubscribe survives another quote.');
echo "PASS failed-mail recovery and newsletter consent remains independent\n";

$id = 'd1234567-1234-4567-8123-123456789abc'; $input = quote_fixture($id, true);
reset_mails(); submit_quote($input);
check(!get_option('strik_business_mailing_contacts_v1')['customers'][0]['recipients'][0]['doNotEmail'], 'Explicit consent subscribes to both folders.');
$orders = get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
$key = strik_sinterklaas_order_key('folder-' . $id); $before = $orders[$key]['folderQuote'];
reset_mails();
$edited = strik_sinterklaas_b2b_save(new QuoteRequest(array('id' => 'folder-' . $id, 'importantNotes' => 'Interne wijziging', 'folderQuote' => array('reference' => 'forged'))));
check(!is_wp_error($edited) && $edited['folderQuote'] === $before && count($mail_calls) === 0, 'Management edits retain the immutable receipt and do not resend inquiry mail.');
$receipt_key = 'strik_folder_quote_' . str_replace('-', '', $id);
$receipt = get_option($receipt_key); $receipt['folderQuote']['mailSentAt'] = ''; $receipt['folderQuote']['mailState'] = 'sending';
update_option($receipt_key, $receipt);
$pending = submit_quote($input);
check($pending['saved'] && !$pending['mailSent'] && count($mail_calls) === 0, 'An uncertain transport outcome is not resent automatically.');
$options_before = get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
unset($options_before[strik_sinterklaas_order_key('folder-f1234567-1234-4567-8123-123456789abc')]);
update_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $options_before);
reset_mails(); submit_quote(quote_fixture());
check(count(get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME)) === count($options_before) && count($mail_calls) === 0, 'A retry cannot resurrect an inquiry after management deleted it.');
$input = quote_fixture('b1234567-1234-4567-8123-123456789abc');
$fail_option_key = 'strik_folder_quote_' . str_replace('-', '', $input['requestId']);
check(is_wp_error(submit_quote($input)) && count($mail_calls) === 0, 'No email can be sent when the receipt cannot be stored.');
$fail_option_key = STRIK_SINTERKLAAS_B2B_OPTION_NAME;
$pending = submit_quote($input);
check(!$pending['saved'] && !$pending['mailSent'] && count($mail_calls) === 0, 'No success or mail before the B2B entry is durably stored.');
$fail_option_key = '';
$retried = submit_quote($input);
check($retried['ok'] && count($mail_calls) === 1, 'Retry recovers a failed B2B write from its durable receipt.');
reset_mails();
$wpdb->available = false;
check(is_wp_error(submit_quote(quote_fixture('c1234567-1234-4567-8123-123456789abc'))) && count($mail_calls) === 0, 'No storage or mail occurs if the concurrency lock is unavailable.');
echo "PASS immutable receipt, explicit newsletter consent and concurrent-send protection\n";
echo "All business quote tests passed; no real emails sent.\n";
