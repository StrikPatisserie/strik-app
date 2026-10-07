<?php
/**
 * Strik prijskaartjes mail relay.
 * Installeer dit als aparte WordPress Code Snippet en activeer hem eenmaal.
 * De route accepteert uitsluitend een PDF voor info@strik-patisserie.nl en
 * vereist een WordPress Application Password met beheerdersrechten.
 */

if (!function_exists('strik_price_card_send_mail')) {
function strik_price_card_send_mail($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error('invalid_payload', 'Ongeldige mailgegevens.', array('status' => 400));
    }

    $id = sanitize_text_field((string) ($params['id'] ?? ''));
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) {
        return new WP_Error('invalid_id', 'Ongeldig mail-ID.', array('status' => 400));
    }
    $recipient = sanitize_email((string) ($params['recipient'] ?? ''));
    if ($recipient !== 'info@strik-patisserie.nl') {
        return new WP_Error('invalid_recipient', 'Ongeldige ontvanger.', array('status' => 400));
    }
    $session_name = sanitize_text_field((string) ($params['sessionName'] ?? 'Printsessie'));
    $card_count = max(1, min(999, (int) ($params['cardCount'] ?? 0)));
    $filename = sanitize_file_name((string) ($params['filename'] ?? 'prijskaartjes.pdf'));
    if (!preg_match('/\.pdf$/i', $filename)) $filename .= '.pdf';
    $bytes = base64_decode((string) ($params['pdfBase64'] ?? ''), true);
    if ($bytes === false || strlen($bytes) < 5 || strlen($bytes) > 8000000 || substr($bytes, 0, 5) !== '%PDF-') {
        return new WP_Error('invalid_pdf', 'De PDF-bijlage is ongeldig of te groot.', array('status' => 400));
    }

    $option = 'strik_price_card_mail_' . $id;
    if (get_option($option) === 'sent') {
        return rest_ensure_response(array('sent' => true, 'alreadySent' => true));
    }

    $temp_dir = trailingslashit(get_temp_dir()) . 'strik-price-card-' . $id;
    if (!wp_mkdir_p($temp_dir)) {
        return new WP_Error('temp_failed', 'Tijdelijke PDF-map kon niet worden gemaakt.', array('status' => 500));
    }
    $pdf_path = trailingslashit($temp_dir) . $filename;
    if (file_put_contents($pdf_path, $bytes) === false) {
        @unlink($pdf_path);
        @rmdir($temp_dir);
        return new WP_Error('write_failed', 'PDF-bijlage kon niet worden opgeslagen.', array('status' => 500));
    }

    $subject = 'Printklare prijskaartjes: ' . $session_name;
    $body = "De printklare Evolis-PDF staat in de bijlage.\n\n"
        . 'Sessie: ' . $session_name . "\n"
        . 'Aantal pagina\'s/kaartjes: ' . $card_count . "\n"
        . "Formaat: 85 x 55 mm, iedere pagina is één kaartje.\n\n"
        . "Open de PDF op de pc met de Evolis Zenius en print op 100% zonder marges.";
    $headers = array(
        'Content-Type: text/plain; charset=UTF-8',
        'Reply-To: Strik Patisserie <info@strik-patisserie.nl>',
    );
    $sent = wp_mail($recipient, $subject, $body, $headers, array($pdf_path));
    @unlink($pdf_path);
    @rmdir($temp_dir);
    if (!$sent) return new WP_Error('mail_failed', 'WordPress kon de e-mail niet versturen.', array('status' => 502));

    update_option($option, 'sent', false);
    return rest_ensure_response(array('sent' => true));
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/price-card-mail', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'strik_price_card_send_mail',
        'permission_callback' => function () { return current_user_can('manage_options'); },
    ));
});
