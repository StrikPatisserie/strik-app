<?php
// Run with PHP CLI, or: npx @php-wasm/cli tests/sinterklaas-mail.php
// wp_mail is captured locally: this suite never sends real messages.
error_reporting(E_ALL);
set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

define('STRIK_SINTERKLAAS_API_KEY', 'test-only');
define('STRIK_SINTERKLAAS_RECIPIENT', 'bakery@example.invalid');
$mail_calls = array();
$mail_results = array();
$options = array();
function add_action($name, $callback) {}
function absint($value) { return abs((int) $value); }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_attr($value) { return esc_html($value); }
function wp_date($format) { return $format === 'Y' ? '2026' : '2026-10-20T12:00:00+02:00'; }
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_textarea_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_email($value) { return filter_var($value, FILTER_SANITIZE_EMAIL); }
function is_email($value) { return filter_var($value, FILTER_VALIDATE_EMAIL) !== false; }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower($value)); }
function get_option($name, $default = array()) { global $options; return isset($options[$name]) ? $options[$name] : $default; }
function update_option($name, $value, $autoload = false) { global $options, $fail_option_key; if (isset($fail_option_key) && $fail_option_key === $name) return false; $options[$name] = $value; return true; }
function rest_ensure_response($value) { return $value; }
function wp_mail($to, $subject, $body, $headers) {
    global $mail_calls, $mail_results;
    $mail_calls[] = compact('to', 'subject', 'body', 'headers');
    return count($mail_results) ? array_shift($mail_results) : true;
}
require __DIR__ . '/../app/wordpress-snippets/strik-sinterklaas-api.php';

function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function has($text, $part) { return strpos($text, $part) !== false; }
function reset_mails($results = array()) { global $mail_calls, $mail_results; $mail_calls = array(); $mail_results = $results; }
function fixture() {
    return array(
        'id' => 'test-order', 'year' => '2026', 'code' => 'CL26-001', 'source' => 'winkel',
        'customerName' => 'Testklant & Co', 'customerEmail' => 'customer@example.invalid',
        'phone' => '0612345678', 'pickupDate' => '2026-11-05', 'pickupLocation' => 'Heyendaal', 'shop' => 'Heyendaal',
        'notes' => "Bel eerst\nInterne instructie <script>alert(1)</script>", 'giftWrap' => true,
        'lines' => array(array('id' => 'line-1', 'letter' => 'G', 'chocolate' => 'melk', 'style' => 'spuit', 'size' => 'groot', 'quantity' => 5, 'logo' => false, 'specialRequests' => array(), 'notes' => 'Geen versiering <img src=x>')),
        'totalCents' => 6975, 'paidAmountCents' => 2000, 'paid' => false, 'sendCustomerEmail' => true,
        'bakeryEmailSentAt' => '', 'bakeryEmailError' => '', 'customerConfirmationSentAt' => '', 'customerConfirmationError' => '',
    );
}

$order = fixture();
$sent = strik_sinterklaas_send_letter_emails($order);
check(count($mail_calls) === 2, 'A new store order sends one internal and one customer mail.');
check($mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT && $mail_calls[1]['to'] === $order['customerEmail'], 'Recipients are separate.');
foreach ($mail_calls as $mail) {
    check(in_array('Content-Type: text/html; charset=UTF-8', $mail['headers'], true), 'Both messages are HTML.');
    check(has($mail['body'], 'background:#244b37'), 'Both messages use the green Strik design.');
    check(!preg_match('/\b(?:bcc|cc):/i', implode("\n", $mail['headers'])), 'No duplicate copies are sent via CC or BCC.');
}
$internal = $mail_calls[0]['body'];
$customer = $mail_calls[1]['body'];
foreach (array('Nieuwe winkelbestelling', 'Winkelbestelling · interne back-up', 'background:#faf3df', '0612345678', 'customer@example.invalid', 'Bel eerst', 'Geen versiering', 'Testklant &amp; Co', '05-11-2026', 'Heyendaalseweg 217', '69,75', '20,00', '49,75', '5×') as $part) {
    check(has($internal, $part), 'Internal mail includes ' . $part);
}
check(!has($internal, '<script>') && !has($internal, '<img src=x>') && has($internal, '&lt;script&gt;'), 'Notes are escaped as text.');
check(has($customer, 'Uw chocoladeletters zijn besteld!') && !has($customer, 'Interne instructie') && !has($customer, 'Geen versiering'), 'Customer confirmation keeps its own content without internal notes.');
check(strpos($mail_calls[0]['subject'], 'Winkelbestelling chocoladeletters CL26-001') === 0, 'Store origin is visible at the start of the internal subject.');
check(!has($internal, 'Lettershopbestelling') && !has($customer, 'interne back-up'), 'The store and customer templates have the correct labels.');
check($sent['bakeryEmailSentAt'] !== '' && $sent['customerConfirmationSentAt'] !== '', 'Both successful sends are recorded.');
echo "PASS separate green internal and customer mails, complete contacts and escaped notes\n";

reset_mails();
strik_sinterklaas_send_letter_emails($sent, $sent);
check(count($mail_calls) === 0, 'Saving an unchanged sent order does not resend anything.');
echo "PASS unchanged orders do not send duplicate mail\n";

foreach (array(array('customerEmail' => ''), array('sendCustomerEmail' => false), array('customerEmail' => '', 'sendCustomerEmail' => false)) as $changes) {
    reset_mails();
    $without_customer = array_merge(fixture(), $changes);
    $result = strik_sinterklaas_send_letter_emails($without_customer);
    check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'Internal mail is independent of customer email and opt-in.');
    check($result['bakeryEmailSentAt'] !== '' && $result['customerConfirmationSentAt'] === '', 'Only the internal send is recorded.');
    if ($without_customer['customerEmail'] === '') check(has($mail_calls[0]['body'], '<strong>E-mail:</strong> Niet opgegeven'), 'Missing address is clearly displayed.');
}
echo "PASS internal mail is sent without customer email or customer opt-in\n";

reset_mails(array(false, true));
$failed_internal = strik_sinterklaas_send_letter_emails(fixture());
check($failed_internal['bakeryEmailSentAt'] === '' && $failed_internal['bakeryEmailError'] !== '' && $failed_internal['customerConfirmationSentAt'] !== '', 'An internal failure does not block the customer confirmation.');
reset_mails();
strik_sinterklaas_send_letter_emails($failed_internal, $failed_internal);
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'Retry sends only the failed internal message.');
reset_mails(array(true, false));
$failed_customer = strik_sinterklaas_send_letter_emails(fixture());
reset_mails();
strik_sinterklaas_send_letter_emails($failed_customer, $failed_customer);
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === fixture()['customerEmail'], 'Retry sends only the failed customer confirmation.');
echo "PASS independent failures and retries do not duplicate successful sends\n";

reset_mails();
strik_sinterklaas_send_letter_emails(array_merge(fixture(), array('source' => 'online')));
check(count($mail_calls) === 0, 'The separate online checkout mail flow remains untouched.');
echo "PASS online checkout continues to use its own mail flow\n";

class TestLetterRequest {
    private $params;
    function __construct($params) { $this->params = $params; }
    function get_json_params() { return $this->params; }
}
reset_mails();
$saved = strik_sinterklaas_letter_save(new TestLetterRequest(fixture()));
check(count($mail_calls) === 2, 'Saving a new order sends two separate messages.');
reset_mails();
$saved = strik_sinterklaas_letter_save(new TestLetterRequest(array('id' => $saved['id'], 'productionDone' => true)));
check(count($mail_calls) === 0, 'Production status changes do not send order mail.');
reset_mails();
$saved = strik_sinterklaas_letter_save(new TestLetterRequest(array('id' => $saved['id'], 'notes' => 'Nieuwe interne opmerking')));
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT && has($mail_calls[0]['body'], 'Gewijzigde winkelbestelling') && has($mail_calls[0]['body'], 'Nieuwe interne opmerking') && strpos($mail_calls[0]['subject'], 'Gewijzigde winkelbestelling') === 0, 'Changed internal notes send one green store update only.');
reset_mails();
$saved = strik_sinterklaas_letter_save(new TestLetterRequest(array('id' => $saved['id'], 'pickupDate' => '2026-11-06')));
check(count($mail_calls) === 2 && has($mail_calls[1]['body'], 'Uw bestelling is aangepast'), 'Changed pickup details notify both parties separately.');
reset_mails(array(false));
$failed_update = strik_sinterklaas_letter_save(new TestLetterRequest(array('id' => $saved['id'], 'phone' => '0699999999')));
check(count($mail_calls) === 1 && $failed_update['bakeryEmailSentAt'] === '' && $failed_update['bakeryEmailError'] !== '', 'A failed internal update stays retryable.');
reset_mails();
strik_sinterklaas_letter_save(new TestLetterRequest(array('id' => $saved['id'])));
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'Retrying an internal update does not resend the customer confirmation.');
echo "PASS order save integration: updates, status changes and retries\n";

// Optional local previews with fake customer details, never actual customer data.
if (getenv('STRIK_MAIL_PREVIEW_DIR')) {
    $dir = rtrim(getenv('STRIK_MAIL_PREVIEW_DIR'), '/');
    $preview = fixture();
    $preview['notes'] = "Graag feestelijk inpakken.\nKlant haalt de bestelling in de middag op.";
    $preview['lines'][0]['notes'] = 'Geen versiering';
    file_put_contents($dir . '/interne-bestelmail.html', strik_sinterklaas_letter_mail_html($preview, false, false, true));
    file_put_contents($dir . '/klantbevestiging.html', strik_sinterklaas_letter_customer_mail_html($preview));
}
echo "All Sinterklaas mail tests passed; no real emails sent.\n";
