<?php
// Uses the shared in-memory WordPress fixtures; no real orders or emails.
require __DIR__ . '/b2b-confirmation.php';
$options = array(); $fail_option_key = ''; reset_mails();

$product = 'Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter · letter S · chocolade melk';
$text = "PRODUCTEN EN PRIJS\n40 × " . $product . " · € 12,16 p.s. ex btw · € 486,40\n1 × Bezorgkosten · handmatig · € 4,59 p.s. ex btw · € 4,59";
$input = array_merge(final_fixture('package-save'), array('department' => 'beide', 'letterLines' => array(), 'orderText' => $text, 'deliveryDate' => '2026-12-01', 'deliveryWindowType' => 'date', 'totalExVat' => '490.99'));
$draft = b2b_save($input);
check(!is_wp_error($draft) && count($mail_calls) === 0, 'The package inquiry is saved without sending a final confirmation.');
$final = b2b_save(array('id' => $draft['id'], 'status' => 'akkoord'));
check(!is_wp_error($final), 'A valid speculaas package can become definitive without separately sold letters.');
check($final['department'] === 'beide' && $final['orderText'] === $text && count($final['letterLines']) === 0 && $final['totalExVat'] === '490.99', 'Preserve both departments, package price and contents without duplicating letter rows.');
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'Finalization sends only the normal internal backup.');
b2b_save(array('id' => $draft['id'], 'status' => 'akkoord'));
check(count($mail_calls) === 1, 'Retrying the same save does not duplicate the backup.');
check(strik_sinterklaas_b2b_has_package_letters($text . "\n5 × Amandelletter & gevulde staven · Amandelletter · standaard S / andere letter op aanvraag · € 10,00 p.s. ex btw · € 50,00\n2 × Marsepein letter · 500 gram · € 10,00 p.s. ex btw · € 20,00"), 'Pastry and marzipan letters do not require chocolate production details.');

foreach (array(
    'Speculaasbrok met letter · Speculaasbrok met amandel · grote spuitletter · letter M · chocolade wit · eigen logo',
    'Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter · chocolade puur',
    'Klein Sintpakket · zonder amandel · letter A · chocolade melk',
) as $description) {
    check(strik_sinterklaas_b2b_has_package_letters("PRODUCTEN EN PRIJS\n12 × " . $description . ' · € 12,00 p.s. ex btw · € 144,00'), 'Support every known complete package variant, including legacy default S.');
}
foreach (array(
    str_replace(' · chocolade melk', '', $text),
    str_replace('kleine spuitletter', 'onbekende letter', $text),
    "PRODUCTEN EN PRIJS\n12 × Klein Sintpakket · zonder amandel · chocolade melk",
    str_replace('40 ×', '0 ×', $text),
    str_replace('40 ×', '10001 ×', $text),
    $text . "\n4 × Chocolade spuitletters · Groot · € 12,00 p.s. ex btw · € 48,00",
    "PRODUCTEN EN PRIJS\nAndere producten\nOVERIGE ORDERAFSPRAKEN\n40 × " . $product,
) as $index => $invalid_text) {
    $invalid = b2b_save(array_merge($input, array('id' => 'invalid-package-' . $index, 'status' => 'akkoord', 'orderText' => $invalid_text)));
    check(is_wp_error($invalid) && has($invalid->message, 'letter en chocoladesmaak'), 'Reject missing, unknown or invalid letter details and do not accept notes as products.');
}
foreach (array('customerName' => '', 'deliveryDate' => '', 'orderText' => '', 'letterLines' => array(array('letter' => 'XX'))) as $field => $value) {
    $invalid = b2b_save(array_merge($input, array('id' => 'missing-' . $field, 'status' => 'akkoord', $field => $value)));
    check(is_wp_error($invalid), 'Reject invalid ' . $field);
    $expected = array('customerName' => 'klantnaam', 'deliveryDate' => 'leverdatum', 'orderText' => 'producten', 'letterLines' => 'chocoladeletterregels');
    check(stripos($invalid->message, $expected[$field]) !== false && !has($invalid->message, 'Controleer klantnaam, bestelling, leverdatum'), 'Identify the actual invalid field instead of the old catch-all error.');
}
check(count($mail_calls) === 1, 'Rejected inputs never save or send mail.');
echo "PASS package finalization, preserved production semantics, strict missing-letter checks and specific validation messages\n";
