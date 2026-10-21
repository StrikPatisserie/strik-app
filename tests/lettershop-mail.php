<?php
// wp_mail is captured: no real messages are sent.
error_reporting(E_ALL);
$mail_calls = array();
$mail_options = array();
$mail_succeeds = true;
function add_action($name, $callback) {}
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_email($value) { return (string) $value; }
function sanitize_textarea_field($value) { return trim(strip_tags((string) $value)); }
function esc_html($value) { return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8'); }
function esc_attr($value) { return esc_html($value); }
function is_email($value) { return filter_var($value, FILTER_VALIDATE_EMAIL) !== false; }
function get_option($key) { global $mail_options; return $mail_options[$key] ?? false; }
function update_option($key, $value, $autoload = false) { global $mail_options; $mail_options[$key] = $value; return true; }
function rest_ensure_response($value) { return $value; }
function wp_mail($to, $subject, $body, $headers, $attachments = array()) { global $mail_calls, $mail_succeeds; $mail_calls[] = compact('to', 'subject', 'body', 'headers', 'attachments'); return $mail_succeeds; }
class WP_Error { public $code; function __construct($code, $message, $data) { $this->code = $code; } }
class MailRequest { private $data; function __construct($data) { $this->data = $data; } function get_json_params() { return $this->data; } }
function check($value, $message) { if (!$value) throw new RuntimeException($message); }
function has($text, $part) { return strpos($text, $part) !== false; }
require __DIR__ . '/../app/wordpress-snippets/strik-lettershop-mail-api.php';
$payload = array('gift_wrap' => true, 'gift_wrap_price_cents' => 25, 'gift_wrap_total_cents' => 50, 'total_cents' => 2840);
$text = implode("\n", strik_lettershop_mail_lines($payload, true));
foreach (array('EUR 0,25 per letter', 'Toeslag cadeaupapier: EUR 0,50', 'Totaal inclusief 9% btw: EUR 28,40') as $part) {
    if (strpos($text, $part) === false) throw new RuntimeException('Missing: ' . $part);
}
$payload['gift_wrap_price_cents'] = 100;
if (strpos(implode("\n", strik_lettershop_mail_lines($payload, false)), 'EUR 1,00 per letter') === false) {
    throw new RuntimeException('Historical mail must preserve its saved wrapping rate.');
}
echo "PASS current and historical gift-wrap prices and totals\n";

$order = array(
    'channel' => 'ONLINE', 'order_number' => 'CL26-0004', 'customer_name' => 'Voorbeeldklant & Co',
    'customer_email' => 'customer@example.invalid', 'phone' => '0612345678', 'requested_date' => '2026-11-06',
    'pickup_location' => 'lent', 'entered_store' => null, 'notes' => "Bel vooraf\nGeen noten <script>test</script>",
    'gift_wrap' => true, 'gift_wrap_price_cents' => 25, 'gift_wrap_total_cents' => 50, 'total_cents' => 2840,
    'items' => array(array('letter' => 'M', 'flavour' => 'melk', 'style' => 'spuit', 'size' => 'groot', 'quantity' => 2, 'unit_price_cents' => 1395, 'logo_price_cents' => 0, 'logo' => false, 'notes' => 'Zonder versiering <img src=x>')),
);
$html = strik_lettershop_mail_html($order);
foreach (array('background:#244b37', 'Lettershopbestelling', 'Online besteld via de Lettershop', 'background:#c8e2d4', 'background:#edf6f0', '0612345678', 'customer@example.invalid', 'Oranje Marieplein 11', '06-11-2026', '2×', '13,95 p.st.', '0,25 per letter', '0,50', '28,40', 'Bel vooraf', 'Geen noten') as $part) check(has($html, $part), 'Online template includes ' . $part);
check(!has($html, '<script>') && !has($html, '<img src=x>') && has($html, '&lt;script&gt;'), 'HTML notes are escaped.');
check(!has($html, 'Winkelbestelling'), 'An online pickup at Lent is still a Lettershop order.');
check(strpos(strik_lettershop_mail_subject($order, 'INTERNAL_ORDER_BACKUP'), 'Lettershopbestelling chocoladeletters CL26-0004') === 0, 'Online origin starts the subject.');
$store = array_merge($order, array('channel' => 'STORE', 'entered_store' => 'heyendaal'));
$store_html = strik_lettershop_mail_html($store);
check(has($store_html, 'Winkelbestelling') && has($store_html, 'background:#faf3df') && has($store_html, 'Aangenomen in:') && has($store_html, 'Heyendaalseweg 217') && has($store_html, 'Oranje Marieplein 11'), 'Store origin and collection locations remain distinct.');
check(!has($store_html, 'Lettershopbestelling'), 'Store mail is never labeled Lettershop.');
check(strpos(strik_lettershop_mail_subject($store, 'INTERNAL_ORDER_BACKUP'), 'Winkelbestelling chocoladeletters') === 0, 'Store subject starts with store origin.');
$old = array_merge($order, array('gift_wrap_price_cents' => 100, 'gift_wrap_total_cents' => 200, 'total_cents' => 2990));
check(has(strik_lettershop_mail_html($old), '1,00 per letter') && has(strik_lettershop_mail_html($old), '29,90'), 'HTML preserves historical saved amounts.');
echo "PASS green HTML, distinct channel labels, escaped details and immutable prices\n";

$request = array('id' => '11111111-1111-4111-8111-111111111111', 'template' => 'INTERNAL_ORDER_BACKUP', 'payload' => array_merge($order, array('customer_email' => '')));
$sent = strik_lettershop_send_mail(new MailRequest($request));
check($sent['sent'] && count($mail_calls) === 1 && $mail_calls[0]['to'] === 'info@strik-patisserie.nl', 'Internal backup sends without customer email.');
check(in_array('Content-Type: text/html; charset=UTF-8', $mail_calls[0]['headers'], true), 'Backup is sent as HTML.');
check(!preg_match('/\b(?:bcc|cc):/i', implode("\n", $mail_calls[0]['headers'])), 'No additional duplicate recipients.');
strik_lettershop_send_mail(new MailRequest($request));
check(count($mail_calls) === 1, 'Retry of a sent job sends no duplicate.');
$request['id'] = '22222222-2222-4222-8222-222222222222';
$mail_succeeds = false;
check(strik_lettershop_send_mail(new MailRequest($request)) instanceof WP_Error, 'Failed mail returns an error.');
$mail_succeeds = true;
strik_lettershop_send_mail(new MailRequest($request));
check(count($mail_calls) === 3, 'A failed job remains retryable.');
$request['id'] = '33333333-3333-4333-8333-333333333333'; $request['template'] = 'ONLINE_CONFIRMATION'; $request['payload'] = $order;
strik_lettershop_send_mail(new MailRequest($request));
check($mail_calls[3]['to'] === $order['customer_email'] && has($mail_calls[3]['body'], 'Uw chocoladeletters zijn besteld!') && !has($mail_calls[3]['body'], 'interne back-up') && !has($mail_calls[3]['body'], 'Zonder versiering'), 'Customer receives its own green confirmation without internal line notes.');
$request['id'] = '44444444-4444-4444-8444-444444444444'; $request['template'] = 'ORDER_CANCELLATION';
strik_lettershop_send_mail(new MailRequest($request));
check(in_array('Content-Type: text/plain; charset=UTF-8', $mail_calls[4]['headers'], true) && has($mail_calls[4]['body'], 'is geannuleerd'), 'Cancellation keeps its existing content and type.');
echo "PASS internal delivery without email, HTML headers, independent customer mail and safe retries\n";

if (getenv('STRIK_MAIL_PREVIEW_DIR')) {
    $dir = rtrim(getenv('STRIK_MAIL_PREVIEW_DIR'), '/');
    $preview = $order;
    $preview['notes'] = "Graag feestelijk inpakken.\nKlant haalt de bestelling in de middag op.";
    $preview['items'][0]['notes'] = 'Zonder versiering';
    file_put_contents($dir . '/lettershop-backup.html', strik_lettershop_mail_html($preview));
    file_put_contents($dir . '/winkel-backup-relay.html', strik_lettershop_mail_html(array_merge($preview, array('channel' => 'STORE', 'entered_store' => 'heyendaal'))));
}
