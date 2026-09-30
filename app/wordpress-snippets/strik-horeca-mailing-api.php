<?php
/**
 * Strik horecamailing API.
 *
 * Activeer dit bestand als losse WordPress Code Snippet. De Team app gebruikt
 * een WordPress Application Password; er staat dus geen mailsleutel in de browser.
 */

if (!defined('STRIK_HORECA_MAILING_OPTION')) {
    define('STRIK_HORECA_MAILING_OPTION', 'strik_horeca_mailing_v1');
}

if (!function_exists('strik_horeca_mailing_permission')) {
function strik_horeca_mailing_permission() {
    return current_user_can('manage_options')
        ? true
        : new WP_Error('strik_horeca_forbidden', 'Geen toegang tot de horecamailing.', array('status' => 403));
}
}

if (!function_exists('strik_horeca_mailing_defaults')) {
function strik_horeca_mailing_defaults() {
    return array(
        'customers' => array(
            array('id' => 'dries-en-co', 'company' => 'Dries en Co', 'emails' => array('info@driesenco.nl', 'lisette@driesenco.nl')),
            array('id' => 'jachtslot', 'company' => 'Jachtslot', 'emails' => array('Restaurant@jachtslot.com')),
            array('id' => 'sanadome', 'company' => 'Sanadome', 'emails' => array('Sebastiaan.Ruys@sanadome.nl', 'Jacco.Beck@sanadome.nl')),
            array('id' => 'restaurant-steven', 'company' => 'Restaurant Steven', 'emails' => array('info@stevennijmegen.nl', 'roel@gezelligezakennijmegen.nl')),
            array('id' => 'hotel-credible', 'company' => 'Hotel Credible', 'emails' => array('zeno@in-credible.nl')),
            array('id' => 'radboud-universiteit', 'company' => 'Radboud Universiteit', 'emails' => array('martijn.gesthuizen@ru.nl', 'supportfb-cf@ru.nl')),
            array('id' => 'sint-maartenskliniek', 'company' => 'Sint Maartenskliniek', 'emails' => array('catering@maartenskliniek.nl', 'T.Lamers@maartenskliniek.nl')),
            array('id' => 'radboud-vermaat', 'company' => 'Radboud Vermaat', 'emails' => array('radboud-vergaderservice@vermaatgroep.nl')),
            array('id' => 'restaurant-blue-by-manna', 'company' => 'Restaurant BLUE by Manna', 'emails' => array('info@manna-nijmegen.nl', 'jay@manna-nijmegen.nl')),
            array('id' => 'bakkerij-koenen', 'company' => 'Bakkerij Koenen', 'emails' => array('nijmegen@bakkerijkoenen.nl')),
        ),
        'draft' => null,
        'lastSent' => array(),
        'updatedAt' => '',
    );
}
}

if (!function_exists('strik_horeca_mailing_text')) {
function strik_horeca_mailing_text($value, $max = 240) {
    $value = trim((string) $value);
    if (strlen($value) > $max) $value = substr($value, 0, $max);
    return sanitize_text_field($value);
}

function strik_horeca_mailing_textarea($value, $max = 12000) {
    $value = trim((string) $value);
    if (strlen($value) > $max) $value = substr($value, 0, $max);
    return sanitize_textarea_field($value);
}

function strik_horeca_mailing_id($value, $fallback) {
    $id = sanitize_key((string) $value);
    return $id !== '' ? $id : sanitize_key($fallback . '-' . wp_generate_uuid4());
}
}

if (!function_exists('strik_horeca_mailing_clean_customers')) {
function strik_horeca_mailing_clean_customers($input) {
    $customers = array();
    foreach (array_slice(is_array($input) ? $input : array(), 0, 100) as $index => $customer) {
        if (!is_array($customer)) continue;
        $company = strik_horeca_mailing_text(isset($customer['company']) ? $customer['company'] : '', 180);
        if ($company === '') continue;
        $emails = array();
        foreach (array_slice(isset($customer['emails']) && is_array($customer['emails']) ? $customer['emails'] : array(), 0, 20) as $raw_email) {
            $email = sanitize_email((string) $raw_email);
            if ($email !== '' && is_email($email) && !in_array(strtolower($email), array_map('strtolower', $emails), true)) $emails[] = $email;
        }
        if (!$emails) continue;
        $customers[] = array(
            'id' => strik_horeca_mailing_id(isset($customer['id']) ? $customer['id'] : '', 'horeca-' . $index),
            'company' => $company,
            'emails' => $emails,
        );
    }
    return $customers;
}
}

if (!function_exists('strik_horeca_mailing_store_photo')) {
function strik_horeca_mailing_store_photo($data_url, $name) {
    $data_url = (string) $data_url;
    if ($data_url === '') return '';
    if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,(.+)$#s', $data_url, $matches)) {
        return new WP_Error('invalid_photo', 'Kies een geldige JPG-, PNG- of WEBP-afbeelding.', array('status' => 400));
    }
    $bytes = base64_decode($matches[2], true);
    if ($bytes === false || strlen($bytes) > 3000000) {
        return new WP_Error('photo_too_large', 'De gekozen afbeelding is groter dan 3 MB.', array('status' => 400));
    }
    $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
    $basename = sanitize_file_name(pathinfo((string) $name, PATHINFO_FILENAME));
    if ($basename === '') $basename = 'horeca-mailing';
    $upload = wp_upload_bits($basename . '-' . gmdate('Ymd-His') . '.' . $extension, null, $bytes);
    if (!empty($upload['error'])) return new WP_Error('photo_upload_failed', 'Afbeelding opslaan is mislukt.', array('status' => 502));
    return esc_url_raw($upload['url']);
}
}

if (!function_exists('strik_horeca_mailing_clean_draft')) {
function strik_horeca_mailing_clean_draft($input, $existing = array()) {
    if (!is_array($input)) return null;
    $template = isset($input['template']) ? sanitize_key($input['template']) : 'hours';
    if (!in_array($template, array('hours', 'product', 'cheesecake'), true)) $template = 'hours';
    $occasion = isset($input['occasion']) ? sanitize_key($input['occasion']) : 'other';
    if (!in_array($occasion, array('christmas', 'sinterklaas', 'easter', 'kingsday', 'ascension', 'pentecost', 'vierdaagse', 'other'), true)) $occasion = 'other';
    $content = isset($input['content']) && is_array($input['content']) ? $input['content'] : array();
    $photo_url = isset($input['photoUrl']) ? esc_url_raw($input['photoUrl']) : '';
    if (empty($input['removePhoto']) && $photo_url === '' && isset($existing['photoUrl'])) $photo_url = esc_url_raw($existing['photoUrl']);
    if (!empty($input['photoData'])) {
        $uploaded = strik_horeca_mailing_store_photo($input['photoData'], isset($input['photoName']) ? $input['photoName'] : 'horeca-mailing');
        if (is_wp_error($uploaded)) return $uploaded;
        $photo_url = $uploaded;
    }
    return array(
        'template' => $template,
        'occasion' => $occasion,
        'content' => array(
            'subject' => strik_horeca_mailing_text(isset($content['subject']) ? $content['subject'] : '', 240),
            'eyebrow' => strik_horeca_mailing_text(isset($content['eyebrow']) ? $content['eyebrow'] : '', 180),
            'title' => strik_horeca_mailing_text(isset($content['title']) ? $content['title'] : '', 240),
            'body' => strik_horeca_mailing_textarea(isset($content['body']) ? $content['body'] : '', 12000),
            'price' => strik_horeca_mailing_text(isset($content['price']) ? $content['price'] : '', 40),
            'buttonLabel' => strik_horeca_mailing_text(isset($content['buttonLabel']) ? $content['buttonLabel'] : '', 100),
            'buttonUrl' => esc_url_raw(isset($content['buttonUrl']) ? $content['buttonUrl'] : ''),
        ),
        'photoUrl' => $photo_url,
    );
}
}

if (!function_exists('strik_horeca_mailing_get_data')) {
function strik_horeca_mailing_get_data() {
    $stored = get_option(STRIK_HORECA_MAILING_OPTION, array());
    if (!is_array($stored) || empty($stored['customers'])) return strik_horeca_mailing_defaults();
    return $stored;
}

function strik_horeca_mailing_get() {
    return rest_ensure_response(strik_horeca_mailing_get_data());
}
}

if (!function_exists('strik_horeca_mailing_save')) {
function strik_horeca_mailing_save($request) {
    $input = $request->get_json_params();
    if (!is_array($input)) return new WP_Error('invalid_mailing', 'Ongeldige mailing.', array('status' => 400));
    $existing = strik_horeca_mailing_get_data();
    $customers = strik_horeca_mailing_clean_customers(isset($input['customers']) ? $input['customers'] : array());
    if (!$customers) return new WP_Error('missing_customers', 'Voeg minimaal één horecaklant toe.', array('status' => 400));
    $draft = strik_horeca_mailing_clean_draft(isset($input['draft']) ? $input['draft'] : array(), isset($existing['draft']) && is_array($existing['draft']) ? $existing['draft'] : array());
    if (is_wp_error($draft)) return $draft;
    if (!is_array($draft) || $draft['content']['subject'] === '' || $draft['content']['body'] === '') {
        return new WP_Error('missing_content', 'Vul een onderwerp en mailtekst in.', array('status' => 400));
    }
    if ($draft['template'] !== 'hours' && $draft['content']['price'] === '') {
        return new WP_Error('missing_price', 'Vul eerst de prijs in.', array('status' => 400));
    }
    $data = array(
        'customers' => $customers,
        'draft' => $draft,
        'lastSent' => isset($existing['lastSent']) && is_array($existing['lastSent']) ? array_slice($existing['lastSent'], -200) : array(),
        'updatedAt' => wp_date(DATE_ATOM),
    );
    update_option(STRIK_HORECA_MAILING_OPTION, $data, false);
    return rest_ensure_response($data);
}
}

if (!function_exists('strik_horeca_mailing_paragraphs')) {
function strik_horeca_mailing_paragraphs($body) {
    $html = '';
    foreach (preg_split('/\r?\n\s*\r?\n/', trim((string) $body)) as $part) {
        $part = trim((string) $part);
        if ($part === '') continue;
        $html .= '<p style="margin:0 0 15px;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#544b43;">' . nl2br(esc_html($part), false) . '</p>';
    }
    return $html;
}
}

if (!function_exists('strik_horeca_mailing_palette')) {
function strik_horeca_mailing_palette($template, $occasion) {
    $palettes = array(
        'product' => array('#d95745', '#f8dfd8'),
        'cheesecake' => array('#8f6f82', '#eee2e8'),
        'christmas' => array('#315c46', '#dfead9'),
        'sinterklaas' => array('#b54232', '#f8e1c1'),
        'easter' => array('#9a7614', '#fbefb9'),
        'kingsday' => array('#cf6428', '#fae3d1'),
        'ascension' => array('#587389', '#e1ebef'),
        'pentecost' => array('#667e5a', '#e5eddf'),
        'vierdaagse' => array('#a25369', '#f1dfe5'),
        'other' => array('#665d55', '#ece8e2'),
    );
    if ($template === 'product' || $template === 'cheesecake') return $palettes[$template];
    return isset($palettes[$occasion]) ? $palettes[$occasion] : $palettes['other'];
}
}

if (!function_exists('strik_horeca_mailing_html')) {
function strik_horeca_mailing_html($draft, $company) {
    $content = $draft['content'];
    $body = str_replace('{{bedrijfsnaam}}', $company, $content['body']);
    $palette = strik_horeca_mailing_palette($draft['template'], $draft['occasion']);
    $accent = $palette[0];
    $soft = $palette[1];
    $photo = !empty($draft['photoUrl'])
        ? '<img src="' . esc_url($draft['photoUrl']) . '" width="640" alt="" style="display:block;width:100%;max-height:180px;object-fit:cover;border:0;">'
        : '';
    $price = '';
    if ($draft['template'] !== 'hours') {
        $price_label = $draft['template'] === 'product' ? 'Winkelprijs incl. btw' : 'Aanbiedingsprijs excl. btw';
        $price_note = $draft['template'] === 'product'
            ? 'Jullie eigen horeca-prijsafspraken blijven van toepassing.'
            : 'Deze aanbiedingsprijs geldt voor al onze horecaklanten.';
        $price = '<tr><td style="padding:0 28px 20px;"><div style="border:1px solid #e5ddd2;border-radius:15px;background:#faf8f4;padding:14px 16px;">'
            . '<div style="font:700 10px/1.2 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:' . esc_attr($accent) . ';">' . esc_html($price_label) . '</div>'
            . '<div style="margin-top:5px;font:800 24px/1 Arial,sans-serif;color:#302821;">&euro; ' . esc_html($content['price']) . '</div>'
            . '<div style="margin-top:7px;font:600 11px/1.4 Arial,sans-serif;color:#776d64;">' . esc_html($price_note) . '</div></div></td></tr>';
    }
    $cta = '';
    if ($content['buttonLabel'] !== '' && $content['buttonUrl'] !== '') {
        $cta = '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 2px;"><tr><td bgcolor="' . esc_attr($accent) . '" style="border-radius:999px;"><a href="' . esc_url($content['buttonUrl']) . '" style="display:inline-block;padding:13px 21px;font:700 14px Arial,sans-serif;color:#fff;text-decoration:none;border-radius:999px;">' . esc_html($content['buttonLabel']) . ' &rarr;</a></td></tr></table>';
    }
    return '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:0;background:#f4f0e9;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f0e9;"><tr><td align="center" style="padding:22px 10px;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;border-radius:22px;overflow:hidden;">'
        . '<tr><td style="padding:18px 28px;"><table role="presentation" width="100%"><tr><td><img src="https://app.strik-patisserie.nl/strik-logo.png" width="67" alt="Strik Patisserie" style="display:block;width:67px;height:auto;border:0;"></td><td align="right"><span style="display:inline-block;border-radius:999px;background:' . esc_attr($soft) . ';padding:8px 13px;font:800 10px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:' . esc_attr($accent) . ';">Horeca update</span></td></tr></table></td></tr>'
        . '<tr><td style="padding:0 28px 20px;">' . $photo . '<div style="background:' . esc_attr($soft) . ';padding:16px 20px;border-radius:' . ($photo ? '0 0 18px 18px' : '18px') . ';">'
        . '<div style="font:800 10px/1.2 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:' . esc_attr($accent) . ';">' . esc_html($content['eyebrow']) . '</div>'
        . '<div style="margin-top:7px;font:800 28px/1.08 Arial,sans-serif;color:#302821;">' . esc_html($content['title']) . '</div></div></td></tr>'
        . $price
        . '<tr><td style="padding:0 30px 26px;">' . strik_horeca_mailing_paragraphs($body) . $cta . '</td></tr>'
        . '<tr><td bgcolor="' . esc_attr($accent) . '" style="padding:18px 28px;font:600 11px/1.6 Arial,sans-serif;color:#fff;">'
        . '<strong>Strik Patisserie</strong> &middot; Nijmegen &middot; <a href="mailto:info@strik-patisserie.nl" style="color:#fff;">info@strik-patisserie.nl</a><br>Is dit niet het juiste e-mailadres voor deze informatie? Antwoord op deze mail en laat ons weten welk adres we voortaan mogen gebruiken.'
        . '</td></tr></table></td></tr></table></body></html>';
}
}

if (!function_exists('strik_horeca_mailing_send')) {
function strik_horeca_mailing_send($request) {
    $input = $request->get_json_params();
    $data = strik_horeca_mailing_get_data();
    if (!is_array($input) || !is_array($data) || empty($data['draft'])) return new WP_Error('missing_draft', 'Sla de mailing eerst op.', array('status' => 400));
    $test = !empty($input['test']);
    $recipient = $test ? 'info@strik-patisserie.nl' : sanitize_email(isset($input['email']) ? $input['email'] : '');
    $company = $test && !empty($data['customers'][0]['company']) ? $data['customers'][0]['company'] : '';
    if (!$test) {
        $customer_id = sanitize_key(isset($input['customerId']) ? $input['customerId'] : '');
        foreach ($data['customers'] as $customer) {
            if ($customer['id'] !== $customer_id) continue;
            if (!in_array(strtolower($recipient), array_map('strtolower', $customer['emails']), true)) continue;
            $company = $customer['company'];
            break;
        }
    }
    if ($company === '' || !is_email($recipient)) return new WP_Error('invalid_recipient', 'Dit e-mailadres staat niet in de horecalijst.', array('status' => 400));
    $subject = ($test ? 'TEST - ' : '') . $data['draft']['content']['subject'];
    $html = strik_horeca_mailing_html($data['draft'], $company);
    $headers = array(
        'Content-Type: text/html; charset=UTF-8',
        'From: Strik Patisserie <info@strik-patisserie.nl>',
        'Reply-To: Strik Patisserie <info@strik-patisserie.nl>',
    );
    if (!wp_mail($recipient, $subject, $html, $headers)) return new WP_Error('mail_failed', 'WordPress kon de e-mail niet versturen.', array('status' => 502));
    if (!$test) {
        $data['lastSent'][] = array('company' => $company, 'email' => $recipient, 'subject' => $subject, 'sentAt' => wp_date(DATE_ATOM));
        $data['lastSent'] = array_slice($data['lastSent'], -200);
        $data['updatedAt'] = wp_date(DATE_ATOM);
        update_option(STRIK_HORECA_MAILING_OPTION, $data, false);
    }
    $data['sent'] = 1;
    return rest_ensure_response($data);
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/horeca-mailing', array(
        array('methods' => WP_REST_Server::READABLE, 'callback' => 'strik_horeca_mailing_get', 'permission_callback' => 'strik_horeca_mailing_permission'),
        array('methods' => WP_REST_Server::CREATABLE, 'callback' => 'strik_horeca_mailing_save', 'permission_callback' => 'strik_horeca_mailing_permission'),
        array('methods' => WP_REST_Server::EDITABLE, 'callback' => 'strik_horeca_mailing_send', 'permission_callback' => 'strik_horeca_mailing_permission'),
    ));
});
