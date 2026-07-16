<?php
/**
 * Strik app - Cupcake jubileum orders API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * - GET  /wp-json/strik/v1/cupcake-orders?key=...
 * - POST /wp-json/strik/v1/cupcake-orders?key=...
 * - GET  /wp-json/strik/v1/personnel-mail-orders?key=...
 * - POST /wp-json/strik/v1/personnel-mail-orders?key=...
 *
 * Hiermee kan de app jubileum- en verjaardagsmails automatisch versturen,
 * zonder dezelfde bestelling of herinnering dubbel te mailen.
 */

if (!defined('STRIK_CUPCAKE_ORDERS_API_KEY')) {
    define('STRIK_CUPCAKE_ORDERS_API_KEY', 'schoonmaak-ijs-strik');
}

if (!defined('STRIK_CUPCAKE_ORDERS_OPTION_NAME')) {
    define('STRIK_CUPCAKE_ORDERS_OPTION_NAME', 'strik_cupcake_order_log');
}

if (!defined('STRIK_CUPCAKE_ORDERS_RECIPIENT')) {
    define('STRIK_CUPCAKE_ORDERS_RECIPIENT', 'info@strik-patisserie.nl');
}

if (!defined('STRIK_CUPCAKE_ORDERS_MAX_LOG')) {
    define('STRIK_CUPCAKE_ORDERS_MAX_LOG', 600);
}

if (!defined('STRIK_PERSONNEL_MAIL_MAX_BODY_LENGTH')) {
    define('STRIK_PERSONNEL_MAIL_MAX_BODY_LENGTH', 4000);
}

if (!function_exists('strik_cupcake_permission')) {
function strik_cupcake_permission($request) {
    return hash_equals(STRIK_CUPCAKE_ORDERS_API_KEY, (string) $request->get_param('key'))
        ? true
        : new WP_Error('strik_cupcake_forbidden', 'Geen toegang tot cupcake orders.', array('status' => 403));
}
}

if (!function_exists('strik_cupcake_text')) {
function strik_cupcake_text($value, $max_length = 240) {
    $value = (string) $value;
    if (strlen($value) > $max_length) {
        $value = substr($value, 0, $max_length);
    }

    return sanitize_text_field($value);
}
}

if (!function_exists('strik_cupcake_textarea')) {
function strik_cupcake_textarea($value, $max_length = STRIK_PERSONNEL_MAIL_MAX_BODY_LENGTH) {
    $value = (string) $value;
    if (strlen($value) > $max_length) {
        $value = substr($value, 0, $max_length);
    }

    return sanitize_textarea_field($value);
}
}

if (!function_exists('strik_personnel_mail_sanitize_recipients')) {
function strik_personnel_mail_sanitize_recipients($recipients, $fallback = STRIK_CUPCAKE_ORDERS_RECIPIENT) {
    $raw_recipients = is_array($recipients) ? $recipients : explode(',', (string) $recipients);
    $clean = array();

    foreach (array_slice($raw_recipients, 0, 8) as $recipient) {
        $email = sanitize_email((string) $recipient);
        if ($email !== '' && is_email($email)) {
            $clean[] = $email;
        }
    }

    if (count($clean) < 1) {
        $email = sanitize_email($fallback);
        if ($email !== '' && is_email($email)) {
            $clean[] = $email;
        }
    }

    return $clean;
}
}

if (!function_exists('strik_cupcake_sanitize_order')) {
function strik_cupcake_sanitize_order($order) {
    if (!is_array($order)) return null;

    $id = isset($order['id']) ? strik_cupcake_text($order['id'], 180) : '';
    $employee_name = isset($order['employeeName']) ? strik_cupcake_text($order['employeeName'], 180) : '';
    $years_label = isset($order['yearsLabel']) ? strik_cupcake_text($order['yearsLabel'], 40) : '';
    $anniversary_date = isset($order['anniversaryDate']) ? strik_cupcake_text($order['anniversaryDate'], 40) : '';

    if ($id === '' || $employee_name === '' || $years_label === '' || $anniversary_date === '') {
        return null;
    }

    return array(
        'id' => $id,
        'employeeName' => $employee_name,
        'yearsLabel' => $years_label,
        'anniversaryDate' => $anniversary_date,
        'anniversaryDateLabel' => isset($order['anniversaryDateLabel']) ? strik_cupcake_text($order['anniversaryDateLabel']) : '',
        'daysUntil' => isset($order['daysUntil']) ? absint($order['daysUntil']) : 0,
        'source' => isset($order['source']) ? strik_cupcake_text($order['source'], 40) : '',
        'deliveryShop' => isset($order['deliveryShop']) ? strik_cupcake_text($order['deliveryShop'], 120) : 'Onbekend',
        'deliveryDate' => isset($order['deliveryDate']) ? strik_cupcake_text($order['deliveryDate'], 40) : '',
        'deliveryDateLabel' => isset($order['deliveryDateLabel']) ? strik_cupcake_text($order['deliveryDateLabel']) : '',
        'deliveryTimeLabel' => isset($order['deliveryTimeLabel']) ? strik_cupcake_text($order['deliveryTimeLabel'], 80) : '',
        'note' => isset($order['note']) ? strik_cupcake_text($order['note'], 400) : '',
    );
}
}

if (!function_exists('strik_personnel_mail_sanitize_order')) {
function strik_personnel_mail_sanitize_order($order) {
    if (!is_array($order)) return null;

    $id = isset($order['id']) ? strik_cupcake_text($order['id'], 180) : '';
    $subject = isset($order['subject']) ? strik_cupcake_text($order['subject'], 240) : '';
    $body = isset($order['body']) ? strik_cupcake_textarea($order['body']) : '';

    if ($id === '' || $subject === '' || $body === '') {
        return null;
    }

    return array(
        'id' => $id,
        'mailType' => isset($order['mailType']) ? strik_cupcake_text($order['mailType'], 60) : '',
        'employeeName' => isset($order['employeeName']) ? strik_cupcake_text($order['employeeName'], 180) : '',
        'firstName' => isset($order['firstName']) ? strik_cupcake_text($order['firstName'], 80) : '',
        'yearsLabel' => isset($order['yearsLabel']) ? strik_cupcake_text($order['yearsLabel'], 40) : '',
        'eventDate' => isset($order['eventDate']) ? strik_cupcake_text($order['eventDate'], 40) : '',
        'eventDateLabel' => isset($order['eventDateLabel']) ? strik_cupcake_text($order['eventDateLabel'], 160) : '',
        'anniversaryDate' => isset($order['anniversaryDate']) ? strik_cupcake_text($order['anniversaryDate'], 40) : '',
        'anniversaryDateLabel' => isset($order['anniversaryDateLabel']) ? strik_cupcake_text($order['anniversaryDateLabel'], 160) : '',
        'birthdayDate' => isset($order['birthdayDate']) ? strik_cupcake_text($order['birthdayDate'], 40) : '',
        'birthdayDateLabel' => isset($order['birthdayDateLabel']) ? strik_cupcake_text($order['birthdayDateLabel'], 160) : '',
        'daysUntil' => isset($order['daysUntil']) ? absint($order['daysUntil']) : 0,
        'source' => isset($order['source']) ? strik_cupcake_text($order['source'], 40) : '',
        'recipients' => strik_personnel_mail_sanitize_recipients(
            isset($order['recipients']) ? $order['recipients'] : STRIK_CUPCAKE_ORDERS_RECIPIENT
        ),
        'subject' => $subject,
        'body' => $body,
        'deliveryShop' => isset($order['deliveryShop']) ? strik_cupcake_text($order['deliveryShop'], 120) : '',
        'deliveryDate' => isset($order['deliveryDate']) ? strik_cupcake_text($order['deliveryDate'], 40) : '',
        'deliveryDateLabel' => isset($order['deliveryDateLabel']) ? strik_cupcake_text($order['deliveryDateLabel'], 160) : '',
        'deliveryTimeLabel' => isset($order['deliveryTimeLabel']) ? strik_cupcake_text($order['deliveryTimeLabel'], 80) : '',
        'note' => isset($order['note']) ? strik_cupcake_text($order['note'], 500) : '',
    );
}
}

if (!function_exists('strik_cupcake_get_log')) {
function strik_cupcake_get_log() {
    $log = get_option(STRIK_CUPCAKE_ORDERS_OPTION_NAME, array());

    return is_array($log) ? $log : array();
}
}

if (!function_exists('strik_cupcake_save_log')) {
function strik_cupcake_save_log($log) {
    uasort($log, function ($a, $b) {
        return strcmp(
            isset($b['sentAt']) ? $b['sentAt'] : '',
            isset($a['sentAt']) ? $a['sentAt'] : ''
        );
    });

    $log = array_slice($log, 0, STRIK_CUPCAKE_ORDERS_MAX_LOG, true);
    update_option(STRIK_CUPCAKE_ORDERS_OPTION_NAME, $log, false);
}
}

if (!function_exists('strik_cupcake_create_mail_body')) {
function strik_cupcake_create_mail_body($order) {
    $lines = array(
        'Graag een jubileumcupcake maken.',
        '',
        'Naam: ' . $order['employeeName'],
        'Jubileum: ' . $order['yearsLabel'] . ' jaar in dienst',
        'Cupcake foto/tekst: ' . $order['yearsLabel'],
        'Jubileumdatum: ' . ($order['anniversaryDateLabel'] ?: $order['anniversaryDate']),
        'Meegeven/bezorgen naar: ' . ($order['deliveryShop'] ?: 'Onbekend'),
        'Voor dienst op: ' . ($order['deliveryDateLabel'] ?: 'Geen dienst gevonden'),
    );

    if ($order['deliveryTimeLabel'] !== '') {
        $lines[] = 'Diensttijd: ' . $order['deliveryTimeLabel'];
    }

    if ($order['note'] !== '') {
        $lines[] = '';
        $lines[] = 'Notitie: ' . $order['note'];
    }

    $lines[] = '';
    $lines[] = 'Automatisch verstuurd vanuit de Strik Team app.';
    $lines[] = 'Order-id: ' . $order['id'];

    return implode("\n", $lines);
}
}

if (!function_exists('strik_cupcake_send_order')) {
function strik_cupcake_send_order($order) {
    $subject = sprintf(
        'Cupcake jubileum - %s - %s jaar',
        $order['employeeName'],
        $order['yearsLabel']
    );
    $headers = array('Content-Type: text/plain; charset=UTF-8');

    return wp_mail(
        STRIK_CUPCAKE_ORDERS_RECIPIENT,
        $subject,
        strik_cupcake_create_mail_body($order),
        $headers
    );
}
}

if (!function_exists('strik_personnel_mail_send_order')) {
function strik_personnel_mail_send_order($order) {
    $headers = array('Content-Type: text/plain; charset=UTF-8');

    return wp_mail(
        $order['recipients'],
        $order['subject'],
        $order['body'],
        $headers
    );
}
}

if (!function_exists('strik_cupcake_get')) {
function strik_cupcake_get($request) {
    return rest_ensure_response(array(
        'recipient' => STRIK_CUPCAKE_ORDERS_RECIPIENT,
        'log' => strik_cupcake_get_log(),
    ));
}
}

if (!function_exists('strik_cupcake_post')) {
function strik_cupcake_post($request) {
    $params = $request->get_json_params();

    if (!is_array($params)) {
        return new WP_Error('strik_cupcake_invalid_json', 'Geen geldige cupcake orders ontvangen.', array('status' => 400));
    }

    $raw_orders = isset($params['orders']) && is_array($params['orders'])
        ? $params['orders']
        : array($params);
    $log = strik_cupcake_get_log();
    $sent = array();
    $skipped = array();
    $failed = array();

    foreach (array_slice($raw_orders, 0, 40) as $raw_order) {
        $order = strik_cupcake_sanitize_order($raw_order);
        if ($order === null) {
            continue;
        }

        if (isset($log[$order['id']])) {
            $skipped[] = $order;
            continue;
        }

        if (strik_cupcake_send_order($order)) {
            $log[$order['id']] = array(
                'sentAt' => wp_date(DATE_ATOM),
                'recipient' => STRIK_CUPCAKE_ORDERS_RECIPIENT,
                'order' => $order,
            );
            $sent[] = $order;
        } else {
            $failed[] = $order;
        }
    }

    strik_cupcake_save_log($log);

    return rest_ensure_response(array(
        'recipient' => STRIK_CUPCAKE_ORDERS_RECIPIENT,
        'sent' => $sent,
        'skipped' => $skipped,
        'failed' => $failed,
    ));
}
}

if (!function_exists('strik_personnel_mail_get')) {
function strik_personnel_mail_get($request) {
    return rest_ensure_response(array(
        'recipient' => STRIK_CUPCAKE_ORDERS_RECIPIENT,
        'log' => strik_cupcake_get_log(),
    ));
}
}

if (!function_exists('strik_personnel_mail_post')) {
function strik_personnel_mail_post($request) {
    $params = $request->get_json_params();

    if (!is_array($params)) {
        return new WP_Error('strik_personnel_mail_invalid_json', 'Geen geldige personeelsmails ontvangen.', array('status' => 400));
    }

    $raw_orders = isset($params['orders']) && is_array($params['orders'])
        ? $params['orders']
        : array($params);
    $log = strik_cupcake_get_log();
    $sent = array();
    $skipped = array();
    $failed = array();

    foreach (array_slice($raw_orders, 0, 80) as $raw_order) {
        $order = strik_personnel_mail_sanitize_order($raw_order);
        if ($order === null) {
            continue;
        }

        if (isset($log[$order['id']])) {
            $skipped[] = $order;
            continue;
        }

        if (strik_personnel_mail_send_order($order)) {
            $log[$order['id']] = array(
                'sentAt' => wp_date(DATE_ATOM),
                'recipients' => $order['recipients'],
                'mailType' => $order['mailType'],
                'order' => $order,
            );
            $sent[] = $order;
        } else {
            $failed[] = $order;
        }
    }

    strik_cupcake_save_log($log);

    return rest_ensure_response(array(
        'sent' => $sent,
        'skipped' => $skipped,
        'failed' => $failed,
    ));
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/cupcake-orders', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_cupcake_get',
            'permission_callback' => 'strik_cupcake_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_cupcake_post',
            'permission_callback' => 'strik_cupcake_permission',
        ),
    ));

    register_rest_route('strik/v1', '/personnel-mail-orders', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_personnel_mail_get',
            'permission_callback' => 'strik_cupcake_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_personnel_mail_post',
            'permission_callback' => 'strik_cupcake_permission',
        ),
    ));
});
