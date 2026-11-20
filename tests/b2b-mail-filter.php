<?php
// The shared fixtures capture every outgoing message; no real mail is sent.
require __DIR__ . '/b2b-confirmation.php';
$options = array(); reset_mails();
foreach (array('sint', 'kerst', 'sint-kerst') as $season) {
    $saved = b2b_save(array_merge(final_fixture('filter-' . $season, $season), array('status' => 'akkoord')));
    $saved = mail_final($saved);
    $customer_version = $saved['confirmationMail']['version'];
    $backup_version = $saved['confirmationMail']['backupVersion'];
    $receipt = $saved['confirmationMail']['backup'];
    // Emulate the last production comparison, which still included private notes.
    $saved['confirmationMail']['contentSchema'] = 3;
    $saved['confirmationMail']['backupContentHash'] = 'schema-3-with-internal-notes';
    $saved['confirmationMail']['lastBackupSnapshot']['importantNotes'] = 'Oude interne notitie';
    $options[STRIK_SINTERKLAAS_B2B_OPTION_NAME][strik_sinterklaas_order_key($saved['id'])] = $saved;
    reset_mails();
    foreach (array('Nieuwe interne notitie', '', "Team heeft gebeld\nVolgende week controleren") as $note) {
        $saved = b2b_save(array('id' => $saved['id'], 'importantNotes' => $note));
        check(count($mail_calls) === 0, 'A note-only edit stays silent for ' . $season);
        check($saved['importantNotes'] === $note && $options[STRIK_SINTERKLAAS_B2B_OPTION_NAME][strik_sinterklaas_order_key($saved['id'])]['importantNotes'] === $note, 'Internal notes are still durably saved.');
        check($saved['confirmationMail']['version'] === $customer_version && $saved['confirmationMail']['backupVersion'] === $backup_version && $saved['confirmationMail']['backup'] === $receipt, 'Upgrade and note edits preserve both sent versions and their receipt.');
    }
    mail_final($saved);
    b2b_save(array('id' => $saved['id'], 'resendConfirmation' => true));
    check(count($mail_calls) === 0, 'Already sent receipts remain deduplicated after note-only changes.');
    foreach (array('deliveryDate' => '2026-12-19', 'packaging' => 'Elk product in cadeaupapier', 'orderText' => "PRODUCTEN EN PRIJS\n30 × Kerststol · 800 gram · € 13,90 p.s. ex btw · € 417,00", 'deliveryMethod' => 'Afhalen · Lent', 'deliveryAddress' => 'Nieuw bezorgadres 2', 'totalExVat' => '417.00', 'logo' => 'Logo op alle producten', 'textInstructions' => 'Fijne feestdagen', 'invoiceInfo' => 'Inkoopnummer 123') as $field => $value) {
        reset_mails();
        $saved = b2b_save(array('id' => $saved['id'], $field => $value));
        check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'Relevant change still sends exactly one internal update: ' . $field);
        check(has($mail_calls[0]['body'], 'Team heeft gebeld') && !has($mail_calls[0]['body'], 'Interne orderafspraken'), 'Full backup includes current notes without claiming notes changed the order.');
    }
    reset_mails(array(false));
    $saved = b2b_save(array('id' => $saved['id'], 'packaging' => 'Nieuwe geschenkdoos'));
    check($saved['confirmationMail']['backup']['state'] === 'failed', 'A relevant failed message remains retryable.');
    reset_mails();
    $saved = b2b_save(array('id' => $saved['id'], 'importantNotes' => 'Intern opgevolgd'));
    check(count($mail_calls) === 0 && $saved['confirmationMail']['backup']['state'] === 'failed', 'Note changes do not retry a failed order mail.');
    b2b_save(array('id' => $saved['id'], 'resendConfirmation' => true));
    check(count($mail_calls) === 1 && has($mail_calls[0]['body'], 'Intern opgevolgd'), 'An explicit retry uses the latest saved internal notes.');
}
echo "PASS silent note edits, schema-3 migration, preserved receipts, relevant changes and retries across all seasons\n";
