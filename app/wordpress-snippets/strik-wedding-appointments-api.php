<?php
/**
 * Strik wedding appointments: privileged archive export and mail transport.
 * Existing Booking Calendar data is read only; nothing is deleted or changed.
 */

if (!function_exists('strik_wedding_legacy_archive')) {
function strik_wedding_legacy_archive() {
    global $wpdb;
    $names = $wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($wpdb->prefix . 'booking') . '%'));
    $tables = array();
    $counts = array();
    foreach ($names as $table) {
        if (!preg_match('/^' . preg_quote($wpdb->prefix, '/') . 'booking[a-zA-Z0-9_]*$/', $table)) continue;
        $key = substr($table, strlen($wpdb->prefix));
        $rows = $wpdb->get_results('SELECT * FROM `' . $table . '`', ARRAY_A);
        if ($wpdb->last_error) return new WP_Error('archive_failed', 'Een brontabel kon niet volledig worden gelezen.', array('status' => 503));
        $tables[$key] = $rows;
        $counts[$key] = count($rows);
    }
    if (!isset($tables['booking']) || !isset($tables['bookingdates'])) return new WP_Error('archive_missing', 'De oorspronkelijke boekingstabellen zijn niet gevonden.', array('status' => 503));
    $raw = wp_json_encode($tables, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($raw === false) return new WP_Error('archive_invalid', 'De oorspronkelijke boekingen konden niet veilig worden geëxporteerd.', array('status' => 503));
    return array('format' => 'strik-wedding-booking-export-v1', 'exportedAt' => gmdate('c'), 'timezone' => wp_timezone_string(), 'counts' => $counts, 'sha256' => hash('sha256', $raw), 'raw' => $raw);
}
}

add_action('admin_menu', function () {
    add_management_page('Bruidstaartafspraken overnemen', 'Bruidstaartovername', 'manage_options', 'strik-wedding-export', function () {
        if (!current_user_can('manage_options')) return;
        $archive = strik_wedding_legacy_archive();
        echo '<div class="wrap"><h1>Bruidstaartafspraken overnemen</h1><p>Volledige kopie van alle oorspronkelijke boekingstabellen, inclusief historie en alle ingevulde gegevens. De brongegevens blijven intact.</p>';
        if (is_wp_error($archive)) { echo '<p>' . esc_html($archive->get_error_message()) . '</p></div>'; return; }
        echo '<table class="widefat striped" style="max-width:650px"><thead><tr><th>Brontabel</th><th>Aantal regels</th></tr></thead><tbody>';
        foreach ($archive['counts'] as $table => $count) echo '<tr><td>' . esc_html($table) . '</td><td>' . (int) $count . '</td></tr>';
        echo '</tbody></table><p>De export bevat een SHA-256-controlegetal waarmee de nieuwe app de volledige kopie kan controleren.</p><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        echo '<input type="hidden" name="action" value="strik_wedding_archive_download">';
        wp_nonce_field('strik_wedding_archive_download');
        submit_button('Download volledige afsprakenhistorie');
        echo '</form></div>';
    });
});

add_action('admin_post_strik_wedding_archive_download', function () {
    if (!current_user_can('manage_options')) wp_die('Geen toegang.', '', array('response' => 403));
    check_admin_referer('strik_wedding_archive_download');
    $archive = strik_wedding_legacy_archive();
    if (is_wp_error($archive)) wp_die(esc_html($archive->get_error_message()), '', array('response' => 503));
    nocache_headers();
    header('Content-Type: application/json; charset=UTF-8');
    header('Content-Disposition: attachment; filename="strik-bruidstaartafspraken-volledig-' . gmdate('Y-m-d-His') . '.json"');
    header('X-Content-Type-Options: nosniff');
    echo wp_json_encode($archive, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
});

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/wedding-appointments/export', array(
        'methods' => 'GET',
        'permission_callback' => function () { return current_user_can('manage_options'); },
        'callback' => function () { return rest_ensure_response(strik_wedding_legacy_archive()); },
    ));
});

// Privileged, idempotent transport for confirmations and the next-day reminder.
add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/wedding-appointments/mail', array(
        'methods' => 'POST',
        'permission_callback' => function () { return current_user_can('manage_options'); },
        'callback' => function ($request) {
            $input = $request->get_json_params();
            $template = isset($input['template']) ? $input['template'] : '';
            $id = isset($input['id']) ? $input['id'] : '';
            if (!preg_match('/^[a-f0-9-]{36}$/i', $id) || !in_array($template, array('CUSTOMER_CONFIRMATION','INTERNAL_CONFIRMATION','CUSTOMER_REMINDER'), true)) return new WP_Error('invalid_wedding_mail', 'Ongeldige mailopdracht.', array('status'=>400));
            $recipient = $template === 'INTERNAL_CONFIRMATION' ? 'info@strik-patisserie.nl' : sanitize_email(isset($input['email']) ? $input['email'] : '');
            $subject = isset($input['subject']) ? $input['subject'] : '';
            $html = isset($input['html']) ? $input['html'] : '';
            if (!is_email($recipient) || !is_string($subject) || strlen($subject)>800 || preg_match('/[\r\n]/', $subject) || !is_string($html) || strlen($html)>60000) return new WP_Error('invalid_wedding_mail', 'Controleer ontvanger en bericht.', array('status'=>400));
            $key = 'strik_wedding_mail_' . hash('sha256', $id);
            $checksum = hash('sha256', wp_json_encode(array($recipient,$template,$subject,$html)));
            $receipt = get_option($key, array());
            if (!empty($receipt)) {
                if (empty($receipt['hash']) || !hash_equals($receipt['hash'], $checksum)) return new WP_Error('wedding_mail_changed', 'Deze mailopdracht is gewijzigd.', array('status'=>409));
                if ($receipt['state'] === 'sent') return rest_ensure_response(array('sent'=>true));
                if ($receipt['state'] === 'sending') return new WP_Error('wedding_mail_uncertain', 'De verzendstatus wordt gecontroleerd; verstuur niet opnieuw.', array('status'=>409));
            }
            // add_option has a unique key and acts as an atomic sending lock.
            $lock = $key . '_lock';
            if (!add_option($lock, time(), '', false)) return new WP_Error('wedding_mail_busy', 'Deze mail wordt al verwerkt.', array('status'=>409));
            try {
                $receipt = get_option($key, array());
                if (!empty($receipt) && (empty($receipt['hash']) || !hash_equals($receipt['hash'], $checksum))) return new WP_Error('wedding_mail_changed', 'Deze mailopdracht is gewijzigd.', array('status'=>409));
                if (!empty($receipt) && $receipt['state'] === 'sent') return rest_ensure_response(array('sent'=>true));
                if (!empty($receipt) && $receipt['state'] === 'sending') return new WP_Error('wedding_mail_uncertain', 'Controleer de verzendstatus.', array('status'=>409));
                $receipt = array('hash'=>$checksum,'state'=>'sending','startedAt'=>gmdate('c'));
                if (get_option($key, null) === null) $stored = add_option($key, $receipt, '', false); else $stored = update_option($key, $receipt, false);
                if (!$stored) return new WP_Error('wedding_mail_storage', 'De verzendopdracht kon niet worden opgeslagen.', array('status'=>503));
                $sent = wp_mail($recipient, sanitize_text_field($subject), wp_kses_post($html), array('Content-Type: text/html; charset=UTF-8','From: Strik Patisserie <info@strik-patisserie.nl>','Reply-To: info@strik-patisserie.nl'));
                $receipt['state'] = $sent ? 'sent' : 'failed'; $receipt['sentAt'] = $sent ? gmdate('c') : '';
                if (!update_option($key, $receipt, false)) return new WP_Error('wedding_mail_receipt', 'Verzendstatus nog niet bevestigd; controleer deze eerst.', array('status'=>503));
                return $sent ? rest_ensure_response(array('sent'=>true)) : new WP_Error('wedding_mail_failed', 'De mail kon nog niet worden bezorgd.', array('status'=>503));
            } finally { delete_option($lock); }
        },
    ));
});
