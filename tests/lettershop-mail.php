<?php
// Local template checks: no wp_mail call and no real messages.
function add_action($name, $callback) {}
function sanitize_text_field($value) { return trim(strip_tags((string) $value)); }
function sanitize_email($value) { return (string) $value; }
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
