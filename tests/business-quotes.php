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

$details = "BEDRIJF EN CONTACT\nBedrijf: Voorbeeld & Co\nContactpersoon: Testpersoon\nE-mail: quote@example.invalid\nTelefoon: 0612345678\n\nGEKOZEN SINTERKLAASPRODUCTEN\n3 × Chocolade spuitletters · spuitletter S groot · melk\n  € 12,80 p.s. excl. btw · € 38,40 totaal excl. btw\n\nPRIJSINDICATIE\n€ 38,40 excl. btw / € 41,85 incl. btw\nExtra verpakking en bezorging in overleg.\n\nGEWENSTE LEVERING\n2026-11-23\nBezorgen\nAfleveradres: Voorbeeldstraat 1\nTweede adresregel\n\nWENSEN\nEen kaartje\n<script>alert(1)</script>\nPRIJSINDICATIE\nDit is vrije klanttekst";
$order['folderQuote']['quoteText'] = $details;
$sint_html = strik_business_quote_html(array_merge($order, array('season' => 'sint')));
check(has($sint_html, '<h2') && has($sint_html, '>Gekozen producten</h2>') && has($sint_html, '>Gewenste levering</h2>'), 'Sections have real HTML headings, not CSS-only line breaks.');
check(has($sint_html, '>Bedrijf</td><td') && has($sint_html, '>Voorbeeld &amp; Co</td>'), 'Contact details render in separate label/value cells.');
check(has($sint_html, '€ 38,40 excl. btw / € 41,85 incl. btw') && has($sint_html, '>Tweede adresregel</p>'), 'Amounts and multiline address remain intact.');
check(!has($sint_html, '<script>') && substr_count($sint_html, '>Prijsindicatie</h2>') === 1, 'Free customer text stays escaped and cannot create extra sections.');
$christmas = str_replace('GEKOZEN SINTERKLAASPRODUCTEN', 'LOSSE KERSTCADEAUS', $details);
$christmas = str_replace('PRIJSINDICATIE', "KERSTPAKKET OP MAAT\n25 gelijke pakketten, met per pakket:\n  3 × Kerstchocolade · € 17,10 excl. btw per pakket\nPer pakket: € 23,55 excl. btw / € 25,67 incl. btw\n\nPRIJSINDICATIE", $christmas);
$kerst_html = strik_business_quote_details_html($christmas);
check(has($kerst_html, '>Losse kerstcadeaus</h2>') && has($kerst_html, '>Kerstpakket op maat</h2>') && has($kerst_html, '3 × Kerstchocolade'), 'Christmas singles and package contents have their own sections.');
check(has(strik_business_quote_details_html("Oud formaat\nNog een regel"), '>Oud formaat</p><p') && has(strik_business_quote_details_html("Oud formaat\nNog een regel"), '>Nog een regel</p>'), 'Legacy or unrecognized quote text retains explicit paragraph breaks.');
if (getenv('STRIK_MAIL_PREVIEW_DIR')) {
    $preview_order = array_merge($order, array('season' => 'sint'));
    $preview_order['folderQuote']['reference'] = 'SINT26-F12345671234';
    $preview_order['folderQuote']['quoteText'] = substr($details, 0, strpos($details, "WENSEN\n")) . "WENSEN\nGraag iedere letter in cadeaupapier. Levering bij de receptie.\n\nVrijblijvende aanvraag; beschikbaarheid, levermoment en definitieve prijs moeten nog worden bevestigd.";
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR') . '/sint.html', strik_business_quote_html($preview_order));
    $order['folderQuote']['quoteText'] = $christmas;
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR') . '/kerst.html', strik_business_quote_html($order));
}
echo "PASS structured Sint and Christmas email sections, totals, line breaks and safe free text\n";
