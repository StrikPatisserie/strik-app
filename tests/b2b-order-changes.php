<?php
// The shared WordPress fixtures intercept every wp_mail call; no real mail.
require __DIR__ . '/b2b-confirmation.php';
$options = array(); $fail_option_key = ''; reset_mails();

$letters = array(
    array('id' => 'a', 'letter' => 'A', 'chocolate' => 'melk', 'style' => 'spuit', 'size' => 'groot', 'quantity' => 3, 'exceptions' => array('vegan', 'notenvrij')),
    array('id' => 'b', 'letter' => 'B', 'chocolate' => 'puur', 'style' => 'spuit', 'size' => 'groot', 'quantity' => 2, 'exceptions' => array()),
);
$legacy = b2b_save(array_merge(final_fixture('legacy-flags'), array('status' => 'akkoord', 'department' => 'chocolade', 'totalExVat' => '61.00', 'letterLines' => $letters, 'orderText' => "PRODUCTEN EN PRIJS\n5 × Chocolade spuitletters · Groot · € 12,20 p.s. ex btw · € 61,00")));
$legacy = mail_final($legacy);
$old_customer_version = $legacy['confirmationMail']['version'];
$old_backup_version = $legacy['confirmationMail']['backupVersion'];
// Reproduce orders written before per-line logo flags and canonical comparison.
foreach ($legacy['letterLines'] as &$line) unset($line['withLogo']);
unset($line, $legacy['confirmationMail']['contentSchema'], $legacy['confirmationMail']['lastBackupSnapshot']);
$legacy['confirmationMail']['contentHash'] = 'old-comparison-format';
$legacy['confirmationMail']['backupContentHash'] = 'old-backup-comparison-format';
$stored = get_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
$stored[strik_sinterklaas_order_key($legacy['id'])] = $legacy;
update_option(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $stored);
reset_mails();
foreach (array('entered' => true, 'productionScheduled' => true, 'productionDate' => '2026-12-16', 'department' => 'beide', 'productionDone' => true, 'letterProductionDone' => true, 'packed' => true, 'delivered' => true, 'logoChecked' => true, 'textChecked' => true, 'packagingChecked' => true) as $field => $value) {
    $unchanged = b2b_save(array('id' => $legacy['id'], $field => $value));
    check(!is_wp_error($unchanged) && count($mail_calls) === 0, 'Only changing ' . $field . ' never sends a revised-order mail.');
    check($unchanged['confirmationMail']['version'] === $old_customer_version && $unchanged['confirmationMail']['backupVersion'] === $old_backup_version, 'Progress and comparison upgrades preserve sent mail versions.');
}
mail_final($unchanged);
check(count($mail_calls) === 0, 'A comparison upgrade cannot resend an already confirmed customer version.');
echo "PASS legacy missing logo flags, administrative checkboxes and planning never send order-change mail\n";

$cosmetic_lines = array_reverse($unchanged['letterLines']);
foreach ($cosmetic_lines as &$line) { $line['id'] .= '-new'; $line['withLogo'] = false; $line['exceptions'] = array_reverse($line['exceptions']); }
unset($line);
$cosmetic = b2b_save(array('id' => $legacy['id'], 'letterLines' => $cosmetic_lines, 'totalExVat' => '€ 61,00', 'orderText' => str_replace("\n", "\r\n", $unchanged['orderText'])));
check(count($mail_calls) === 0 && $cosmetic['confirmationMail']['version'] === $old_customer_version, 'Row IDs/order, exception order, explicit false logos, line endings and currency formatting are not order changes.');
$split = array($cosmetic_lines[0], array_merge($cosmetic_lines[1], array('id' => 'split-a1', 'quantity' => 1)), array_merge($cosmetic_lines[1], array('id' => 'split-a2', 'quantity' => 2)));
$cosmetic = b2b_save(array('id' => $legacy['id'], 'letterLines' => $split));
check(count($mail_calls) === 0 && $cosmetic['confirmationMail']['backupVersion'] === $old_backup_version, 'Splitting identical rows does not change the actual order or its mail version.');
echo "PASS harmless normalization, regrouping and formatting remain silent\n";

$new_letters = array(array_merge($letters[0], array('quantity' => 4, 'withLogo' => true, 'exceptions' => array('vegan'))), $letters[1]);
$changed = b2b_save(array('id' => $legacy['id'], 'letterLines' => $new_letters, 'totalExVat' => '74.00', 'deliveryDateEnd' => '2026-12-21', 'deliveryMethod' => 'Afhalen Lent', 'deliveryAddress' => ''));
check(count($mail_calls) === 1 && $mail_calls[0]['to'] === STRIK_SINTERKLAAS_RECIPIENT, 'Actual quantity/logo/special requirement, delivery and price edits send one internal mail only.');
$body = $mail_calls[0]['body'];
$red = substr($body, strpos($body, '>Dit is gewijzigd<'));
$red = substr($red, 0, strpos($red, '<strong>Levering ·'));
foreach (array('Was', 'Wordt', 'color:#a32f29', 'Chocoladeletters', '3× Spuitletter A', '4× Spuitletter A', 'zonder logo', 'eigen logo', 'notenvrij', 'Levermoment', 'Levering / afhalen', 'Bezorgadres', 'Totaal excl. btw', '€ 61,00', '€ 74,00', 'Verwijderd / niet meer besteld') as $part) check(has($red, $part), 'The red change summary includes ' . $part);
check(!has($red, 'Spuitletter B'), 'Unchanged letter rows do not clutter the change summary.');
$preview = preview_final($changed['id']);
check(!has($preview['html'], 'Dit is gewijzigd') && !has($preview['html'], 'Interne orderafspraken'), 'The internal change summary never leaks into customer confirmation.');
$version = $changed['confirmationMail']['version'];
$changed = b2b_save(array('id' => $changed['id'], 'entered' => false));
check(count($mail_calls) === 1 && $changed['confirmationMail']['version'] === $version, 'A progress flag after a real edit does not repeat its notification.');
echo "PASS one red before/after summary shows only the actual order changes\n";

reset_mails(array(false));
$failed = b2b_save(array('id' => $changed['id'], 'totalExVat' => '85.00'));
reset_mails(array(false));
$failed = b2b_save(array('id' => $changed['id'], 'totalExVat' => '90.00', 'importantNotes' => 'Nieuwe afspraak & extra uitleg'));
reset_mails();
$failed = b2b_save(array('id' => $failed['id'], 'entered' => true));
check(count($mail_calls) === 0, 'Administrative changes do not automatically retry failed mail.');
$retried = b2b_save(array('id' => $failed['id'], 'resendConfirmation' => true));
check(count($mail_calls) === 1 && has($mail_calls[0]['body'], '€ 74,00') && has($mail_calls[0]['body'], '€ 90,00') && !has($mail_calls[0]['body'], '€ 85,00'), 'Retry keeps the changes relative to the last successfully mailed order.');
check(has($mail_calls[0]['body'], 'Nieuwe afspraak &amp; extra uitleg'), 'Order text remains escaped in both the summary and complete order.');
$unsafe_preview = $retried;
$unsafe_preview['confirmationMail']['backupChanges'][0]['before'] = '<script>before</script>';
$unsafe_preview['confirmationMail']['backupChanges'][0]['after'] = '<img src=x onerror=alert(1)>';
$safe_html = strik_business_b2b_confirmation_html($unsafe_preview, true, true);
check(has($safe_html, '&lt;script&gt;before') && has($safe_html, '&lt;img') && !has($safe_html, '<img src=x') && !has($safe_html, '<script>'), 'The change renderer escapes both previous and new values.');
b2b_save(array('id' => $retried['id'], 'resendConfirmation' => true));
check(count($mail_calls) === 1, 'A successful revised-order retry remains deduplicated.');
echo "PASS failed-mail recovery retains the last mailed comparison and escapes text\n";

reset_mails();
$christmas = b2b_save(array_merge(final_fixture('kerst-changes', 'kerst'), array('status' => 'akkoord')));
reset_mails();
$christmas = b2b_save(array('id' => $christmas['id'], 'entered' => true));
check(count($mail_calls) === 0, 'Christmas administrative updates stay silent too.');
$christmas = b2b_save(array('id' => $christmas['id'], 'orderText' => "PRODUCTEN EN PRIJS\n30 × Kerststol · 800 gram · € 13,90 p.s. ex btw · € 417,00", 'totalExVat' => '417.00'));
check(count($mail_calls) === 1 && has($mail_calls[0]['body'], 'Dit is gewijzigd') && has($mail_calls[0]['body'], '25 × Kerststol') && has($mail_calls[0]['body'], '30 × Kerststol'), 'Christmas product edits use the same before/after summary.');

if (getenv('STRIK_MAIL_PREVIEW_DIR')) {
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR') . '/wijziging-sint.html', $body);
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR') . '/wijziging-kerst.html', $mail_calls[0]['body']);
}
echo "All B2B order-change tests passed; no real emails sent.\n";
