<?php
/**
 * Strik lettershop mail relay. Install as a separate WordPress Code Snippet.
 * Authenticate via a WordPress Application Password for an administrator.
 * Never expose that password to the browser.
 */

if (!function_exists('strik_lettershop_mail_lines')) {
function strik_lettershop_mail_lines($payload, $for_customer) {
    $number = sanitize_text_field((string) ($payload['order_number'] ?? ''));
    $customer = sanitize_text_field((string) ($payload['customer_name'] ?? ''));
    $date = sanitize_text_field((string) ($payload['requested_date'] ?? ''));
    $shops = array(
        'ziekerstraat' => 'Ziekerstraat', 'heyendaal' => 'Heyendaal',
        'daalseweg' => 'Daalseweg', 'lent' => 'Lent',
    );
    $shop_key = (string) ($payload['pickup_location'] ?? '');
    $shop = $shops[$shop_key] ?? $shop_key;
    $lines = array(
        $for_customer ? 'Bedankt voor je chocoladeletterbestelling bij Strik Patisserie!' : 'NIEUWE CHOCOLADELETTERBESTELLING (BACK-UP)',
        '',
        'Ordernummer: ' . $number,
        'Naam: ' . $customer,
        'E-mail: ' . sanitize_email((string) ($payload['customer_email'] ?? '')),
        'Telefoon: ' . sanitize_text_field((string) ($payload['phone'] ?? '')),
        'Afhalen: ' . $date . ' bij Strik ' . $shop,
        'Betaalwijze: betalen bij afhalen',
        '',
        'Bestelling:',
    );
    foreach ((array) ($payload['items'] ?? array()) as $item) {
        if (!is_array($item)) continue;
        $quantity = max(0, (int) ($item['quantity'] ?? 0));
        $unit_cents = (int) ($item['unit_price_cents'] ?? 0);
        $logo_cents = (int) ($item['logo_price_cents'] ?? 0);
        $style = ($item['style'] ?? '') === 'vorm' ? 'vormletter' : 'spuitletter';
        $description = $quantity . ' x ' . $style . ' ' . strtoupper(sanitize_text_field((string) ($item['letter'] ?? '')))
            . ' - ' . sanitize_text_field((string) ($item['flavour'] ?? ''))
            . ' - ' . sanitize_text_field((string) ($item['size'] ?? ''));
        if (!empty($item['logo'])) $description .= ' met foto/logo';
        $description .= ' - EUR ' . number_format(($unit_cents + $logo_cents) / 100, 2, ',', '.') . ' p.st.';
        $lines[] = $description;
        if (!$for_customer && !empty($item['logo_storage_path'])) {
            $lines[] = '  Foto/logo bestand: ' . sanitize_text_field((string) $item['logo_storage_path']);
        }
    }
    $lines[] = '';
    if (!empty($payload['gift_wrap'])) {
        $wrap_cents = isset($payload['gift_wrap_price_cents']) ? max(0, (int) $payload['gift_wrap_price_cents']) : 100;
        $lines[] = 'Cadeaupapier: alle letters ingepakt - EUR ' . number_format($wrap_cents / 100, 2, ',', '.') . ' per letter';
        $lines[] = 'Toeslag cadeaupapier: EUR ' . number_format(((int) ($payload['gift_wrap_total_cents'] ?? 0)) / 100, 2, ',', '.');
    }
    $lines[] = 'Totaal inclusief 9% btw: EUR ' . number_format(((int) ($payload['total_cents'] ?? 0)) / 100, 2, ',', '.');
    if (!empty($payload['notes'])) {
        $lines[] = '';
        $lines[] = 'Speciale verzoeken: ' . sanitize_textarea_field((string) $payload['notes']);
    }
    $lines[] = '';
    if ($for_customer) {
        $lines[] = 'Je betaalt bij het afhalen in de winkel.';
        $lines[] = 'We maken je letters met de hand. Wil je annuleren? Laat het ons uiterlijk 2 dagen voor het afhalen weten via info@strik-patisserie.nl en vermeld je ordernummer.';
        $lines[] = 'Haal je de bestelling zonder annulering niet op, dan kunnen we het bestelbedrag alsnog in rekening brengen.';
        $lines[] = 'Vragen? Je kunt op deze e-mail antwoorden.';
    } else {
        $lines[] = 'Automatische back-upkopie uit de Strik lettershop.';
    }
    return $lines;
}
}

if (!function_exists('strik_lettershop_mail_origin')) {
function strik_lettershop_mail_origin($payload) {
    // The collection shop is not the source: online orders also collect there.
    $store = strtoupper((string) ($payload['channel'] ?? 'ONLINE')) === 'STORE';
    return array(
        'label' => $store ? 'Winkelbestelling' : 'Lettershopbestelling',
        'detail' => $store ? 'Aangenomen in de winkel' : 'Online besteld via de Lettershop',
        'accent' => $store ? '#e8cf90' : '#c8e2d4',
        'background' => $store ? '#faf3df' : '#edf6f0',
    );
}
}

if (!function_exists('strik_lettershop_mail_subject')) {
function strik_lettershop_mail_subject($payload, $template) {
    $number = sanitize_text_field((string) ($payload['order_number'] ?? ''));
    if ($template === 'ORDER_CANCELLATION') return 'Chocoladeletterbestelling geannuleerd ' . $number;
    if ($template === 'ONLINE_CONFIRMATION') return 'Bevestiging chocoladeletterbestelling ' . $number;
    $origin = strik_lettershop_mail_origin($payload);
    return $origin['label'] . ' chocoladeletters ' . $number . ' - ' . sanitize_text_field((string) ($payload['customer_name'] ?? ''));
}
}

if (!function_exists('strik_lettershop_mail_html')) {
function strik_lettershop_mail_html($payload, $for_customer = false) {
    $origin = strik_lettershop_mail_origin($payload);
    $number = esc_html((string) ($payload['order_number'] ?? ''));
    $name = esc_html((string) ($payload['customer_name'] ?? ''));
    $date = (string) ($payload['requested_date'] ?? '');
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $date = date('d-m-Y', strtotime($date));
    $shops = array(
        'ziekerstraat' => 'Strik Centrum · Ziekerstraat 124',
        'heyendaal' => 'Strik Brakkenstein · Heyendaalseweg 217',
        'daalseweg' => 'Strik Nijmegen-Oost · Daalseweg 254',
        'lent' => 'Strik Lent · Oranje Marieplein 11',
    );
    $pickup = (string) ($payload['pickup_location'] ?? '');
    $shop = esc_html($shops[$pickup] ?? $pickup);
    $title = $for_customer ? 'Uw chocoladeletters zijn besteld!' : $origin['label'] . '<br>Chocoladeletters';
    $badge = $for_customer ? 'Bestelbevestiging' : $origin['label'] . ' · interne back-up';
    $greeting = $for_customer
        ? '<p style="margin:0 0 14px;font-size:16px;">Beste ' . $name . ',</p><p style="margin:0 0 22px;font-size:16px;line-height:1.55;">Bedankt voor uw bestelling bij Strik. Wij maken uw chocoladeletters met zorg voor u klaar.</p>'
        : '<p style="margin:0 0 18px;font-size:16px;"><strong>Klant:</strong> ' . $name . '</p>';
    $contacts = '';
    if (!$for_customer) {
        $email = sanitize_email((string) ($payload['customer_email'] ?? ''));
        $email_html = $email !== '' ? '<a href="' . esc_attr('mailto:' . $email) . '" style="color:#244b37;">' . esc_html($email) . '</a>' : 'Niet opgegeven';
        $phone = !empty($payload['phone']) ? esc_html((string) $payload['phone']) : 'Niet opgegeven';
        $contacts = '<p style="margin:12px 0 7px;font-size:15px;"><strong>Telefoon:</strong> ' . $phone . '</p><p style="margin:0;font-size:15px;"><strong>E-mail:</strong> ' . $email_html . '</p>';
        if (!empty($payload['entered_store']) && strtoupper((string) ($payload['channel'] ?? '')) === 'STORE') {
            $entered = (string) $payload['entered_store'];
            $contacts .= '<p style="margin:12px 0 0;font-size:15px;"><strong>Aangenomen in:</strong> ' . esc_html($shops[$entered] ?? $entered) . '</p>';
        }
    }
    $items = '';
    foreach ((array) ($payload['items'] ?? array()) as $item) {
        if (!is_array($item)) continue;
        $quantity = max(0, (int) ($item['quantity'] ?? 0));
        $description = strtoupper((string) ($item['letter'] ?? '')) . ' · ' . (string) ($item['flavour'] ?? '') . ' · ' . (($item['style'] ?? '') === 'vorm' ? 'vormletter' : 'spuitletter') . ' · ' . (string) ($item['size'] ?? '');
        if (!empty($item['logo'])) $description .= ' · met foto/logo';
        $unit_cents = (int) ($item['unit_price_cents'] ?? 0) + (int) ($item['logo_price_cents'] ?? 0);
        $price = isset($item['unit_price_cents']) ? '€ ' . number_format($unit_cents / 100, 2, ',', '.') . ' p.st.' : '';
        $note = !$for_customer && !empty($item['notes']) ? '<div style="margin-top:5px;font-size:13px;line-height:1.5;color:#536b57;">' . nl2br(esc_html((string) $item['notes'])) . '</div>' : '';
        $items .= '<tr><td style="padding:10px 0;border-bottom:1px solid #e6ece3;font-size:14px;"><strong>' . $quantity . '×</strong> ' . esc_html($description) . ($price ? '<div style="margin-top:5px;font-size:13px;color:#536b57;">' . esc_html($price) . '</div>' : '') . $note . '</td></tr>';
    }
    $wrap = '';
    if (!empty($payload['gift_wrap'])) {
        // Saved prices also describe older orders correctly; never reprice mail.
        $wrap_cents = isset($payload['gift_wrap_price_cents']) ? max(0, (int) $payload['gift_wrap_price_cents']) : 100;
        $wrap = '<p style="margin:16px 0 0;font-size:14px;line-height:1.5;"><strong>Cadeaupapier:</strong> alle letters ingepakt · € ' . esc_html(number_format($wrap_cents / 100, 2, ',', '.')) . ' per letter<br>Toeslag cadeaupapier: € ' . esc_html(number_format(((int) ($payload['gift_wrap_total_cents'] ?? 0)) / 100, 2, ',', '.')) . '</p>';
    }
    $notes = !empty($payload['notes']) ? '<h2 style="margin:20px 0 7px;font-size:17px;">Opmerkingen</h2><p style="margin:0;font-size:14px;line-height:1.55;">' . nl2br(esc_html((string) $payload['notes'])) . '</p>' : '';
    $total = isset($payload['total_cents']) ? '<p style="margin:18px 0 0;font-size:18px;"><strong>Totaal inclusief 9% btw: € ' . esc_html(number_format(((int) $payload['total_cents']) / 100, 2, ',', '.')) . '</strong></p>' : '';
    $closing = $for_customer
        ? 'U betaalt bij het afhalen in de winkel. Neem dit ordernummer mee: <strong>' . $number . '</strong>.<br><br>Wilt u annuleren? Laat het ons uiterlijk 2 dagen voor het afhalen weten via info@strik-patisserie.nl en vermeld uw ordernummer. Haalt u de bestelling zonder annulering niet op, dan kunnen we het bestelbedrag alsnog in rekening brengen.<br><br>Vragen? Antwoord gerust op deze e-mail.<br><strong>Tot snel bij Strik!</strong>'
        : 'Automatische interne back-up · ' . esc_html($origin['detail']) . '.<br>De bestelling staat ook in de Strik Team app.';
    return '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#edf4ec;font-family:Arial,Helvetica,sans-serif;color:#263b2b;">'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;margin:0 auto;border-collapse:collapse;"><tr><td style="padding:25px 28px;background:#244b37;color:#fff;border-radius:16px 16px 0 0;">'
        . '<div style="font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#e8cf90;">Strik Patisserie</div><p style="display:inline-block;margin:16px 0 0;padding:7px 10px;background:' . $origin['accent'] . ';border-radius:6px;color:#244b37;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">' . esc_html($badge) . '</p><h1 style="margin:14px 0 0;font-size:27px;line-height:1.2;color:#fff;">' . $title . '</h1></td></tr>'
        . '<tr><td style="padding:12px 28px;background:' . $origin['background'] . ';border-left:5px solid ' . $origin['accent'] . ';font-size:13px;font-weight:700;color:#244b37;">' . esc_html($origin['detail']) . '</td></tr>'
        . '<tr><td style="padding:25px 28px;background:#fffdf8;border-radius:0 0 16px 16px;">' . $greeting
        . '<div style="padding:18px;background:#f1f7ef;border-radius:12px;"><p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#547762;">ORDER ' . $number . '</p><p style="margin:0 0 7px;font-size:16px;"><strong>Afhalen:</strong> ' . esc_html($date) . '</p><p style="margin:0;font-size:15px;"><strong>Afhalen bij:</strong> ' . $shop . '</p>' . $contacts . '</div>'
        . '<h2 style="margin:22px 0 7px;font-size:17px;">' . ($for_customer ? 'Uw bestelling' : 'Bestelling') . '</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' . $items . '</table>'
        . $notes . $wrap . $total . '<p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:#536b57;">' . $closing . '</p>'
        . '</td></tr><tr><td style="padding:16px;text-align:center;font-size:12px;color:#65806a;">Met liefde gemaakt door Strik Patisserie</td></tr></table></body></html>';
}
}

if (!function_exists('strik_lettershop_send_mail')) {
function strik_lettershop_send_mail($request) {
    $params = $request->get_json_params();
    if (!is_array($params) || !is_array($params['payload'] ?? null)) {
        return new WP_Error('invalid_payload', 'Ongeldige mailgegevens.', array('status' => 400));
    }
    $id = (string) ($params['id'] ?? '');
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) {
        return new WP_Error('invalid_id', 'Ongeldig mail-ID.', array('status' => 400));
    }
    $template = (string) ($params['template'] ?? '');
    if (!in_array($template, array('ONLINE_CONFIRMATION', 'INTERNAL_ORDER_BACKUP', 'ORDER_CANCELLATION'), true)) {
        return new WP_Error('invalid_template', 'Onbekend mailtype.', array('status' => 400));
    }
    $payload = $params['payload'];
    $number = sanitize_text_field((string) ($payload['order_number'] ?? ''));
    if ($number === '' || ($template !== 'ORDER_CANCELLATION' && empty($payload['items']))) {
        return new WP_Error('invalid_order', 'Bestelgegevens ontbreken.', array('status' => 400));
    }
    $option = 'strik_lettershop_mail_' . $id;
    if (get_option($option) === 'sent') return rest_ensure_response(array('sent' => true, 'alreadySent' => true));

    $for_customer = $template === 'ONLINE_CONFIRMATION';
    $recipient = ($for_customer || $template === 'ORDER_CANCELLATION') ? sanitize_email((string) ($payload['customer_email'] ?? '')) : 'info@strik-patisserie.nl';
    if (!is_email($recipient)) return new WP_Error('invalid_recipient', 'Ongeldig e-mailadres.', array('status' => 400));
    $subject = strik_lettershop_mail_subject($payload, $template);
    $headers = array('Content-Type: ' . ($template === 'ORDER_CANCELLATION' ? 'text/plain' : 'text/html') . '; charset=UTF-8', 'Reply-To: Strik Patisserie <info@strik-patisserie.nl>');
    $body = $template === 'ORDER_CANCELLATION'
        ? "Beste " . sanitize_text_field((string) ($payload['customer_name'] ?? 'klant')) . ",\n\nJe chocoladeletterbestelling " . $number . " is geannuleerd. Je hoeft hiervoor niets te betalen of af te halen.\n\nHeb je vragen? Antwoord gerust op deze e-mail.\n\nStrik Patisserie"
        : strik_lettershop_mail_html($payload, $for_customer);

    $attachments = array();
    if (!$for_customer && !empty($params['attachments']) && is_array($params['attachments'])) {
        $total_size = 0;
        foreach ($params['attachments'] as $attachment) {
            if (!is_array($attachment)) continue;
            $name = sanitize_file_name((string) ($attachment['name'] ?? 'foto.jpg'));
            $bytes = base64_decode((string) ($attachment['base64'] ?? ''), true);
            if ($bytes === false || strlen($bytes) > 3000000 || $total_size + strlen($bytes) > 5000000) continue;
            if (!preg_match('/\.(jpg|jpeg|png|webp|heic|heif)$/i', $name)) continue;
            $path = wp_tempnam($name);
            if (!$path || file_put_contents($path, $bytes) === false) continue;
            // wp_tempnam() creates a .tmp path. Give wp_mail() the actual
            // image filename so mail clients recognize/download the attachment.
            $mail_name = sanitize_file_name($number . '-foto-' . (count($attachments) + 1) . '-' . $name);
            $attachments[$mail_name] = $path;
            $total_size += strlen($bytes);
        }
    }

    $sent = wp_mail($recipient, $subject, $body, $headers, $attachments);
    foreach ($attachments as $path) @unlink($path);
    if (!$sent) return new WP_Error('mail_failed', 'WordPress kon de e-mail niet versturen.', array('status' => 502));
    update_option($option, 'sent', false);
    return rest_ensure_response(array('sent' => true));
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/lettershop-mail', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'strik_lettershop_send_mail',
        'permission_callback' => function () { return current_user_can('manage_options'); },
    ));
});
