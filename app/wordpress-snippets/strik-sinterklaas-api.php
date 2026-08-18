<?php
/**
 * Strik app - Sinterklaas API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * GET    /wp-json/strik/v1/sinterklaas-letter-orders?key=...&year=2026
 * POST   /wp-json/strik/v1/sinterklaas-letter-orders?key=...
 * PATCH  /wp-json/strik/v1/sinterklaas-letter-orders?key=...&id=...
 * DELETE /wp-json/strik/v1/sinterklaas-letter-orders?key=...&id=...
 *
 * GET    /wp-json/strik/v1/sinterklaas-b2b-orders?key=...&year=2026
 * POST   /wp-json/strik/v1/sinterklaas-b2b-orders?key=...
 * PATCH  /wp-json/strik/v1/sinterklaas-b2b-orders?key=...&id=...
 * DELETE /wp-json/strik/v1/sinterklaas-b2b-orders?key=...&id=...
 */

if (!defined('STRIK_SINTERKLAAS_API_KEY')) {
    define('STRIK_SINTERKLAAS_API_KEY', 'schoonmaak-ijs-strik');
}

if (!defined('STRIK_SINTERKLAAS_LETTERS_OPTION_NAME')) {
    define('STRIK_SINTERKLAAS_LETTERS_OPTION_NAME', 'strik_sinterklaas_letter_orders');
}

if (!defined('STRIK_SINTERKLAAS_B2B_OPTION_NAME')) {
    define('STRIK_SINTERKLAAS_B2B_OPTION_NAME', 'strik_sinterklaas_b2b_orders');
}

if (!defined('STRIK_SINTERKLAAS_RECIPIENT')) {
    define('STRIK_SINTERKLAAS_RECIPIENT', 'info@strik-patisserie.nl');
}

if (!defined('STRIK_SINTERKLAAS_MAX_ORDERS')) {
    define('STRIK_SINTERKLAAS_MAX_ORDERS', 2500);
}

if (!function_exists('strik_sinterklaas_permission')) {
function strik_sinterklaas_permission($request) {
    return hash_equals(STRIK_SINTERKLAAS_API_KEY, (string) $request->get_param('key'))
        ? true
        : new WP_Error('strik_sinterklaas_forbidden', 'Geen toegang tot Sinterklaas bestellingen.', array('status' => 403));
}
}

if (!function_exists('strik_sinterklaas_text')) {
function strik_sinterklaas_text($value, $max_length = 240) {
    $value = trim((string) $value);
    if (strlen($value) > $max_length) {
        $value = substr($value, 0, $max_length);
    }

    return sanitize_text_field($value);
}
}

if (!function_exists('strik_sinterklaas_textarea')) {
function strik_sinterklaas_textarea($value, $max_length = 8000) {
    $value = trim((string) $value);
    if (strlen($value) > $max_length) {
        $value = substr($value, 0, $max_length);
    }

    return sanitize_textarea_field($value);
}
}

if (!function_exists('strik_sinterklaas_bool')) {
function strik_sinterklaas_bool($value) {
    if (is_bool($value)) return $value;

    $normalized = strtolower(trim((string) $value));
    return in_array($normalized, array('1', 'true', 'ja', 'yes', 'x', '✓', 'klaar'), true);
}
}

if (!function_exists('strik_sinterklaas_date')) {
function strik_sinterklaas_date($value) {
    $value = strik_sinterklaas_text($value, 40);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
}
}

if (!function_exists('strik_sinterklaas_year')) {
function strik_sinterklaas_year($value, $fallback_date = '') {
    $year = preg_replace('/[^0-9]/', '', (string) $value);
    if (strlen($year) === 4) return $year;

    $fallback_date = strik_sinterklaas_date($fallback_date);
    if ($fallback_date !== '') return substr($fallback_date, 0, 4);

    return wp_date('Y');
}
}

if (!function_exists('strik_sinterklaas_email')) {
function strik_sinterklaas_email($value) {
    $email = sanitize_email((string) $value);
    return is_email($email) ? $email : '';
}
}

if (!function_exists('strik_sinterklaas_get_orders')) {
function strik_sinterklaas_get_orders($option_name) {
    $orders = get_option($option_name, array());
    return is_array($orders) ? $orders : array();
}
}

if (!function_exists('strik_sinterklaas_save_orders')) {
function strik_sinterklaas_save_orders($option_name, $orders) {
    uasort($orders, function ($a, $b) {
        $a_date = isset($a['deliveryDate']) ? $a['deliveryDate'] : (isset($a['pickupDate']) ? $a['pickupDate'] : '');
        $b_date = isset($b['deliveryDate']) ? $b['deliveryDate'] : (isset($b['pickupDate']) ? $b['pickupDate'] : '');
        $date_compare = strcmp($a_date, $b_date);
        if ($date_compare) return $date_compare;

        return strcmp(
            isset($a['customerName']) ? $a['customerName'] : '',
            isset($b['customerName']) ? $b['customerName'] : ''
        );
    });

    $orders = array_slice($orders, 0, STRIK_SINTERKLAAS_MAX_ORDERS, true);
    update_option($option_name, $orders, false);
}
}

if (!function_exists('strik_sinterklaas_request_id')) {
function strik_sinterklaas_request_id($request) {
    $id = strik_sinterklaas_text($request->get_param('id'), 120);
    if ($id !== '') return $id;

    $params = $request->get_json_params();
    return is_array($params) && isset($params['id'])
        ? strik_sinterklaas_text($params['id'], 120)
        : '';
}
}

if (!function_exists('strik_sinterklaas_order_key')) {
function strik_sinterklaas_order_key($id) {
    return sanitize_key(strtolower((string) $id));
}
}

if (!function_exists('strik_sinterklaas_create_id')) {
function strik_sinterklaas_create_id($prefix, $customer_name = '') {
    $name = sanitize_key(substr(strtolower($customer_name), 0, 24));
    return sanitize_key($prefix . '-' . wp_date('ymd-His') . '-' . ($name !== '' ? $name : wp_generate_password(6, false)));
}
}

if (!function_exists('strik_sinterklaas_normalize_letter_order_number')) {
function strik_sinterklaas_normalize_letter_order_number($code) {
    $code = strtoupper(strik_sinterklaas_text($code, 80));

    if (!preg_match('/^CL([0-9]{2})-([0-9]+)$/', $code, $matches)) {
        return '';
    }

    return 'CL' . $matches[1] . '-' . str_pad((string) absint($matches[2]), 3, '0', STR_PAD_LEFT);
}
}

if (!function_exists('strik_sinterklaas_letter_order_year')) {
function strik_sinterklaas_letter_order_year($order) {
    $pickup_date = is_array($order) && isset($order['pickupDate']) ? $order['pickupDate'] : '';
    $year = is_array($order) && isset($order['year']) ? $order['year'] : '';

    return strik_sinterklaas_year($year, $pickup_date);
}
}

if (!function_exists('strik_sinterklaas_next_letter_order_number')) {
function strik_sinterklaas_next_letter_order_number($orders, $year) {
    $suffix = substr((string) $year, -2);
    $highest = 0;

    foreach ($orders as $order) {
        if (!is_array($order) || empty($order['code'])) continue;

        $code = strik_sinterklaas_normalize_letter_order_number($order['code']);
        if ($code === '') continue;

        if (preg_match('/^CL' . preg_quote($suffix, '/') . '-([0-9]+)$/', $code, $matches)) {
            $highest = max($highest, absint($matches[1]));
        }
    }

    return 'CL' . $suffix . '-' . str_pad((string) ($highest + 1), 3, '0', STR_PAD_LEFT);
}
}

if (!function_exists('strik_sinterklaas_assign_letter_order_number')) {
function strik_sinterklaas_assign_letter_order_number($order, $orders) {
    if (!is_array($order)) return $order;

    $normalized_code = strik_sinterklaas_normalize_letter_order_number(
        isset($order['code']) ? $order['code'] : ''
    );

    if ($normalized_code !== '') {
        $order['code'] = $normalized_code;
        return $order;
    }

    $year = strik_sinterklaas_letter_order_year($order);
    $order['year'] = $year;
    $order['code'] = strik_sinterklaas_next_letter_order_number($orders, $year);

    return $order;
}
}

if (!function_exists('strik_sinterklaas_ensure_letter_order_numbers')) {
function strik_sinterklaas_ensure_letter_order_numbers($orders) {
    $changed = false;

    foreach ($orders as $key => $order) {
        if (!is_array($order)) continue;

        $next_order = strik_sinterklaas_assign_letter_order_number($order, $orders);
        $old_code = isset($order['code']) ? (string) $order['code'] : '';
        $new_code = isset($next_order['code']) ? (string) $next_order['code'] : '';
        $old_year = isset($order['year']) ? (string) $order['year'] : '';
        $new_year = isset($next_order['year']) ? (string) $next_order['year'] : '';

        if ($old_code !== $new_code || $old_year !== $new_year) {
            $orders[$key] = $next_order;
            $changed = true;
        }
    }

    if ($changed) {
        strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_LETTERS_OPTION_NAME, $orders);
    }

    return $orders;
}
}

if (!function_exists('strik_sinterklaas_sanitize_letter_lines')) {
function strik_sinterklaas_sanitize_letter_lines($lines) {
    if (!is_array($lines)) return array();

    $clean = array();
    foreach (array_slice($lines, 0, 120) as $index => $line) {
        if (!is_array($line)) continue;

        $quantity = isset($line['quantity']) ? absint($line['quantity']) : 0;
        if ($quantity < 1) continue;

        $letter = isset($line['letter']) ? strtoupper(strik_sinterklaas_text($line['letter'], 12)) : '';
        if ($letter === '') continue;

        $clean[] = array(
            'id' => isset($line['id']) ? strik_sinterklaas_text($line['id'], 80) : 'line-' . ($index + 1),
            'letter' => $letter,
            'chocolate' => isset($line['chocolate']) ? strik_sinterklaas_text($line['chocolate'], 40) : 'melk',
            'size' => isset($line['size']) ? strik_sinterklaas_text($line['size'], 40) : 'groot',
            'style' => isset($line['style']) ? strik_sinterklaas_text($line['style'], 40) : 'spuit',
            'quantity' => $quantity,
            'logo' => !empty($line['logo']),
            'notes' => isset($line['notes']) ? strik_sinterklaas_text($line['notes'], 300) : '',
        );
    }

    return $clean;
}
}

if (!function_exists('strik_sinterklaas_sanitize_letter_order')) {
function strik_sinterklaas_sanitize_letter_order($order, $existing = array()) {
    if (!is_array($order)) return null;

    $customer_name = isset($order['customerName']) ? strik_sinterklaas_text($order['customerName'], 180) : '';
    $pickup_date = isset($order['pickupDate']) ? strik_sinterklaas_date($order['pickupDate']) : '';
    $lines = isset($order['lines']) ? strik_sinterklaas_sanitize_letter_lines($order['lines']) : array();

    if ($customer_name === '' || empty($lines)) return null;

    $id = isset($order['id']) ? strik_sinterklaas_text($order['id'], 120) : '';
    if ($id === '') {
        $id = strik_sinterklaas_create_id('letter', $customer_name);
    }

    $now = wp_date(DATE_ATOM);
    $source = isset($order['source']) ? strik_sinterklaas_text($order['source'], 40) : 'winkel';
    $source = $source === 'online' ? 'online' : 'winkel';

    return array(
        'id' => $id,
        'year' => strik_sinterklaas_year(isset($order['year']) ? $order['year'] : '', $pickup_date),
        'code' => isset($order['code']) ? strik_sinterklaas_text($order['code'], 80) : strtoupper(substr($id, 0, 10)),
        'customerName' => $customer_name,
        'customerEmail' => isset($order['customerEmail']) ? strik_sinterklaas_email($order['customerEmail']) : '',
        'phone' => isset($order['phone']) ? strik_sinterklaas_text($order['phone'], 80) : '',
        'shop' => isset($order['shop']) ? strik_sinterklaas_text($order['shop'], 120) : '',
        'pickupDate' => $pickup_date,
        'pickupLocation' => isset($order['pickupLocation']) ? strik_sinterklaas_text($order['pickupLocation'], 120) : '',
        'source' => $source,
        'sourceKey' => isset($order['sourceKey']) ? strik_sinterklaas_text($order['sourceKey'], 180) : '',
        'sourceImportedAt' => isset($order['sourceImportedAt']) ? strik_sinterklaas_text($order['sourceImportedAt'], 80) : '',
        'sourceBatch' => isset($order['sourceBatch']) ? strik_sinterklaas_text($order['sourceBatch'], 180) : '',
        'status' => isset($order['status']) ? strik_sinterklaas_text($order['status'], 60) : 'besteld',
        'notes' => isset($order['notes']) ? strik_sinterklaas_textarea($order['notes'], 1800) : '',
        'lines' => $lines,
        'sendCustomerEmail' => !empty($order['sendCustomerEmail']),
        'productionDone' => !empty($order['productionDone']),
        'productionDoneAt' => isset($order['productionDoneAt']) ? strik_sinterklaas_text($order['productionDoneAt'], 80) : '',
        'productionDoneBy' => isset($order['productionDoneBy']) ? strik_sinterklaas_text($order['productionDoneBy'], 120) : '',
        'pickedUp' => !empty($order['pickedUp']),
        'pickedUpAt' => isset($order['pickedUpAt']) ? strik_sinterklaas_text($order['pickedUpAt'], 80) : '',
        'bakeryEmailSentAt' => isset($order['bakeryEmailSentAt']) ? strik_sinterklaas_text($order['bakeryEmailSentAt'], 80) : '',
        'bakeryEmailError' => isset($order['bakeryEmailError']) ? strik_sinterklaas_text($order['bakeryEmailError'], 240) : '',
        'customerConfirmationSentAt' => isset($order['customerConfirmationSentAt']) ? strik_sinterklaas_text($order['customerConfirmationSentAt'], 80) : '',
        'customerConfirmationError' => isset($order['customerConfirmationError']) ? strik_sinterklaas_text($order['customerConfirmationError'], 240) : '',
        'createdAt' => isset($existing['createdAt']) ? $existing['createdAt'] : $now,
        'updatedAt' => $now,
    );
}
}

if (!function_exists('strik_sinterklaas_letter_summary_lines')) {
function strik_sinterklaas_letter_summary_lines($order) {
    $lines = array();
    foreach ($order['lines'] as $line) {
        $lines[] = sprintf(
            '- %sx %s %s %s %s%s',
            $line['quantity'],
            strtoupper($line['letter']),
            $line['size'],
            $line['style'],
            $line['chocolate'],
            !empty($line['logo']) ? ' met logo' : ''
        );

        if (!empty($line['notes'])) {
            $lines[] = '  Opmerking: ' . $line['notes'];
        }
    }

    return $lines;
}
}

if (!function_exists('strik_sinterklaas_create_letter_mail_body')) {
function strik_sinterklaas_create_letter_mail_body($order, $for_customer = false) {
    $lines = array(
        $for_customer ? 'Bedankt voor uw chocoladeletter bestelling bij Strik Patisserie.' : 'Nieuwe chocoladeletter bestelling.',
        '',
        'Klant: ' . $order['customerName'],
        'Ordernummer: ' . $order['code'],
        'Ophaaldatum: ' . ($order['pickupDate'] ?: '-'),
        'Ophaallocatie: ' . ($order['pickupLocation'] ?: $order['shop'] ?: '-'),
        'Telefoon: ' . ($order['phone'] ?: '-'),
        'E-mail: ' . ($order['customerEmail'] ?: '-'),
        '',
        'Bestelling:',
    );

    $lines = array_merge($lines, strik_sinterklaas_letter_summary_lines($order));

    if (!empty($order['notes'])) {
        $lines[] = '';
        $lines[] = 'Opmerking:';
        $lines[] = $order['notes'];
    }

    if ($for_customer) {
        $lines[] = '';
        $lines[] = 'Neem dit ordernummer mee bij het ophalen. Dan vinden we uw bestelling sneller.';
        $lines[] = '';
        $lines[] = 'We nemen contact op als er iets onduidelijk is. Deze bevestiging is automatisch verstuurd.';
    } else {
        $lines[] = '';
        $lines[] = 'Automatisch verstuurd vanuit de Strik Team app.';
    }

    return implode("\n", $lines);
}
}

if (!function_exists('strik_sinterklaas_send_letter_emails')) {
function strik_sinterklaas_send_letter_emails($order, $existing = array()) {
    if (!empty($order['source']) && $order['source'] === 'online') {
        return $order;
    }

    $headers = array('Content-Type: text/plain; charset=UTF-8');

    if (empty($order['bakeryEmailSentAt']) && empty($existing['bakeryEmailSentAt'])) {
        $sent = wp_mail(
            STRIK_SINTERKLAAS_RECIPIENT,
            'Chocoladeletters ' . $order['code'] . ' - ' . $order['customerName'] . ' - ' . ($order['pickupDate'] ?: 'geen datum'),
            strik_sinterklaas_create_letter_mail_body($order, false),
            $headers
        );

        if ($sent) {
            $order['bakeryEmailSentAt'] = wp_date(DATE_ATOM);
            $order['bakeryEmailError'] = '';
        } else {
            $order['bakeryEmailError'] = 'Mail naar bakkerij niet verstuurd.';
        }
    }

    if (
        !empty($order['sendCustomerEmail'])
        && $order['customerEmail'] !== ''
        && empty($order['customerConfirmationSentAt'])
        && empty($existing['customerConfirmationSentAt'])
    ) {
        $customer_headers = $headers;
        $customer_headers[] = 'Bcc: ' . STRIK_SINTERKLAAS_RECIPIENT;
        $sent_customer = wp_mail(
            $order['customerEmail'],
            'Bevestiging chocoladeletter bestelling ' . $order['code'] . ' - Strik Patisserie',
            strik_sinterklaas_create_letter_mail_body($order, true),
            $customer_headers
        );

        if ($sent_customer) {
            $order['customerConfirmationSentAt'] = wp_date(DATE_ATOM);
            $order['customerConfirmationError'] = '';
        } else {
            $order['customerConfirmationError'] = 'Bevestiging naar klant niet verstuurd.';
        }
    }

    return $order;
}
}

if (!function_exists('strik_sinterklaas_sanitize_b2b_order')) {
function strik_sinterklaas_sanitize_b2b_order($order, $existing = array()) {
    if (!is_array($order)) return null;

    $customer_name = isset($order['customerName']) ? strik_sinterklaas_text($order['customerName'], 180) : '';
    $order_text = isset($order['orderText']) ? strik_sinterklaas_textarea($order['orderText'], 5000) : '';
    $delivery_date = isset($order['deliveryDate']) ? strik_sinterklaas_date($order['deliveryDate']) : '';

    if ($customer_name === '' || $order_text === '') return null;

    $id = isset($order['id']) ? strik_sinterklaas_text($order['id'], 120) : '';
    if ($id === '') {
        $id = strik_sinterklaas_create_id('b2b', $customer_name);
    }

    $now = wp_date(DATE_ATOM);

    return array(
        'id' => $id,
        'year' => strik_sinterklaas_year(isset($order['year']) ? $order['year'] : '', $delivery_date),
        'season' => isset($order['season']) ? strik_sinterklaas_text($order['season'], 40) : 'sint',
        'customerName' => $customer_name,
        'contactName' => isset($order['contactName']) ? strik_sinterklaas_text($order['contactName'], 160) : '',
        'customerEmail' => isset($order['customerEmail']) ? strik_sinterklaas_email($order['customerEmail']) : '',
        'phone' => isset($order['phone']) ? strik_sinterklaas_text($order['phone'], 80) : '',
        'deliveryDate' => $delivery_date,
        'productionDate' => isset($order['productionDate']) ? strik_sinterklaas_date($order['productionDate']) : '',
        'department' => isset($order['department']) ? strik_sinterklaas_text($order['department'], 80) : 'chocolade',
        'orderText' => $order_text,
        'logo' => isset($order['logo']) ? strik_sinterklaas_textarea($order['logo'], 1000) : '',
        'packaging' => isset($order['packaging']) ? strik_sinterklaas_textarea($order['packaging'], 1000) : '',
        'importantNotes' => isset($order['importantNotes']) ? strik_sinterklaas_textarea($order['importantNotes'], 2000) : '',
        'priceAgreement' => isset($order['priceAgreement']) ? strik_sinterklaas_text($order['priceAgreement'], 300) : '',
        'totalExVat' => isset($order['totalExVat']) ? strik_sinterklaas_text($order['totalExVat'], 120) : '',
        'deliveryMethod' => isset($order['deliveryMethod']) ? strik_sinterklaas_text($order['deliveryMethod'], 160) : '',
        'deliveryAddress' => isset($order['deliveryAddress']) ? strik_sinterklaas_textarea($order['deliveryAddress'], 1400) : '',
        'invoiceInfo' => isset($order['invoiceInfo']) ? strik_sinterklaas_textarea($order['invoiceInfo'], 2200) : '',
        'source' => isset($order['source']) ? strik_sinterklaas_text($order['source'], 80) : 'handmatig',
        'sourceSheet' => isset($order['sourceSheet']) ? strik_sinterklaas_text($order['sourceSheet'], 120) : '',
        'entered' => !empty($order['entered']),
        'productionDone' => !empty($order['productionDone']),
        'packed' => !empty($order['packed']),
        'delivered' => !empty($order['delivered']),
        'cancelled' => !empty($order['cancelled']),
        'productionDoneAt' => isset($order['productionDoneAt']) ? strik_sinterklaas_text($order['productionDoneAt'], 80) : '',
        'packedAt' => isset($order['packedAt']) ? strik_sinterklaas_text($order['packedAt'], 80) : '',
        'deliveredAt' => isset($order['deliveredAt']) ? strik_sinterklaas_text($order['deliveredAt'], 80) : '',
        'reminderEmailedAt' => isset($order['reminderEmailedAt']) ? strik_sinterklaas_text($order['reminderEmailedAt'], 80) : '',
        'reminderEmailError' => isset($order['reminderEmailError']) ? strik_sinterklaas_text($order['reminderEmailError'], 240) : '',
        'createdAt' => isset($existing['createdAt']) ? $existing['createdAt'] : $now,
        'updatedAt' => $now,
    );
}
}

if (!function_exists('strik_sinterklaas_filter_orders')) {
function strik_sinterklaas_filter_orders($orders, $request, $date_key) {
    $year = strik_sinterklaas_text($request->get_param('year'), 4);
    $search = strtolower(strik_sinterklaas_text($request->get_param('search'), 120));

    $filtered = array();
    foreach ($orders as $order) {
        if (!is_array($order)) continue;

        if ($year !== '') {
            $order_year = isset($order['year']) ? (string) $order['year'] : '';
            $order_date = isset($order[$date_key]) ? (string) $order[$date_key] : '';
            if ($order_year !== $year && substr($order_date, 0, 4) !== $year) {
                continue;
            }
        }

        if ($search !== '') {
            $haystack = strtolower(implode(' ', array(
                isset($order['customerName']) ? $order['customerName'] : '',
                isset($order['code']) ? $order['code'] : '',
                isset($order['source']) ? $order['source'] : '',
                isset($order['sourceBatch']) ? $order['sourceBatch'] : '',
                isset($order['sourceKey']) ? $order['sourceKey'] : '',
                isset($order['orderText']) ? $order['orderText'] : '',
                isset($order[$date_key]) ? $order[$date_key] : '',
            )));

            if (strpos($haystack, $search) === false) continue;
        }

        $filtered[] = $order;
    }

    usort($filtered, function ($a, $b) use ($date_key) {
        $date_compare = strcmp(
            isset($a[$date_key]) ? $a[$date_key] : '',
            isset($b[$date_key]) ? $b[$date_key] : ''
        );
        if ($date_compare) return $date_compare;

        return strcmp(
            isset($a['customerName']) ? $a['customerName'] : '',
            isset($b['customerName']) ? $b['customerName'] : ''
        );
    });

    return $filtered;
}
}

if (!function_exists('strik_sinterklaas_letter_get')) {
function strik_sinterklaas_letter_get($request) {
    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_LETTERS_OPTION_NAME);
    $orders = strik_sinterklaas_ensure_letter_order_numbers($orders);
    $filtered = strik_sinterklaas_filter_orders($orders, $request, 'pickupDate');

    return rest_ensure_response(array(
        'orders' => array_values($filtered),
        'total' => count($filtered),
        'generatedAt' => wp_date(DATE_ATOM),
    ));
}
}

if (!function_exists('strik_sinterklaas_letter_save')) {
function strik_sinterklaas_letter_save($request, $send_emails = true) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error('strik_sinterklaas_invalid_json', 'Geen geldige letterbestelling ontvangen.', array('status' => 400));
    }

    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_LETTERS_OPTION_NAME);
    $id = isset($params['id']) ? strik_sinterklaas_text($params['id'], 120) : '';
    $existing = $id !== '' && isset($orders[strik_sinterklaas_order_key($id)])
        ? $orders[strik_sinterklaas_order_key($id)]
        : array();
    $order = strik_sinterklaas_sanitize_letter_order(array_merge(is_array($existing) ? $existing : array(), $params), is_array($existing) ? $existing : array());

    if ($order === null) {
        return new WP_Error('strik_sinterklaas_invalid_letter_order', 'Vul minimaal klantnaam en letters in.', array('status' => 400));
    }

    $order = strik_sinterklaas_assign_letter_order_number($order, $orders);

    if ($send_emails) {
        $order = strik_sinterklaas_send_letter_emails($order, is_array($existing) ? $existing : array());
    }

    $orders[strik_sinterklaas_order_key($order['id'])] = $order;
    strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_LETTERS_OPTION_NAME, $orders);

    return rest_ensure_response($order);
}
}

if (!function_exists('strik_sinterklaas_letter_patch')) {
function strik_sinterklaas_letter_patch($request) {
    return strik_sinterklaas_letter_save($request, false);
}
}

if (!function_exists('strik_sinterklaas_b2b_get')) {
function strik_sinterklaas_b2b_get($request) {
    strik_sinterklaas_maybe_send_b2b_reminders();
    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $filtered = strik_sinterklaas_filter_orders($orders, $request, 'deliveryDate');

    return rest_ensure_response(array(
        'orders' => array_values($filtered),
        'total' => count($filtered),
        'generatedAt' => wp_date(DATE_ATOM),
    ));
}
}

if (!function_exists('strik_sinterklaas_b2b_save')) {
function strik_sinterklaas_b2b_save($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error('strik_sinterklaas_invalid_json', 'Geen geldige B2B-bestelling ontvangen.', array('status' => 400));
    }

    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $id = isset($params['id']) ? strik_sinterklaas_text($params['id'], 120) : '';
    $existing = $id !== '' && isset($orders[strik_sinterklaas_order_key($id)])
        ? $orders[strik_sinterklaas_order_key($id)]
        : array();
    $order = strik_sinterklaas_sanitize_b2b_order(array_merge(is_array($existing) ? $existing : array(), $params), is_array($existing) ? $existing : array());

    if ($order === null) {
        return new WP_Error('strik_sinterklaas_invalid_b2b_order', 'Vul minimaal klantnaam en bestelling in.', array('status' => 400));
    }

    $orders[strik_sinterklaas_order_key($order['id'])] = $order;
    strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);

    return rest_ensure_response($order);
}
}

if (!function_exists('strik_sinterklaas_delete_order')) {
function strik_sinterklaas_delete_order($request, $option_name) {
    $id = strik_sinterklaas_request_id($request);
    if ($id === '') {
        return new WP_Error('strik_sinterklaas_missing_id', 'Geen bestelling gekozen om te verwijderen.', array('status' => 400));
    }

    $orders = strik_sinterklaas_get_orders($option_name);
    $key = strik_sinterklaas_order_key($id);

    if (!isset($orders[$key])) {
        return rest_ensure_response(array('deleted' => false, 'id' => $id));
    }

    unset($orders[$key]);
    strik_sinterklaas_save_orders($option_name, $orders);

    return rest_ensure_response(array('deleted' => true, 'id' => $id));
}
}

if (!function_exists('strik_sinterklaas_letter_delete')) {
function strik_sinterklaas_letter_delete($request) {
    return strik_sinterklaas_delete_order($request, STRIK_SINTERKLAAS_LETTERS_OPTION_NAME);
}
}

if (!function_exists('strik_sinterklaas_b2b_delete')) {
function strik_sinterklaas_b2b_delete($request) {
    return strik_sinterklaas_delete_order($request, STRIK_SINTERKLAAS_B2B_OPTION_NAME);
}
}

if (!function_exists('strik_sinterklaas_create_b2b_reminder_body')) {
function strik_sinterklaas_create_b2b_reminder_body($order) {
    $lines = array(
        'Sinterklaas B2B-bestelling over 2 dagen.',
        '',
        'Klant: ' . $order['customerName'],
        'Leverdatum: ' . ($order['deliveryDate'] ?: '-'),
        'Productiedatum: ' . ($order['productionDate'] ?: '-'),
        'Afdeling: ' . ($order['department'] ?: '-'),
        'Levering: ' . ($order['deliveryMethod'] ?: '-'),
        '',
        'Bestelling:',
        $order['orderText'],
    );

    if (!empty($order['packaging'])) {
        $lines[] = '';
        $lines[] = 'Verpakken:';
        $lines[] = $order['packaging'];
    }

    if (!empty($order['importantNotes'])) {
        $lines[] = '';
        $lines[] = 'Belangrijk:';
        $lines[] = $order['importantNotes'];
    }

    if (!empty($order['deliveryAddress'])) {
        $lines[] = '';
        $lines[] = 'Adres:';
        $lines[] = $order['deliveryAddress'];
    }

    $lines[] = '';
    $lines[] = 'Automatische herinnering vanuit de Strik Team app.';
    $lines[] = 'Order-id: ' . $order['id'];

    return implode("\n", $lines);
}
}

if (!function_exists('strik_sinterklaas_maybe_send_b2b_reminders')) {
function strik_sinterklaas_maybe_send_b2b_reminders() {
    if (get_transient('strik_sinterklaas_b2b_reminder_check')) {
        return;
    }

    set_transient('strik_sinterklaas_b2b_reminder_check', '1', HOUR_IN_SECONDS);

    $target_date = wp_date('Y-m-d', current_time('timestamp') + (2 * DAY_IN_SECONDS));
    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $changed = false;

    foreach ($orders as $key => $order) {
        if (!is_array($order)) continue;
        if (!empty($order['cancelled']) || !empty($order['productionDone'])) continue;
        if (!empty($order['reminderEmailedAt'])) continue;
        if (empty($order['deliveryDate']) || $order['deliveryDate'] !== $target_date) continue;

        $sent = wp_mail(
            STRIK_SINTERKLAAS_RECIPIENT,
            'Reminder Sinterklaas B2B - ' . $order['customerName'] . ' - ' . $order['deliveryDate'],
            strik_sinterklaas_create_b2b_reminder_body($order),
            array('Content-Type: text/plain; charset=UTF-8')
        );

        if ($sent) {
            $orders[$key]['reminderEmailedAt'] = wp_date(DATE_ATOM);
            $orders[$key]['reminderEmailError'] = '';
        } else {
            $orders[$key]['reminderEmailError'] = 'Reminder niet verstuurd.';
        }

        $changed = true;
    }

    if ($changed) {
        strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
    }
}
}

add_action('init', 'strik_sinterklaas_maybe_send_b2b_reminders');

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/sinterklaas-letter-orders', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_sinterklaas_letter_get',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_sinterklaas_letter_save',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_sinterklaas_letter_patch',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
        array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => 'strik_sinterklaas_letter_delete',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
    ));

    register_rest_route('strik/v1', '/sinterklaas-b2b-orders', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_sinterklaas_b2b_get',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_sinterklaas_b2b_save',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_sinterklaas_b2b_save',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
        array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => 'strik_sinterklaas_b2b_delete',
            'permission_callback' => 'strik_sinterklaas_permission',
        ),
    ));
});
