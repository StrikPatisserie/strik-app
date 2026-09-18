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
        $lines[] = 'Cadeaupapier: alle letters ingepakt - EUR 1,00 per letter';
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
    $subject = $template === 'ORDER_CANCELLATION' ? 'Chocoladeletterbestelling geannuleerd ' . $number
        : ($for_customer ? 'Bevestiging chocoladeletterbestelling ' : 'Back-up chocoladeletterbestelling ') . $number;
    $headers = array('Content-Type: text/plain; charset=UTF-8', 'Reply-To: Strik Patisserie <info@strik-patisserie.nl>');
    $body = $template === 'ORDER_CANCELLATION'
        ? "Beste " . sanitize_text_field((string) ($payload['customer_name'] ?? 'klant')) . ",\n\nJe chocoladeletterbestelling " . $number . " is geannuleerd. Je hoeft hiervoor niets te betalen of af te halen.\n\nHeb je vragen? Antwoord gerust op deze e-mail.\n\nStrik Patisserie"
        : implode("\n", strik_lettershop_mail_lines($payload, $for_customer));

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
