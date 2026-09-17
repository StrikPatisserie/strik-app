/**
 * Separate WordPress Code Snippet for Strik Team App account requests.
 * POST /wp-json/strik/v1/account-request-mail, authenticated with an
 * administrator Application Password. Never expose that password in a browser.
 */

if (!function_exists('strik_send_account_request_mail')) {
function strik_send_account_request_mail($request) {
    $payload = $request->get_json_params();
    if (!is_array($payload)) {
        return new WP_Error('invalid_payload', 'Ongeldige aanvraag.', array('status' => 400));
    }

    $id = (string) ($payload['id'] ?? '');
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) {
        return new WP_Error('invalid_id', 'Ongeldig aanvraag-ID.', array('status' => 400));
    }

    $name = sanitize_text_field((string) ($payload['fullName'] ?? ''));
    $email = sanitize_email((string) ($payload['email'] ?? ''));
    $department = sanitize_text_field((string) ($payload['department'] ?? ''));
    $store = sanitize_text_field((string) ($payload['store'] ?? ''));
    if ($name === '' || !is_email($email) || $department === '') {
        return new WP_Error('invalid_request', 'Aanvraaggegevens ontbreken.', array('status' => 400));
    }

    $option = 'strik_account_request_mail_' . $id;
    if (get_option($option) === 'sent') {
        return rest_ensure_response(array('sent' => true, 'alreadySent' => true));
    }

    $shops = array(
        'ziekerstraat' => 'Ziekerstraat',
        'heyendaal' => 'Heyendaal',
        'daalseweg' => 'Daalseweg',
        'lent' => 'Lent',
    );
    $store_label = $shops[$store] ?? $store;
    $body = implode("\n", array(
        'Er is toegang tot de Strik Team App aangevraagd.',
        '',
        'Naam: ' . $name,
        'E-mail: ' . $email,
        'Afdeling: ' . $department,
        'Winkel: ' . ($store_label ?: 'Niet van toepassing'),
        '',
        'Beoordeel de aanvraag via Gebruikers & app in de Strik Team App:',
        'https://strik-app.vercel.app/settings?user=' . rawurlencode($id),
        'Activeer het account pas als je de aanvrager en de gewenste toegang hebt gecontroleerd.',
    ));
    $headers = array('Content-Type: text/plain; charset=UTF-8', 'Reply-To: Strik Patisserie <info@strik-patisserie.nl>');
    if (!wp_mail('feline@strik-patisserie.nl', 'Nieuwe aanvraag Strik Team App: ' . $name, $body, $headers)) {
        return new WP_Error('mail_failed', 'WordPress kon de melding niet versturen.', array('status' => 502));
    }

    update_option($option, 'sent', false);
    return rest_ensure_response(array('sent' => true));
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/account-request-mail', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'strik_send_account_request_mail',
        'permission_callback' => function () { return current_user_can('manage_options'); },
    ));
});
