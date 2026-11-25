<?php
// Run against the WordPress fixtures: mail stays local and no real orders change.
require __DIR__ . '/b2b-confirmation.php';
$options = array(); reset_mails();
foreach (array('sint', 'kerst', 'sint-kerst') as $season) {
    $saved = b2b_save(array_merge(final_fixture('payment-' . $season, $season), array('status' => 'akkoord')));
    check($saved['paidInStore'] === false, 'New orders default to invoice.');
    $saved = mail_final($saved);
    $versions = $saved['confirmationMail'];
    reset_mails();
    foreach (array(true, false, true) as $paid) {
        $saved = b2b_save(array('id' => $saved['id'], 'paidInStore' => $paid));
        check($saved['paidInStore'] === $paid, 'Payment selection is returned.');
        $stored = get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME)[strik_sinterklaas_order_key($saved['id'])];
        check($stored['paidInStore'] === $paid, 'Payment selection is durably stored.');
        check($saved['confirmationMail'] === $versions, 'Payment selection leaves sent versions and receipts intact.');
        check(count($mail_calls) === 0, 'Payment changes never send an updated order.');
        $saved = b2b_save(array('id' => $saved['id'], 'entered' => true, 'importantNotes' => 'Intern gecontroleerd'));
        check($saved['paidInStore'] === $paid, 'Unrelated patches preserve the payment selection.');
    }
    foreach (array('false', 'true', 1, array()) as $invalid) {
        check(is_wp_error(b2b_save(array('id' => $saved['id'], 'paidInStore' => $invalid))), 'Malformed payment values are rejected.');
    }
    check(count($mail_calls) === 0, 'No mail from payment or internal changes.');
    // A legacy order has no field yet, but edits must give it the invoice default.
    unset($options[STRIK_SINTERKLAAS_B2B_OPTION_NAME][strik_sinterklaas_order_key($saved['id'])]['paidInStore']);
    $saved = b2b_save(array('id' => $saved['id'], 'entered' => false));
    check($saved['paidInStore'] === false, 'Existing orders without a selection default to invoice.');
}
echo "PASS payment defaults, both directions, durable persistence, legacy orders, unrelated edits and silent mail\n";
