<?php
// Pure WordPress fixtures: wp_mail is intercepted, no real recipients or mail.
require __DIR__ . '/sinterklaas-mail.php';
class WP_Error {
    public $code; public $message; public $data;
    function __construct($code, $message, $data = array()) { $this->code = $code; $this->message = $message; $this->data = $data; }
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function esc_url_raw($value) { return filter_var($value, FILTER_VALIDATE_URL) ? $value : ''; }
function esc_url($value) { return esc_attr(esc_url_raw($value)); }
class MailingRequest {
    private $selection; private $input;
    function __construct($selection, $input = array()) { $this->selection = $selection; $this->input = $input; }
    function get_param($key) { return $key === 'season' ? $this->selection : ($key === 'year' ? '2026' : null); }
    function get_json_params() { return $this->input; }
}
function mailing_get($selection) { return strik_sinterklaas_mailing_get(new MailingRequest($selection)); }
function mailing_save($selection, $value) { return strik_sinterklaas_mailing_save(new MailingRequest($selection, $value)); }
function mailing_send($selection, $campaign, $kind = 'folder', $request_id = 'request-1', $recipient_id = 'r1') {
    return strik_sinterklaas_mailing_send(new MailingRequest($selection, array('campaign' => $campaign, 'kind' => $kind, 'customerId' => 'c1', 'recipientId' => $recipient_id, 'requestId' => $request_id, 'includePreviouslySent' => true)));
}
function campaign_fixture() {
    return array('year' => '2026', 'selection' => 'sint', 'subject' => 'Sint subject', 'body' => 'Beste {{contactpersoon}}, leuk!', 'reminder1Subject' => 'R1', 'reminder1Body' => 'Reminder 1', 'reminder2Subject' => 'R2', 'reminder2Body' => 'Reminder 2', 'folderUrl' => 'https://app.example.invalid/sint-voor-bedrijven', 'kerstFolderUrl' => 'https://app.example.invalid/kerst-voor-bedrijven', 'customers' => array(array('id' => 'c1', 'company' => 'Voorbeeld BV', 'notes' => 'Notities', 'ordered' => false, 'orderedAt' => '', 'recipients' => array(array('id' => 'r1', 'contactName' => 'Sanne <script>', 'email' => 'sanne@example.invalid', 'doNotEmail' => false, 'interests' => array('sint', 'kerst'), 'consentAt' => '', 'consentSource' => '', 'sent' => array(array('kind' => 'folder', 'sentAt' => '2026-10-01')))))));
}
$options = array(STRIK_SINTERKLAAS_MAILING_OPTION_NAME => array('2026' => campaign_fixture()));
reset_mails();
$sint = mailing_get('sint'); $kerst = mailing_get('kerst');
check($sint['customers'][0]['recipients'][0]['sent'][0]['sentAt'] === '2026-10-01', 'Old Sint send history is preserved.');
check(count($kerst['customers']) === 1 && count($kerst['customers'][0]['recipients'][0]['sent']) === 0, 'Kerst starts with the exact same contacts and separate history.');
$sint = mailing_save('sint', $sint);
check(!is_wp_error($sint) && $sint['contactsRevision'] === 1, 'Shared contacts initialise without sending.');
$kerst = array_merge(campaign_fixture(), mailing_get('kerst'), array('subject' => 'Kerst subject', 'folderUrl' => 'https://app.example.invalid/kerst-voor-bedrijven'));
$kerst = mailing_save('kerst', $kerst);
check(!is_wp_error($kerst) && mailing_get('sint')['subject'] === 'Sint subject', 'Saving Christmas templates does not overwrite Sint.');
check(count($mail_calls) === 0, 'Viewing and saving never sends newsletters.');
echo "PASS shared contacts with separate Sint and Christmas templates and historical sends\n";
$stale_sint = mailing_get('sint');
$kerst['customers'][0]['recipients'][0]['doNotEmail'] = true;
$kerst = mailing_save('kerst', $kerst);
check(mailing_get('sint')['customers'][0]['recipients'][0]['doNotEmail'] === true, 'An unsubscribe in Kerst applies to Sint.');
$blocked = mailing_send('sint', $stale_sint);
check(is_wp_error($blocked) && $blocked->data['status'] === 409 && count($mail_calls) === 0, 'A stale tab cannot overwrite a new unsubscribe or send to it.');
$blocked = mailing_send('kerst', $kerst);
check(is_wp_error($blocked) && count($mail_calls) === 0, 'The backend enforces global do-not-email.');
$sint = mailing_get('sint'); $sint['customers'][0]['recipients'][0]['doNotEmail'] = false;
$sint = mailing_save('sint', $sint);
check(!is_wp_error($sint), 'An explicit change from a current shared list can update preferences.');
echo "PASS unsubscribe propagation and stale-tab protection\n";
$kerst = mailing_get('kerst');
$sent = mailing_send('kerst', $kerst, 'folder', 'kerst-first');
check(!is_wp_error($sent) && count($mail_calls) === 1, 'A previous Sint mail does not prevent a Christmas mail.');
check(has($mail_calls[0]['body'], 'Bekijk de Kerstfolder') && !has($mail_calls[0]['body'], 'Bekijk de Sintfolder'), 'Christmas sends only its requested folder.');
check(!has($mail_calls[0]['body'], '<script>') && has($mail_calls[0]['body'], 'Beste Sanne'), 'The personal salutation is escaped.');
mailing_send('kerst', $sent, 'folder', 'kerst-first');
check(count($mail_calls) === 1, 'An identical send request cannot deliver twice.');
check(count(mailing_get('sint')['customers'][0]['recipients'][0]['sent']) === 1, 'Christmas history does not contaminate Sint history.');
$both = array_merge(campaign_fixture(), mailing_get('sint-kerst'));
$both = mailing_save('sint-kerst', $both);
$both = mailing_send('sint-kerst', $both, 'folder', 'both-first');
check(!is_wp_error($both) && count($mail_calls) === 2 && has($mail_calls[1]['body'], 'Bekijk de Sintfolder') && has($mail_calls[1]['body'], 'Bekijk de Kerstfolder'), 'Both folders arrive as two working buttons in one personal mail.');
check(has($mail_calls[1]['body'], '/sint-voor-bedrijven') && has($mail_calls[1]['body'], '/kerst-voor-bedrijven'), 'Each button has its own folder destination.');
echo "PASS individual seasonal mails, two-folder mail, escaped content and retry deduplication\n";
$blocked = mailing_send('kerst', mailing_get('kerst'), 'reminder2', 'out-of-order');
check(is_wp_error($blocked) && $blocked->code === 'missing_previous_mail', 'Reminder two needs reminder one first.');
$kerst = mailing_get('kerst'); $kerst['customers'][0]['ordered'] = true;
$kerst = mailing_save('kerst', $kerst);
check(empty(mailing_get('sint')['customers'][0]['ordered']) && empty(mailing_get('sint-kerst')['customers'][0]['ordered']), 'Ordered flags stay scoped to the campaign.');
check(is_wp_error(mailing_send('kerst', $kerst, 'reminder1', 'ordered')), 'Ordered customers are skipped on the server.');
$both = mailing_get('sint-kerst'); $both['customers'][0]['recipients'][0]['interests'] = array('sint');
$both = mailing_save('sint-kerst', $both);
$before = count($mail_calls);
check(is_wp_error(mailing_send('sint-kerst', $both, 'folder', 'not-consented')) && count($mail_calls) === $before, 'A Sint-only subscription cannot be used for a two-folder mail.');
echo "PASS seasonal ordered flags, reminder order and contact interests\n";
echo "All business mailing tests passed; no real emails sent.\n";
