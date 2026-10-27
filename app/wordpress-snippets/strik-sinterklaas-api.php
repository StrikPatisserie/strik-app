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

if (!defined('STRIK_SINTERKLAAS_MAILING_OPTION_NAME')) {
    define('STRIK_SINTERKLAAS_MAILING_OPTION_NAME', 'strik_sinterklaas_mailing_campaigns');
}

if (!defined('STRIK_SINTERKLAAS_MAIL_TEMPLATE_VERSION')) {
    define('STRIK_SINTERKLAAS_MAIL_TEMPLATE_VERSION', 'strik-html-v4');
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

if (!function_exists('strik_sinterklaas_letter_paid_amount')) {
function strik_sinterklaas_letter_paid_amount($order) {
    if (!is_array($order)) return 0;
    if (isset($order['paidAmountCents'])) return absint($order['paidAmountCents']);
    return !empty($order['paid']) && isset($order['totalCents']) ? absint($order['totalCents']) : 0;
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

if (!function_exists('strik_sinterklaas_ensure_letter_payment_amounts')) {
function strik_sinterklaas_ensure_letter_payment_amounts($orders) {
    $changed = false;

    foreach ($orders as $key => $order) {
        if (!is_array($order)) continue;

        $total_cents = isset($order['totalCents']) ? absint($order['totalCents']) : 0;
        $paid_amount_cents = strik_sinterklaas_letter_paid_amount($order);
        $fully_paid = $total_cents > 0 && $paid_amount_cents >= $total_cents;

        if (!isset($order['paidAmountCents']) || absint($order['paidAmountCents']) !== $paid_amount_cents || !isset($order['paid']) || !empty($order['paid']) !== $fully_paid) {
            $order['paidAmountCents'] = $paid_amount_cents;
            $order['paid'] = $fully_paid;
            $orders[$key] = $order;
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
            'specialRequests' => isset($line['specialRequests']) && is_array($line['specialRequests'])
                ? array_values(array_intersect(array('glutenvrij', 'notenvrij', 'vegan', 'lactosevrij'), $line['specialRequests']))
                : array(),
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
    $total_cents = isset($order['totalCents']) ? absint($order['totalCents']) : 0;
    $existing_paid_amount_cents = strik_sinterklaas_letter_paid_amount($existing);
    if (array_key_exists('paidAmountCents', $order)) {
        $submitted_paid_amount_cents = min(absint($order['paidAmountCents']), $total_cents);
    } elseif ($existing_paid_amount_cents === 0 && !empty($order['paid'])) {
        $submitted_paid_amount_cents = $total_cents;
    } else {
        $submitted_paid_amount_cents = $existing_paid_amount_cents;
    }
    $paid_amount_cents = max($existing_paid_amount_cents, $submitted_paid_amount_cents);
    $fully_paid = $total_cents > 0 && $paid_amount_cents >= $total_cents;
    $paid_at = $paid_amount_cents > 0
        ? (isset($order['paidAt']) && $order['paidAt'] !== '' ? strik_sinterklaas_text($order['paidAt'], 80) : $now)
        : '';

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
        'giftWrap' => !empty($order['giftWrap']),
        'paid' => $fully_paid,
        'paidAmountCents' => $paid_amount_cents,
        'paidAt' => $paid_at,
        'totalCents' => $total_cents,
        'productionDone' => !empty($order['productionDone']),
        'productionDoneAt' => isset($order['productionDoneAt']) ? strik_sinterklaas_text($order['productionDoneAt'], 80) : '',
        'productionDoneBy' => isset($order['productionDoneBy']) ? strik_sinterklaas_text($order['productionDoneBy'], 120) : '',
        'pickedUp' => !empty($order['pickedUp']),
        'pickedUpAt' => isset($order['pickedUpAt']) ? strik_sinterklaas_text($order['pickedUpAt'], 80) : '',
        'bakeryEmailSentAt' => isset($order['bakeryEmailSentAt']) ? strik_sinterklaas_text($order['bakeryEmailSentAt'], 80) : '',
        'bakeryEmailError' => isset($order['bakeryEmailError']) ? strik_sinterklaas_text($order['bakeryEmailError'], 240) : '',
        'customerConfirmationSentAt' => isset($order['customerConfirmationSentAt']) ? strik_sinterklaas_text($order['customerConfirmationSentAt'], 80) : '',
        'customerConfirmationError' => isset($order['customerConfirmationError']) ? strik_sinterklaas_text($order['customerConfirmationError'], 240) : '',
        'customerReminderSentForDate' => isset($order['customerReminderSentForDate']) ? strik_sinterklaas_date($order['customerReminderSentForDate']) : '',
        'customerReminderError' => isset($order['customerReminderError']) ? strik_sinterklaas_text($order['customerReminderError'], 240) : '',
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
        if (!empty($line['specialRequests'])) {
            $lines[] = '  Speciaal: ' . implode(', ', $line['specialRequests']);
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

    if (!empty($order['giftWrap'])) $lines[] = 'Alles in cadeaupapier';
    if (!empty($order['totalCents'])) {
        $lines[] = 'Prijs: € ' . number_format($order['totalCents'] / 100, 2, ',', '.');
        $paid_amount_cents = strik_sinterklaas_letter_paid_amount($order);
        $open_amount_cents = max(0, absint($order['totalCents']) - $paid_amount_cents);
        if ($paid_amount_cents > 0) $lines[] = 'Betaald: € ' . number_format($paid_amount_cents / 100, 2, ',', '.');
        if ($open_amount_cents > 0) $lines[] = 'Nog open: € ' . number_format($open_amount_cents / 100, 2, ',', '.');
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

if (!function_exists('strik_sinterklaas_letter_mail_html')) {
function strik_sinterklaas_letter_mail_html($order, $reminder = false, $updated = false, $internal = false) {
    $name = esc_html($order['customerName']);
    $code = esc_html($order['code']);
    $date = !empty($order['pickupDate']) ? esc_html(date('d-m-Y', strtotime($order['pickupDate']))) : '-';
    $shops = array(
        'Ziekerstraat' => 'Strik Centrum · Ziekerstraat 124',
        'Heyendaal' => 'Strik Brakkenstein · Heyendaalseweg 217',
        'Daalseweg' => 'Strik Nijmegen-Oost · Daalseweg 254',
        'Lent' => 'Strik Lent · Oranje Marieplein 11',
    );
    $shop_key = !empty($order['pickupLocation']) ? $order['pickupLocation'] : $order['shop'];
    $shop = esc_html(isset($shops[$shop_key]) ? $shops[$shop_key] : $shop_key);
    $title = $reminder ? 'Morgen is het zover!' : ($updated ? 'Uw bestelling is aangepast' : 'Uw chocoladeletters zijn besteld!');
    $intro = $reminder
        ? 'Morgen liggen uw chocoladeletters voor u klaar. We zien u graag in de winkel!'
        : ($updated ? 'Hieronder vindt u de nieuwste gegevens van uw chocoladeletterbestelling.' : 'Wat leuk dat u chocoladeletters bij Strik heeft besteld. Wij maken ze met zorg voor u klaar.');
    if ($internal) $title = $updated ? 'Gewijzigde winkelbestelling' : 'Nieuwe winkelbestelling';
    $items = '';
    $has_special_request = false;
    foreach ($order['lines'] as $line) {
        $description = strtoupper($line['letter']) . ' · ' . $line['chocolate'] . ' · ' . $line['style'] . ' · ' . $line['size'];
        if (!empty($line['logo'])) $description .= ' · met logo';
        if (!empty($line['specialRequests'])) {
            $description .= ' · ' . implode(', ', $line['specialRequests']);
            $has_special_request = true;
        }
        $line_notes = $internal && !empty($line['notes'])
            ? '<div style="margin-top:5px;font-size:13px;line-height:1.5;color:#536b57;">Opmerking: ' . nl2br(esc_html($line['notes'])) . '</div>'
            : '';
        $items .= '<tr><td style="padding:9px 0;border-bottom:1px solid #edf0e9;font-size:14px;color:#293c2e;"><strong>' . absint($line['quantity']) . '×</strong> ' . esc_html($description) . $line_notes . '</td></tr>';
    }
    $wrap = !empty($order['giftWrap']) ? '<p style="margin:12px 0 0;font-size:14px;color:#536b57;">🎁 Alles feestelijk ingepakt in cadeaupapier.</p>' : '';
    $allergen_note = $has_special_request ? '<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#755b4f;">Let op: chocoladeletters kunnen altijd sporen van allergenen bevatten. Bij een ernstige allergie raden we consumptie af.</p>' : '';
    $price = !empty($order['totalCents']) ? '<p style="margin:12px 0 0;font-size:16px;color:#263b2b;"><strong>Totaal: € ' . esc_html(number_format($order['totalCents'] / 100, 2, ',', '.')) . '</strong></p>' : '';
    $paid_amount_cents = strik_sinterklaas_letter_paid_amount($order);
    $open_amount_cents = max(0, (isset($order['totalCents']) ? absint($order['totalCents']) : 0) - $paid_amount_cents);
    if ($paid_amount_cents > 0 && $open_amount_cents > 0) {
        $payment = 'Er is al € ' . number_format($paid_amount_cents / 100, 2, ',', '.') . ' betaald. Nog open bij afhalen: € ' . number_format($open_amount_cents / 100, 2, ',', '.') . '.';
    } elseif ($paid_amount_cents > 0) {
        $payment = 'Deze bestelling is volledig afgerekend.';
    } else {
        $payment = 'U betaalt bij het afhalen in de winkel.';
    }
    $heading = $reminder ? 'Ophaalherinnering' : ($updated ? 'Gewijzigde bestelling' : 'Bestelbevestiging');
    if ($internal) $heading = $updated ? 'Gewijzigde interne bestelkopie' : 'Interne bestelkopie';
    $greeting = $internal
        ? '<p style="margin:0 0 18px;font-size:16px;line-height:1.55;"><strong>Klant:</strong> ' . $name . '</p>'
        : '<p style="margin:0 0 14px;font-size:16px;line-height:1.55;">Beste ' . $name . ',</p><p style="margin:0 0 22px;font-size:16px;line-height:1.55;">' . esc_html($intro) . '</p>';
    $contacts = '';
    $notes = '';
    if ($internal) {
        $phone = !empty($order['phone']) ? esc_html($order['phone']) : 'Niet opgegeven';
        $email = !empty($order['customerEmail'])
            ? '<a href="' . esc_attr('mailto:' . $order['customerEmail']) . '" style="color:#244b37;">' . esc_html($order['customerEmail']) . '</a>'
            : 'Niet opgegeven';
        $contacts = '<p style="margin:12px 0 7px;font-size:15px;"><strong>Telefoon:</strong> ' . $phone . '</p><p style="margin:0;font-size:15px;"><strong>E-mail:</strong> ' . $email . '</p>';
        if (!empty($order['notes'])) $notes = '<h2 style="margin:20px 0 7px;font-size:17px;">Opmerkingen</h2><p style="margin:0;font-size:14px;line-height:1.55;">' . nl2br(esc_html($order['notes'])) . '</p>';
    }
    $payment_html = $internal
        ? '<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#536b57;"><strong>Betaald:</strong> € ' . esc_html(number_format($paid_amount_cents / 100, 2, ',', '.')) . '<br><strong>Nog open:</strong> € ' . esc_html(number_format($open_amount_cents / 100, 2, ',', '.')) . '</p>'
        : '<p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:#536b57;">' . esc_html($payment) . ' Neem bij het afhalen gerust dit ordernummer mee: <strong>' . $code . '</strong>.</p>';
    $closing = $internal
        ? 'Automatische interne back-up · aangenomen in de winkel.<br>De bestelling staat ook in de Strik Team app.'
        : 'Vragen of verhinderd? Neem dan even contact met ons op.<br><strong>Tot snel bij Strik!</strong>';
    $origin_badge = $internal
        ? '<p style="display:inline-block;margin:16px 0 0;padding:7px 10px;background:#e8cf90;border-radius:6px;color:#244b37;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Winkelbestelling · interne back-up</p>'
        : '';
    $origin_band = $internal
        ? '<tr><td style="padding:12px 28px;background:#faf3df;border-left:5px solid #e8cf90;font-size:13px;font-weight:700;color:#244b37;">Chocoladeletters · aangenomen in de winkel</td></tr>'
        : '';

    return '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#edf4ec;font-family:Arial,Helvetica,sans-serif;color:#263b2b;">'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;margin:0 auto;border-collapse:collapse;"><tr><td style="padding:25px 28px;background:#244b37;color:#fff;border-radius:16px 16px 0 0;">'
        . '<div style="font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#e8cf90;">Strik Patisserie</div>' . $origin_badge . '<h1 style="margin:14px 0 0;font-size:27px;line-height:1.2;color:#fff;">' . esc_html($title) . '</h1></td></tr>'
        . $origin_band
        . '<tr><td style="padding:25px 28px;background:#fffdf8;border-radius:0 0 16px 16px;">'
        . $greeting
        . '<div style="padding:18px;background:#f1f7ef;border-radius:12px;"><p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#547762;">' . esc_html($heading) . ' · ' . $code . '</p>'
        . '<p style="margin:0 0 7px;font-size:16px;"><strong>Afhalen:</strong> ' . $date . '</p><p style="margin:0;font-size:15px;"><strong>Winkel:</strong> ' . $shop . '</p>' . $contacts . '</div>'
        . '<h2 style="margin:22px 0 7px;font-size:17px;">' . ($internal ? 'Bestelling' : 'Uw bestelling') . '</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' . $items . '</table>'
        . $notes . $wrap . $allergen_note . $price . $payment_html
        . '<p style="margin:24px 0 0;font-size:14px;line-height:1.5;">' . $closing . '</p>'
        . '</td></tr><tr><td style="padding:16px;text-align:center;font-size:12px;color:#65806a;">Met liefde gemaakt door Strik Patisserie</td></tr></table></body></html>';
}
}

if (!function_exists('strik_sinterklaas_letter_customer_mail_html')) {
function strik_sinterklaas_letter_customer_mail_html($order, $reminder = false, $updated = false) {
    return strik_sinterklaas_letter_mail_html($order, $reminder, $updated);
}
}

if (!function_exists('strik_sinterklaas_letter_internal_details')) {
function strik_sinterklaas_letter_internal_details($order) {
    $details = array();
    foreach (array('customerName', 'customerEmail', 'phone', 'pickupDate', 'pickupLocation', 'shop', 'notes', 'totalCents', 'giftWrap') as $field) {
        $details[$field] = isset($order[$field]) ? $order[$field] : '';
    }
    $details['lines'] = array_map(function ($line) {
        unset($line['id']);
        return $line;
    }, isset($order['lines']) && is_array($order['lines']) ? $order['lines'] : array());
    return $details;
}
}

if (!function_exists('strik_sinterklaas_send_letter_emails')) {
function strik_sinterklaas_send_letter_emails($order, $existing = array(), $internal_changed = false) {
    if (!empty($order['source']) && $order['source'] === 'online') {
        return $order;
    }

    $headers = array(
        'Content-Type: text/html; charset=UTF-8',
        'From: Strik Patisserie <info@strik-patisserie.nl>',
        'Reply-To: info@strik-patisserie.nl',
    );

    if ((empty($order['bakeryEmailSentAt']) && empty($existing['bakeryEmailSentAt'])) || $internal_changed) {
        $internal_updated = !empty($existing['bakeryEmailSentAt']);
        $order['bakeryEmailSentAt'] = '';
        $sent = wp_mail(
            STRIK_SINTERKLAAS_RECIPIENT,
            ($internal_updated ? 'Gewijzigde winkelbestelling chocoladeletters ' : 'Winkelbestelling chocoladeletters ') . $order['code'] . ' - ' . $order['customerName'] . ' - ' . ($order['pickupDate'] ?: 'geen datum'),
            strik_sinterklaas_letter_mail_html($order, false, $internal_updated, true),
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
    ) {
        $updated = !empty($existing['customerConfirmationSentAt']);
        $customer_headers = array(
            'Content-Type: text/html; charset=UTF-8',
            'From: Strik Patisserie <info@strik-patisserie.nl>',
            'Reply-To: info@strik-patisserie.nl',
        );
        $sent_customer = wp_mail(
            $order['customerEmail'],
            ($updated ? 'Uw chocoladeletterbestelling is aangepast: ' : 'Bevestiging chocoladeletter bestelling ') . $order['code'] . ' - Strik Patisserie',
            strik_sinterklaas_letter_customer_mail_html($order, false, $updated),
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

if (!function_exists('strik_sinterklaas_send_letter_reminders')) {
function strik_sinterklaas_send_letter_reminders($request) {
    $tomorrow = (new DateTimeImmutable('now', new DateTimeZone('Europe/Amsterdam')))->modify('+1 day')->format('Y-m-d');
    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_LETTERS_OPTION_NAME);
    $sent = 0;
    $failed = 0;

    foreach ($orders as $key => $order) {
        if (!is_array($order)) continue;
        if (isset($order['source']) && $order['source'] !== 'winkel') continue;
        if (empty($order['sendCustomerEmail']) || empty($order['customerEmail']) || !is_email($order['customerEmail'])) continue;
        if (!isset($order['pickupDate']) || $order['pickupDate'] !== $tomorrow) continue;
        if (!empty($order['pickedUp']) || (isset($order['status']) && in_array($order['status'], array('opgehaald', 'geannuleerd'), true))) continue;
        if (isset($order['customerReminderSentForDate']) && $order['customerReminderSentForDate'] === $tomorrow) continue;

        $ok = wp_mail(
            $order['customerEmail'],
            'Morgen liggen uw chocoladeletters klaar - Strik Patisserie',
            strik_sinterklaas_letter_customer_mail_html($order, true),
            array(
                'Content-Type: text/html; charset=UTF-8',
                'From: Strik Patisserie <info@strik-patisserie.nl>',
                'Reply-To: info@strik-patisserie.nl',
            )
        );
        if ($ok) {
            $order['customerReminderSentForDate'] = $tomorrow;
            $order['customerReminderError'] = '';
            $sent++;
        } else {
            $order['customerReminderError'] = 'WordPress kon de e-mail niet versturen.';
            $failed++;
        }
        $orders[$key] = $order;
        strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_LETTERS_OPTION_NAME, $orders);
    }

    return rest_ensure_response(array('date' => $tomorrow, 'sent' => $sent, 'failed' => $failed));
}
}

if (!function_exists('strik_sinterklaas_sanitize_b2b_order')) {
function strik_sinterklaas_sanitize_b2b_letter_lines($lines) {
    if (!is_array($lines) || count($lines) > 120) return array();
    $clean = array();
    foreach ($lines as $index => $line) {
        if (!is_array($line)) continue;
        $letter = isset($line['letter']) ? strtoupper(strik_sinterklaas_text($line['letter'], 12)) : '';
        $style = isset($line['style']) ? strik_sinterklaas_text($line['style'], 12) : '';
        $chocolate = isset($line['chocolate']) ? strik_sinterklaas_text($line['chocolate'], 12) : '';
        $size = isset($line['size']) ? strik_sinterklaas_text($line['size'], 12) : '';
        $quantity = isset($line['quantity']) ? intval($line['quantity']) : 0;
        $exceptions = isset($line['exceptions']) ? $line['exceptions'] : array();
        if (!is_array($exceptions)) continue;
        foreach ($exceptions as $exception) {
            if (!is_string($exception) || !in_array($exception, array('notenvrij', 'vegan', 'glutenvrij', 'lactosevrij'), true)) continue 2;
        }
        if (!preg_match('/^[A-Z]$/', $letter) || !in_array($chocolate, array('melk', 'puur', 'wit'), true) || !in_array($style, array('spuit', 'vorm'), true) || !in_array($size, array('groot', 'klein'), true) || $quantity < 1 || $quantity > 10000) continue;
        if ($style === 'vorm' && ($size !== 'groot' || !in_array($letter, array('A', 'B', 'S', 'P', 'M', 'Q'), true))) continue;
        $clean[] = array(
            'id' => isset($line['id']) ? strik_sinterklaas_text($line['id'], 80) : 'b2b-line-' . ($index + 1),
            'letter' => $letter,
            'chocolate' => $chocolate,
            'style' => $style,
            'size' => $size,
            'quantity' => $quantity,
            'exceptions' => array_values(array_unique($exceptions)),
            'withLogo' => isset($line['withLogo']) ? $line['withLogo'] === true : null,
        );
    }
    return $clean;
}

function strik_sinterklaas_sanitize_b2b_order($order, $existing = array()) {
    if (!is_array($order)) return null;

    $customer_name = isset($order['customerName']) ? strik_sinterklaas_text($order['customerName'], 180) : '';
    $order_text = isset($order['orderText']) ? strik_sinterklaas_textarea($order['orderText'], !empty($existing['folderQuote']) ? 50000 : 5000) : '';
    $delivery_window_type = isset($order['deliveryWindowType']) ? strik_sinterklaas_text($order['deliveryWindowType'], 20) : 'date';
    if (!in_array($delivery_window_type, array('date', 'range', 'week'), true)) $delivery_window_type = 'date';
    $delivery_date = isset($order['deliveryDate']) ? strik_sinterklaas_date($order['deliveryDate']) : '';
    $delivery_date_end = isset($order['deliveryDateEnd']) ? strik_sinterklaas_date($order['deliveryDateEnd']) : '';
    $delivery_week = isset($order['deliveryWeek']) ? strik_sinterklaas_text($order['deliveryWeek'], 12) : '';
    $letter_lines = isset($order['letterLines']) ? strik_sinterklaas_sanitize_b2b_letter_lines($order['letterLines']) : array();

    if (isset($order['letterLines']) && (!is_array($order['letterLines']) || count($letter_lines) !== count($order['letterLines']))) return null;

    if ($customer_name === '') return null;
    if ($delivery_window_type === 'range' && ($delivery_date === '' || $delivery_date_end === '' || $delivery_date_end < $delivery_date)) return null;
    if ($delivery_window_type === 'week' && !preg_match('/^\d{4}-W\d{2}$/', $delivery_week)) return null;

    $id = isset($order['id']) ? strik_sinterklaas_text($order['id'], 120) : '';
    if ($id === '') {
        $id = strik_sinterklaas_create_id('b2b', $customer_name);
    }

    $now = wp_date(DATE_ATOM);
    $status = isset($order['status']) ? strik_sinterklaas_text($order['status'], 20) : 'akkoord';
    if (!in_array($status, array('aanvraag', 'offerte', 'akkoord', 'afgewezen'), true)) $status = 'aanvraag';
    if ($status === 'akkoord' && ($delivery_date === '' || $order_text === '')) return null;
    $department = isset($order['department']) ? strik_sinterklaas_text($order['department'], 80) : 'chocolade';
    if ($status === 'akkoord' && $department !== 'bakkerij' && empty($letter_lines) && (empty($existing) || (isset($existing['status']) && $existing['status'] !== 'akkoord')) && (!isset($order['source']) || $order['source'] !== 'excel')) return null;

    return array(
        'id' => $id,
        'year' => strik_sinterklaas_year(isset($order['year']) ? $order['year'] : '', $delivery_date),
        'season' => isset($order['season']) ? strik_sinterklaas_text($order['season'], 40) : 'sint',
        'customerName' => $customer_name,
        'contactName' => isset($order['contactName']) ? strik_sinterklaas_text($order['contactName'], 160) : '',
        'customerEmail' => isset($order['customerEmail']) ? strik_sinterklaas_email($order['customerEmail']) : '',
        'phone' => isset($order['phone']) ? strik_sinterklaas_text($order['phone'], 80) : '',
        'deliveryWindowType' => $delivery_window_type,
        'deliveryDate' => $delivery_date,
        'deliveryDateEnd' => $delivery_date_end,
        'deliveryWeek' => $delivery_week,
        'productionDate' => isset($order['productionDate']) ? strik_sinterklaas_date($order['productionDate']) : '',
        'department' => $department,
        'orderText' => $order_text,
        'letterOrderText' => isset($order['letterOrderText']) ? strik_sinterklaas_textarea($order['letterOrderText'], 5000) : '',
        'letterLines' => $letter_lines,
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
        'status' => $status,
        'entered' => !empty($order['entered']),
        'productionScheduled' => !empty($order['productionScheduled']),
        'logoChecked' => !empty($order['logoChecked']),
        'packagingChecked' => !empty($order['packagingChecked']),
        'textChecked' => !empty($order['textChecked']),
        'textInstructions' => isset($order['textInstructions']) ? strik_sinterklaas_textarea($order['textInstructions'], 1200) : '',
        'productionDone' => !empty($order['productionDone']),
        'letterProductionDone' => array_key_exists('letterProductionDone', $order) ? !empty($order['letterProductionDone']) : !empty($order['productionDone']),
        'packed' => !empty($order['packed']),
        'delivered' => !empty($order['delivered']),
        'cancelled' => !empty($order['cancelled']),
        'productionDoneAt' => isset($order['productionDoneAt']) ? strik_sinterklaas_text($order['productionDoneAt'], 80) : '',
        'packedAt' => isset($order['packedAt']) ? strik_sinterklaas_text($order['packedAt'], 80) : '',
        'deliveredAt' => isset($order['deliveredAt']) ? strik_sinterklaas_text($order['deliveredAt'], 80) : '',
        'reminderEmailedAt' => (isset($existing['deliveryDate']) && $existing['deliveryDate'] !== $delivery_date) || (isset($existing['status']) && $existing['status'] !== 'akkoord' && $status === 'akkoord') ? '' : (isset($order['reminderEmailedAt']) ? strik_sinterklaas_text($order['reminderEmailedAt'], 80) : ''),
        'reminderEmailError' => isset($order['reminderEmailError']) ? strik_sinterklaas_text($order['reminderEmailError'], 240) : '',
        'confirmationEmailedAt' => isset($existing['confirmationEmailedAt']) ? $existing['confirmationEmailedAt'] : '',
        'confirmationEmailError' => isset($existing['confirmationEmailError']) ? $existing['confirmationEmailError'] : '',
        'confirmationMail' => isset($existing['confirmationMail']) ? $existing['confirmationMail'] : array(),
        'quotationMail' => isset($existing['quotationMail']) ? $existing['quotationMail'] : array(),
        'attentionMail' => isset($existing['attentionMail']) ? $existing['attentionMail'] : array(),
        // The original website request and its mail receipt belong to the server.
        // An edit from management must neither erase nor forge this history.
        'folderQuote' => isset($existing['folderQuote']) ? $existing['folderQuote'] : null,
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
    $orders = strik_sinterklaas_ensure_letter_payment_amounts($orders);
    $filtered = strik_sinterklaas_filter_orders($orders, $request, 'pickupDate');

    return rest_ensure_response(array(
        'orders' => array_values($filtered),
        'total' => count($filtered),
        'generatedAt' => wp_date(DATE_ATOM),
    ));
}
}

if (!function_exists('strik_sinterklaas_letter_customer_lines')) {
function strik_sinterklaas_letter_customer_lines($lines) {
    $result = array();
    if (!is_array($lines)) return $result;
    foreach ($lines as $line) {
        if (!is_array($line)) continue;
        $result[] = array(
            'letter' => isset($line['letter']) ? $line['letter'] : '',
            'chocolate' => isset($line['chocolate']) ? $line['chocolate'] : '',
            'size' => isset($line['size']) ? $line['size'] : '',
            'style' => isset($line['style']) ? $line['style'] : '',
            'quantity' => isset($line['quantity']) ? absint($line['quantity']) : 0,
            'logo' => !empty($line['logo']),
            'specialRequests' => isset($line['specialRequests']) && is_array($line['specialRequests']) ? $line['specialRequests'] : array(),
        );
    }
    return $result;
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
    $existing_paid_amount_cents = strik_sinterklaas_letter_paid_amount($existing);
    $requested_total_cents = isset($params['totalCents'])
        ? absint($params['totalCents'])
        : (isset($existing['totalCents']) ? absint($existing['totalCents']) : 0);
    if (!empty($existing) && $requested_total_cents < $existing_paid_amount_cents) {
        return new WP_Error(
            'strik_sinterklaas_paid_total_cannot_decrease',
            'Deze bestelling is al betaald. Het totaalbedrag kan niet lager worden; bijbestellen kan wel en alleen het verschil blijft dan open.',
            array('status' => 409)
        );
    }
    $order = strik_sinterklaas_sanitize_letter_order(array_merge(is_array($existing) ? $existing : array(), $params), is_array($existing) ? $existing : array());

    if ($order === null) {
        return new WP_Error('strik_sinterklaas_invalid_letter_order', 'Vul minimaal klantnaam en letters in.', array('status' => 400));
    }

    $email_changed = !empty($existing) && isset($existing['customerEmail']) && $existing['customerEmail'] !== $order['customerEmail'];
    $details_changed = !empty($existing) && (
        $email_changed
        || (isset($existing['pickupDate']) ? $existing['pickupDate'] : '') !== $order['pickupDate']
        || (isset($existing['shop']) ? $existing['shop'] : '') !== $order['shop']
        || strik_sinterklaas_letter_customer_lines(isset($existing['lines']) ? $existing['lines'] : array()) !== strik_sinterklaas_letter_customer_lines($order['lines'])
        || !empty($existing['giftWrap']) !== !empty($order['giftWrap'])
    );
    if ($details_changed) {
        $order['customerConfirmationSentAt'] = '';
        $order['customerConfirmationError'] = '';
    }
    if ($email_changed) {
        $order['customerReminderSentForDate'] = '';
        $order['customerReminderError'] = '';
    }

    $order = strik_sinterklaas_assign_letter_order_number($order, $orders);

    if ($send_emails) {
        $internal_changed = !empty($existing)
            && strik_sinterklaas_letter_internal_details($existing) !== strik_sinterklaas_letter_internal_details($order);
        $order = strik_sinterklaas_send_letter_emails($order, is_array($existing) ? $existing : array(), $internal_changed);
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

if (!function_exists('strik_business_b2b_locked')) {
function strik_business_b2b_locked($callback) {
    global $wpdb;
    // Serialize read/modify/write of the shared B2B option, including retries,
    // management edits and reminders. MySQL releases the lock on disconnect.
    $name = 'strik_b2b_' . md5($wpdb->prefix);
    if ((string) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $name)) !== '1') {
        return new WP_Error('quote_busy', 'De aanvraag wordt al verwerkt. Probeer opnieuw.', array('status' => 409));
    }
    try { return call_user_func($callback); }
    finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $name)); }
}
function strik_business_quote_response($order) {
    $meta = $order['folderQuote'];
    return rest_ensure_response(array('ok' => !empty($meta['mailSentAt']) && !empty($meta['b2bStoredAt']), 'saved' => !empty($meta['b2bStoredAt']), 'mailSent' => !empty($meta['mailSentAt']), 'reference' => $meta['reference']));
}
// Explicit HTML rows and breaks also work in Outlook, which ignores pre-wrap.
// Render the immutable quote text: prices and details stay exactly as submitted.
function strik_business_quote_date_label($date, $year = true) {
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
    if (!$parsed || $parsed->format('Y-m-d') !== $date) return $date;
    $days = array('zo', 'ma', 'di', 'wo', 'do', 'vr', 'za');
    $months = array(1=>'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec');
    return $days[(int) $parsed->format('w')] . ' ' . $parsed->format('j') . ' ' . $months[(int) $parsed->format('n')] . ($year ? ' ' . $parsed->format('Y') : '');
}
function strik_business_quote_delivery_label($line) {
    if (preg_match('/^(?:Week van |Tussen )?(\d{4}-\d{2}-\d{2}) (?:t\/m|en) (\d{4}-\d{2}-\d{2})$/', $line, $dates)) {
        return 'Tussen ' . strik_business_quote_date_label($dates[1], substr($dates[1], 0, 4) !== substr($dates[2], 0, 4)) . ' en ' . strik_business_quote_date_label($dates[2]);
    }
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $line) ? strik_business_quote_date_label($line) : $line;
}
function strik_business_quote_product_label($line) {
    if (preg_match('/^(\d+ × )Chocolade spuitletters · spuitletter ([A-Z]) (klein|groot) · (melk|puur|wit)(.*)$/u', $line, $parts)) return $parts[1] . 'Spuitletter ' . $parts[2] . ' · ' . $parts[4] . ' · ' . $parts[3] . $parts[5];
    if (preg_match('/^(\d+ × )Chocolade vormletter S · vormletter S groot · (melk|puur|wit)(.*)$/u', $line, $parts)) return $parts[1] . 'Vormletter S · ' . $parts[2] . ' · groot' . $parts[3];
    return $line;
}
function strik_business_quote_details_html($text, $compact = false) {
    $headings = array('BEDRIJF EN CONTACT' => 'Bedrijf en contact', 'GEKOZEN SINTERKLAASPRODUCTEN' => 'Gekozen producten', 'LOSSE KERSTCADEAUS' => 'Losse kerstcadeaus', 'KERSTPAKKET OP MAAT' => 'Kerstpakket op maat', 'PRIJSINDICATIE' => 'Prijsindicatie', 'GEWENSTE LEVERING' => 'Gewenste levering', 'WENSEN' => 'Aanvullende wensen');
    $sections = array(); $current = array('heading' => '', 'lines' => array());
    foreach (preg_split('/\r\n|\r|\n/', (string) $text) as $line) {
        // Stop interpreting headings after WENSEN; customer wishes are free text.
        if ($current['heading'] !== 'WENSEN' && isset($headings[$line])) {
            if ($current['heading'] !== '' || count($current['lines'])) $sections[] = $current;
            $current = array('heading' => $line, 'lines' => array());
        } else $current['lines'][] = $line;
    }
    $sections[] = $current;
    if ($compact) {
        $priority = array('GEWENSTE LEVERING'=>0, 'GEKOZEN SINTERKLAASPRODUCTEN'=>10, 'LOSSE KERSTCADEAUS'=>10, 'KERSTPAKKET OP MAAT'=>20, 'PRIJSINDICATIE'=>30, 'WENSEN'=>40, 'BEDRIJF EN CONTACT'=>50);
        usort($sections, function ($a, $b) use ($priority) { return (isset($priority[$a['heading']]) ? $priority[$a['heading']] : 60) <=> (isset($priority[$b['heading']]) ? $priority[$b['heading']] : 60); });
    }
    $html = '';
    foreach ($sections as $section) {
        $heading = $section['heading'];
        $lines = $section['lines'];
        if ($compact) {
            $company = '';
            foreach ($lines as $line) if (strpos($line, 'Bedrijf: ') === 0) $company = trim(substr($line, 9));
            $lines = array_values(array_filter($lines, function ($line) use ($heading, $company) {
                if (in_array(trim($line), array('Geen aanvullende wensen', 'Vrijblijvende aanvraag; beschikbaarheid, levermoment en definitieve prijs moeten nog worden bevestigd.'), true)) return false;
                if ($heading !== 'BEDRIJF EN CONTACT') return true;
                $parts = explode(': ', $line, 2);
                $value = isset($parts[1]) ? trim($parts[1]) : '';
                return $parts[0] !== 'Bedrijf' && $value !== '' && $value !== 'Niet opgegeven' && !($parts[0] === 'Contactpersoon' && strcasecmp($value, $company) === 0);
            }));
            if ($heading === 'GEWENSTE LEVERING') $lines = array_map('strik_business_quote_delivery_label', $lines);
            if ($heading === 'PRIJSINDICATIE') $lines = array_map(function ($line) { return $line === 'Eventuele extra verpakking en bezorging zijn niet inbegrepen; definitieve prijs in overleg.' ? 'Extra verpakking en bezorging in overleg.' : $line; }, $lines);
        }
        while (count($lines) && trim($lines[0]) === '') array_shift($lines);
        while (count($lines) && trim($lines[count($lines) - 1]) === '') array_pop($lines);
        if ((!$heading || $compact) && !count($lines)) continue;
        $price = $heading === 'PRIJSINDICATIE';
        $delivery = $compact && $heading === 'GEWENSTE LEVERING';
        $html .= '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:' . ($compact ? '18' : '22') . 'px 0;' . ($price || $delivery ? 'background:#f0f5ee;border:1px solid #dce7dc;' : '') . '"><tr><td style="' . ($price || $delivery ? 'padding:18px;' : '') . 'font-size:15px;line-height:1.55;word-break:break-word">';
        $label = $compact && $heading === 'BEDRIJF EN CONTACT' ? 'Contact' : ($compact && $heading === 'GEKOZEN SINTERKLAASPRODUCTEN' ? 'Bestelling' : (isset($headings[$heading]) ? $headings[$heading] : ''));
        if ($heading) $html .= '<h2 style="font-size:' . ($compact && $heading === 'BEDRIJF EN CONTACT' ? '15' : '18') . 'px;margin:0 0 12px;color:#244b37">' . esc_html($label) . '</h2>';
        if ($heading === 'BEDRIJF EN CONTACT') {
            $html .= '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">';
            foreach ($lines as $line) {
                $parts = explode(': ', $line, 2);
                $html .= '<tr><td valign="top" style="padding:5px 12px 5px 0;color:#647367;width:110px">' . esc_html($parts[0]) . '</td><td style="padding:5px 0;font-weight:bold;word-break:break-word">' . esc_html(isset($parts[1]) ? $parts[1] : '') . '</td></tr>';
            }
            $html .= '</table>';
        } elseif (in_array($heading, array('GEKOZEN SINTERKLAASPRODUCTEN', 'LOSSE KERSTCADEAUS', 'KERSTPAKKET OP MAAT'), true)) {
            // Keep each product with its indented price, logo and wrapping detail.
            $html .= '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">';
            foreach ($lines as $line) {
                if (trim($line) === '') continue;
                $detail = strpos($line, '  ') === 0;
                if ($compact && !$detail) $line = strik_business_quote_product_label($line);
                $html .= '<tr><td style="padding:' . ($detail ? '0 0 12px' : '10px 0 4px;border-top:1px solid #e2e8df') . ';font-size:' . ($detail ? '13' : '15') . 'px;' . ($detail ? 'color:#647367' : 'font-weight:bold') . '">' . esc_html(trim($line)) . '</td></tr>';
            }
            $html .= '</table>';
        } else {
            foreach ($lines as $index => $line) {
                $html .= '<p style="margin:0 0 8px;' . (($price || $delivery) && $index === 0 ? 'font-size:' . ($delivery ? '19' : '21') . 'px;font-weight:bold;' : '') . '">' . (trim($line) === '' ? '&nbsp;' : esc_html($line)) . '</p>';
            }
        }
        $html .= '</td></tr></table>';
    }
    return $html;
}
function strik_business_quote_html($order) {
    $meta = $order['folderQuote'];
    $season = $order['season'] === 'kerst' ? 'Kerst' : 'Sinterklaas';
    $url = 'https://app.strik-patisserie.nl/' . ($order['season'] === 'kerst' ? 'kerst' : 'sinterklaas') . '/b2b';
    return '<!doctype html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;background:#edf3ed;font-family:Arial,sans-serif;color:#293e30"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf8;border-radius:24px;overflow:hidden">'
        . '<tr><td style="background:#244b37;padding:28px;color:white"><div style="color:#e9cc89;font-size:12px;font-weight:bold;letter-spacing:3px">STRIK PATISSERIE</div><h1 style="font-size:27px;margin:16px 0 8px">Nieuwe offerteaanvraag ' . esc_html($season) . '</h1><strong>' . esc_html($order['customerName']) . '</strong><br><span style="font-size:13px">Referentie: ' . esc_html($meta['reference']) . '</span></td></tr>'
        . '<tr><td style="padding:6px 28px 28px">'
        . strik_business_quote_details_html($meta['quoteText'], true)
        . '<p style="margin-top:28px"><a href="' . esc_url($url) . '" style="display:inline-block;background:#244b37;color:white;padding:14px 22px;border-radius:24px;font-weight:bold;text-decoration:none">Open B2B-aanvragen &rarr;</a></p>'
        . '</td></tr></table></td></tr></table></body></html>';
}
function strik_business_quote_contact($order) {
    $campaigns = get_option(STRIK_SINTERKLAAS_MAILING_OPTION_NAME, array());
    $book = strik_business_mailing_contacts(is_array($campaigns) ? $campaigns : array());
    $previous_customers = $book['customers'];
    $email = strtolower($order['customerEmail']);
    $meta = $order['folderQuote'];
    $consent = !empty($meta['snapshot']['consent']);
    $note = 'Folderaanvraag ' . ($order['season'] === 'kerst' ? 'Kerst' : 'Sint') . ' ontvangen: ' . $meta['reference'];
    $ci = -1; $ri = -1;
    foreach ($book['customers'] as $customer_index => $customer) {
        foreach ($customer['recipients'] as $recipient_index => $recipient) {
            if (strtolower($recipient['email']) === $email) { $ci = $customer_index; $ri = $recipient_index; break 2; }
        }
    }
    if ($ci < 0) {
        foreach ($book['customers'] as $index => $customer) if (strtolower($customer['company']) === strtolower($order['customerName'])) { $ci = $index; break; }
        if ($ci < 0) {
            $ci = count($book['customers']);
            $book['customers'][] = array('id' => 'folderlead-' . md5($email), 'company' => $order['customerName'], 'notes' => '', 'recipients' => array());
        }
        $ri = count($book['customers'][$ci]['recipients']);
        $book['customers'][$ci]['recipients'][] = array('id' => 'folderadres-' . md5($email), 'contactName' => $order['contactName'], 'email' => $email, 'doNotEmail' => true, 'sent' => array(), 'interests' => array(), 'consentAt' => '', 'consentSource' => '');
    }
    $customer = &$book['customers'][$ci];
    if (strpos($customer['notes'], $note) === false) $customer['notes'] = strik_sinterklaas_textarea($note . ($customer['notes'] !== '' ? ' · ' . $customer['notes'] : ''), 1600);
    if ($consent) {
        $customer['recipients'][$ri]['doNotEmail'] = false;
        $customer['recipients'][$ri]['interests'] = array('sint', 'kerst');
        $customer['recipients'][$ri]['consentAt'] = $meta['receivedAt'];
        $customer['recipients'][$ri]['consentSource'] = '/' . $order['season'] . '-voor-bedrijven';
    }
    unset($customer);
    if ($book['customers'] !== $previous_customers) {
        $book['revision']++;
        update_option('strik_business_mailing_contacts_v1', $book, false);
    }
}
function strik_business_folder_quote($request) {
    $input = $request->get_json_params();
    if (!is_array($input) || empty($input['order']) || empty($input['snapshot']) || empty($input['quoteText']) || !preg_match('/^[a-f0-9-]{36}$/', isset($input['requestId']) ? $input['requestId'] : '') || !preg_match('/^[a-f0-9]{64}$/', isset($input['payloadHash']) ? $input['payloadHash'] : '')) return new WP_Error('invalid_quote', 'Ongeldige aanvraag.', array('status' => 400));
    return strik_business_b2b_locked(function () use ($input) {
        $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
        $id = 'folder-' . $input['requestId'];
        $key = strik_sinterklaas_order_key($id);
        // A separate immutable receipt survives even a later deliberate deletion
        // from B2B. A network retry must never re-create a deleted inquiry.
        $receipt_key = 'strik_folder_quote_' . str_replace('-', '', $input['requestId']);
        $receipt = get_option($receipt_key, null);
        if (is_array($receipt)) {
            if (!hash_equals($receipt['folderQuote']['payloadHash'], $input['payloadHash'])) return new WP_Error('quote_changed', 'Deze aanvraag is gewijzigd.', array('status' => 409));
            if (!empty($receipt['folderQuote']['mailSentAt']) || $receipt['folderQuote']['mailState'] === 'sending') return strik_business_quote_response($receipt);
            $order = $receipt;
        } else {
            $meta = array('requestId' => $input['requestId'], 'reference' => strik_sinterklaas_text($input['reference'], 40), 'payloadHash' => $input['payloadHash'], 'receivedAt' => wp_date(DATE_ATOM), 'snapshot' => $input['snapshot'], 'quoteText' => strik_sinterklaas_textarea($input['quoteText'], 50000), 'b2bStoredAt' => '', 'mailState' => 'pending', 'mailSentAt' => '', 'mailError' => '');
            $order = strik_sinterklaas_sanitize_b2b_order(array_merge($input['order'], array('id' => $id, 'status' => 'aanvraag', 'entered' => false, 'productionScheduled' => false, 'productionDone' => false, 'packed' => false, 'delivered' => false)), array('folderQuote' => $meta));
            if (!$order || $order['customerEmail'] === '' || !in_array($order['season'], array('sint', 'kerst'), true)) return new WP_Error('invalid_quote', 'Controleer de aanvraaggegevens.', array('status' => 400));
            if (count($orders) >= STRIK_SINTERKLAAS_MAX_ORDERS) return new WP_Error('quote_capacity', 'De aanvraag kan nu niet worden opgeslagen.', array('status' => 503));
            $rate_key = 'strik_quote_rate_' . md5(strtolower($order['customerEmail']));
            $attempts = (int) get_transient($rate_key);
            if ($attempts >= 10) return new WP_Error('quote_rate_limit', 'Te veel aanvragen. Probeer later opnieuw.', array('status' => 429));
            set_transient($rate_key, $attempts + 1, HOUR_IN_SECONDS);
            update_option($receipt_key, $order, false);
            if (get_option($receipt_key, null) !== $order) return new WP_Error('quote_storage', 'Opslaan is niet gelukt.', array('status' => 503));
            $orders[$key] = $order;
            strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
            $saved_orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
            if (!isset($saved_orders[$key]) || $saved_orders[$key] !== $order) return strik_business_quote_response($order);
        }
        // Restore a missed first B2B write, but preserve subsequent management edits.
        if (!isset($orders[$key])) {
            if (!empty($order['folderQuote']['b2bStoredAt'])) return strik_business_quote_response($order);
            $orders[$key] = $order;
            strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
        }
        $stored = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
        if (!isset($stored[$key])) return strik_business_quote_response($order);
        $order['folderQuote']['b2bStoredAt'] = wp_date(DATE_ATOM);
        strik_business_quote_contact($order);
        $order['folderQuote']['mailState'] = 'sending';
        update_option($receipt_key, $order, false);
        if (get_option($receipt_key, null) !== $order) return strik_business_quote_response($order);
        $sent = wp_mail('info@strik-patisserie.nl', 'OFFERTAANVRAAG ' . strtoupper($order['season']) . ' - ' . $order['customerName'] . ' - ' . $order['folderQuote']['reference'], strik_business_quote_html($order), array('Content-Type: text/html; charset=UTF-8', 'From: Strik Patisserie <info@strik-patisserie.nl>', 'Reply-To: ' . $order['customerEmail']));
        $order['folderQuote']['mailState'] = $sent ? 'sent' : 'failed';
        $order['folderQuote']['mailSentAt'] = $sent ? wp_date(DATE_ATOM) : '';
        $order['folderQuote']['mailError'] = $sent ? '' : 'Aanvraag opgeslagen; interne e-mailmelding nog niet verstuurd.';
        update_option($receipt_key, $order, false);
        if (isset($orders[$key])) {
            $orders[$key]['folderQuote'] = $order['folderQuote'];
            strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
        }
        return strik_business_quote_response($order);
    });
}
}

if (!function_exists('strik_sinterklaas_b2b_get')) {
function strik_sinterklaas_b2b_get($request) {
    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $filtered = strik_sinterklaas_filter_orders($orders, $request, 'deliveryDate');

    return rest_ensure_response(array(
        'orders' => array_values($filtered),
        'total' => count($filtered),
        'generatedAt' => wp_date(DATE_ATOM),
    ));
}
}

if (!function_exists('strik_business_b2b_confirmation_data')) {
function strik_business_b2b_confirmation_data($order) {
    $text = str_replace(array("\r\n", "\r"), "\n", $order['orderText']);
    // A folder inquiry also contains its OLD contact, delivery and indicative
    // total. A final confirmation must use the CURRENT saved fields instead.
    $text = preg_replace('/^PRODUCTEN EN PRIJS\n/', '', $text);
    $text = str_replace("OVERIGE ORDERAFSPRAKEN\n", '', $text);
    $start = strpos($text, "BEDRIJF EN CONTACT\n");
    if ($start !== false) {
        $prefix = substr($text, 0, $start);
        $folder = substr($text, $start);
        if (preg_match('/\n(GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS|KERSTPAKKET OP MAAT)\n/', $folder, $match, PREG_OFFSET_CAPTURE)) {
            $products = substr($folder, $match[0][1] + 1);
            $end = strpos($products, "\nPRIJSINDICATIE\n");
            $text = $prefix . ($end === false ? $products : substr($products, 0, $end));
        } else $text = $prefix;
    }
    if (!empty($order['letterLines'])) {
        // Letter quantities/specifications come from the editable letter rows.
        // Remove their old duplicate description (and its old price) from the inquiry.
        $text = preg_replace('/^\d+\s*×\s*Chocolade (?:spuitletters|vormletter S)[^\n]*(?:\n  [^\n]*)?/mu', '', $text);
    }
    if (in_array(trim($text), array('GEKOZEN SINTERKLAASPRODUCTEN', 'LOSSE KERSTCADEAUS', 'KERSTPAKKET OP MAAT'), true)) $text = '';
    $window = isset($order['deliveryWindowType']) ? $order['deliveryWindowType'] : 'date';
    $end = isset($order['deliveryDateEnd']) ? $order['deliveryDateEnd'] : '';
    $week = isset($order['deliveryWeek']) ? $order['deliveryWeek'] : '';
    // Support the existing lossless marker used by older app versions.
    if (preg_match('/__STRIK_LEVERPERIODE__(range|week)\|([^|]*)\|([^|]*)$/', $order['sourceSheet'], $marker)) {
        $window = $marker[1]; $end = $marker[2]; $week = $marker[3];
    }
    $format_date = function ($date) { return preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m) ? $m[3] . '-' . $m[2] . '-' . $m[1] : $date; };
    $moment = $format_date($order['deliveryDate']);
    if ($window === 'range' && $end !== '') $moment .= ' t/m ' . $format_date($end);
    if ($window === 'week') $moment = 'Leverweek ' . $week . ($moment !== '' ? ' · vanaf ' . $moment : '');
    $agreement = $order['priceAgreement'];
    if (!empty($order['folderQuote']) && strpos($agreement, 'Prijsindicatie:') === 0) $agreement = '';
    $letter_lines = $order['letterLines'];
    foreach ($letter_lines as &$letter_line) {
        if (!isset($letter_line['withLogo'])) $letter_line['withLogo'] = !empty($order['logo']);
    }
    unset($letter_line);
    return array(
        'season' => $order['season'], 'company' => $order['customerName'], 'contact' => $order['contactName'],
        'email' => $order['customerEmail'], 'phone' => $order['phone'], 'products' => trim($text),
        'letters' => $letter_lines, 'legacyLetters' => empty($order['letterLines']) ? $order['letterOrderText'] : '', 'moment' => $moment, 'method' => $order['deliveryMethod'],
        'address' => $order['deliveryAddress'], 'total' => $order['totalExVat'], 'agreement' => $agreement,
        'logo' => $order['logo'], 'packaging' => $order['packaging'], 'text' => $order['textInstructions'],
    );
}
function strik_business_b2b_total_label($value) {
    if ($value === '') return 'Volgens prijsafspraak';
    $number = preg_replace('/[^0-9.,-]/', '', $value);
    if (strpos($number, ',') !== false) $number = str_replace(',', '.', str_replace('.', '', $number));
    return is_numeric($number) ? '€ ' . number_format((float) $number, 2, ',', '.') : $value;
}
function strik_business_b2b_mail_content($order, $internal = false) {
    $data = strik_business_b2b_confirmation_data($order);
    // Compare the actual order, not row IDs, missing legacy flags, formatting,
    // department selection or progress/planning checkboxes.
    $letters = array();
    foreach ($data['letters'] as $line) {
        $exceptions = isset($line['exceptions']) ? array_values(array_unique($line['exceptions'])) : array();
        sort($exceptions);
        $item = array('letter' => $line['letter'], 'chocolate' => $line['chocolate'], 'style' => $line['style'], 'size' => $line['size'], 'withLogo' => !empty($line['withLogo']), 'exceptions' => $exceptions);
        $key = wp_json_encode($item);
        if (!isset($letters[$key])) $letters[$key] = array_merge($item, array('quantity' => 0));
        $letters[$key]['quantity'] += (int) $line['quantity'];
    }
    ksort($letters);
    $data['letters'] = array_values($letters);
    $data['total'] = strik_business_b2b_total_label($data['total']);
    if (in_array(strtolower(trim($data['logo'])), array('ja', 'eigen logo volgens orderregels'), true)) $data['logo'] = 'Eigen logo';
    if ($internal) {
        $data['importantNotes'] = $order['importantNotes'];
        $data['invoiceInfo'] = $order['invoiceInfo'];
    }
    foreach ($data as $field => $value) {
        if (!is_string($value)) continue;
        $lines = explode("\n", str_replace(array("\r\n", "\r"), "\n", $value));
        $lines = array_map(function ($line) { return trim(preg_replace('/[ \t]+/u', ' ', $line)); }, $lines);
        $data[$field] = implode("\n", array_values(array_filter($lines, function ($line) { return $line !== ''; })));
    }
    return $data;
}
function strik_business_b2b_letter_change_label($line) {
    return $line['quantity'] . '× ' . ($line['style'] === 'vorm' ? 'Vormletter ' : 'Spuitletter ') . $line['letter'] . ' · ' . $line['chocolate'] . ' · ' . $line['size'] . (!empty($line['withLogo']) ? ' · eigen logo' : ' · zonder logo') . (!empty($line['exceptions']) ? ' · ' . implode(', ', $line['exceptions']) : '');
}
function strik_business_b2b_order_changes($before, $after) {
    $labels = array('season' => 'Seizoen', 'company' => 'Klant', 'contact' => 'Contactpersoon', 'email' => 'E-mailadres', 'phone' => 'Telefoon', 'products' => 'Bestelling / overige producten', 'letters' => 'Chocoladeletters', 'legacyLetters' => 'Letterbestelling', 'moment' => 'Levermoment', 'method' => 'Levering / afhalen', 'address' => 'Bezorgadres', 'total' => 'Totaal excl. btw', 'agreement' => 'Prijsafspraak', 'logo' => 'Logo-afspraak', 'packaging' => 'Verpakking', 'text' => 'Tekst / personalisatie', 'importantNotes' => 'Interne orderafspraken', 'invoiceInfo' => 'Factuurgegevens');
    $changes = array();
    foreach ($labels as $field => $label) {
        $old = isset($before[$field]) ? $before[$field] : ($field === 'letters' ? array() : '');
        $new = isset($after[$field]) ? $after[$field] : ($field === 'letters' ? array() : '');
        if ($old === $new) continue;
        if ($field === 'letters') {
            $old_lines = array_map('strik_business_b2b_letter_change_label', $old);
            $new_lines = array_map('strik_business_b2b_letter_change_label', $new);
            $old = implode("\n", array_diff($old_lines, $new_lines));
            $new = implode("\n", array_diff($new_lines, $old_lines));
        }
        $changes[] = array('label' => $label, 'before' => $old === '' ? 'Niet ingevuld / niet besteld' : $old, 'after' => $new === '' ? 'Verwijderd / niet meer besteld' : $new);
    }
    return $changes;
}
function strik_business_b2b_prepare_confirmation($order) {
    $meta = isset($order['confirmationMail']) && is_array($order['confirmationMail']) ? $order['confirmationMail'] : array();
    $hash = hash('sha256', wp_json_encode(strik_business_b2b_mail_content($order)));
    $backup_hash = hash('sha256', wp_json_encode(strik_business_b2b_mail_content($order, true)));
    $upgrade = !isset($meta['contentSchema']) || $meta['contentSchema'] !== 2;
    // Seed existing persisted orders without changing their sent versions merely
    // because the comparison format was upgraded. Saves seed BEFORE applying edits.
    if (empty($meta['version']) || (!$upgrade && (!isset($meta['contentHash']) || $meta['contentHash'] !== $hash))) {
        $meta['version'] = hash('sha256', (isset($meta['version']) ? $meta['version'] : '') . $hash);
    }
    if (empty($meta['backupVersion']) || (!$upgrade && (!isset($meta['backupContentHash']) || $meta['backupContentHash'] !== $backup_hash))) {
        $meta['backupVersion'] = hash('sha256', (isset($meta['backupVersion']) ? $meta['backupVersion'] : '') . $backup_hash);
    }
    $meta['contentHash'] = $hash;
    $meta['backupContentHash'] = $backup_hash;
    $meta['contentSchema'] = 2;
    $order['confirmationMail'] = $meta;
    return strik_business_b2b_prepare_quotation($order);
}
function strik_business_b2b_prepare_quotation($order) {
    $meta = isset($order['quotationMail']) && is_array($order['quotationMail']) ? $order['quotationMail'] : array();
    $hash = hash('sha256', wp_json_encode(array('schema' => 1, 'status' => $order['status'], 'content' => strik_business_b2b_mail_content($order))));
    if (empty($meta['version']) || !isset($meta['contentHash']) || $meta['contentHash'] !== $hash) {
        $meta['version'] = hash('sha256', (isset($meta['version']) ? $meta['version'] : '') . $hash);
    }
    $meta['contentHash'] = $hash;
    $receipt = get_option('strik_b2b_mail_' . hash('sha256', $order['id'] . '|quotation|' . $meta['version']), array());
    if (!empty($receipt['state'])) {
        if ($receipt['state'] === 'sending') $receipt['error'] = 'De verzendstatus is onzeker. Controleer eerst de mailbox; deze versie wordt niet automatisch opnieuw verstuurd.';
        $meta['customer'] = $receipt;
    }
    $order['quotationMail'] = $meta;
    return $order;
}
function strik_business_b2b_quotation_subject($order) {
    $season = $order['season'] === 'kerst' ? 'Kerst' : ($order['season'] === 'sint-kerst' ? 'Sint & Kerst' : 'Sinterklaas');
    return ($order['status'] === 'offerte' ? 'Offerte' : 'Overzicht van uw aanvraag') . ' ' . $season . ' - ' . $order['customerName'];
}
function strik_business_b2b_confirmation_html($order, $internal = false, $updated = false, $quotation = false) {
    $data = strik_business_b2b_confirmation_data($order);
    $season = $order['season'] === 'kerst' ? 'Kerst' : ($order['season'] === 'sint-kerst' ? 'Sinterklaas & Kerst' : 'Sinterklaas');
    $reference = !empty($order['folderQuote']['reference']) ? $order['folderQuote']['reference'] : 'B2B-' . strtoupper(substr(hash('sha256', $order['id']), 0, 10));
    $paragraph = function ($text) { return nl2br(esc_html($text)); };
    $heading = $updated ? 'Uw bestelling is aangepast' : 'Uw bestelling is bevestigd!';
    if ($internal) $heading = $updated ? 'Gewijzigde definitieve bestelling' : 'Definitieve bestelling';
    $kind = $order['status'] === 'offerte' ? 'Offerte' : 'Aanvraagoverzicht';
    if ($quotation) {
        $heading = $order['status'] === 'offerte' ? 'Uw offerte van Strik' : 'Uw aanvraag bij Strik';
        $start = $order['deliveryDate'];
        $end = isset($order['deliveryDateEnd']) ? $order['deliveryDateEnd'] : '';
        $data['moment'] = $start !== '' ? strik_business_quote_delivery_label($start . ($end !== '' && $end !== $start ? ' t/m ' . $end : '')) : 'Nog af te spreken';
    }
    $html = '<!doctype html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf3ed;font-family:Arial,sans-serif;color:#293e30"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf8;border-radius:24px;overflow:hidden">'
        . '<tr><td style="background:#244b37;padding:32px 28px;color:#ffffff"><div style="color:#e9cc89;font-size:12px;font-weight:bold;letter-spacing:3px">STRIK PATISSERIE</div><p style="font-size:12px;letter-spacing:1px;color:#e9cc89">' . esc_html($season) . ($quotation ? ' · ' . esc_html(strtoupper($kind)) : ($internal ? ' · INTERNE BACK-UP' : ' · BESTELBEVESTIGING')) . '</p><h1 style="font-size:28px;line-height:1.2;margin:16px 0">' . esc_html($heading) . '</h1><span style="font-size:13px">Referentie: ' . esc_html($reference) . '</span></td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.55;word-break:break-word">';
    $html .= $internal ? '<p><strong>' . esc_html($data['company']) . '</strong><br>Deze bestelling staat op definitief in de Strik Team app. Controleer Bake-it en de productieplanning.</p>' : '<p>Beste ' . esc_html($data['contact'] !== '' ? $data['contact'] : $data['company']) . ',</p>' . ($quotation ? '<p>' . ($order['status'] === 'offerte' ? 'Hierbij ontvangt u onze offerte op basis van uw wensen.' : 'Hieronder vindt u het overzicht van uw aanvraag, zoals met ons besproken.') . '</p>' : '<p>Bedankt voor uw bestelling bij Strik Patisserie. Hieronder vindt u de definitieve afspraken. Wij maken er met zorg iets feestelijks van.</p>');
    if ($internal && $updated && !empty($order['confirmationMail']['backupChanges']) && isset($order['confirmationMail']['backupChangesVersion']) && $order['confirmationMail']['backupChangesVersion'] === $order['confirmationMail']['backupVersion']) {
        $html .= '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border:1px solid #e6bcb7;border-radius:14px;background:#fff3f0"><tr><td colspan="2" style="padding:18px 18px 12px;color:#a32f29"><strong style="font-size:18px">Dit is gewijzigd</strong><br><span style="font-size:12px">Ten opzichte van de vorige bestelling. De volledige actuele bestelling staat hieronder.</span></td></tr>';
        foreach ($order['confirmationMail']['backupChanges'] as $change) {
            $html .= '<tr><td colspan="2" style="padding:12px 18px 6px;border-top:1px solid #eed5d0;color:#a32f29;font-weight:bold">' . esc_html($change['label']) . '</td></tr><tr><td width="50%" valign="top" style="padding:0 12px 16px 18px;font-size:13px;color:#756c67"><strong>Was</strong><br>' . $paragraph($change['before']) . '</td><td width="50%" valign="top" style="padding:0 18px 16px 12px;font-size:13px;color:#a32f29"><strong>Wordt</strong><br>' . $paragraph($change['after']) . '</td></tr>';
        }
        $html .= '</table>';
    }
    $html .= '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f5ee;border-radius:14px"><tr><td style="padding:18px"><strong>' . ($quotation ? 'Gewenste levering' : 'Levering') . ' · ' . esc_html($data['moment']) . '</strong><br>' . esc_html($data['method'] !== '' ? $data['method'] : ($quotation ? 'Afhalen of bezorgen nog af te spreken' : 'Afhalen of bezorgen volgens afspraak')) . ($data['address'] !== '' ? '<br>' . $paragraph($data['address']) : '') . '</td></tr></table>';
    $html .= '<h2 style="font-size:19px;margin:28px 0 12px">' . ($quotation ? 'Gekozen producten' : ($internal ? 'Bestelling' : 'Uw bestelling')) . '</h2>';
    if ($data['products'] !== '') $html .= strik_business_quote_details_html($data['products']);
    if ($data['legacyLetters'] !== '') $html .= '<p>' . $paragraph($data['legacyLetters']) . '</p>';
    if (count($data['letters'])) {
        $html .= '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">';
        foreach ($data['letters'] as $line) {
            $html .= '<tr><td style="padding:11px 10px 11px 0;border-bottom:1px solid #e2e8df;font-weight:bold;vertical-align:top;white-space:nowrap">' . absint($line['quantity']) . '×</td><td style="padding:11px 0;border-bottom:1px solid #e2e8df"><strong>' . esc_html(($line['style'] === 'vorm' ? 'Vormletter ' : 'Spuitletter ') . $line['letter']) . '</strong> · ' . esc_html($line['chocolate'] . ' · ' . $line['size']) . (!empty($line['withLogo']) ? ' · <strong>Eigen logo</strong>' : '') . (!empty($line['exceptions']) ? '<br><span style="font-size:13px">' . esc_html(implode(', ', $line['exceptions'])) . '</span>' : '') . '</td></tr>';
        }
        $html .= '</table>';
    }
    foreach (array('Logo' => $data['logo'], 'Verpakking' => $data['packaging'], 'Tekst of personalisatie' => $data['text']) as $label => $value) if ($value !== '') $html .= '<p><strong>' . esc_html($label) . '</strong><br>' . $paragraph($value) . '</p>';
    $html .= '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#f0f5ee"><tr><td style="padding:18px"><span style="font-size:12px;letter-spacing:1px">' . ($quotation ? ($order['status'] === 'offerte' ? 'OFFERTETOTAAL EXCL. BTW' : 'PRIJSINDICATIE EXCL. BTW') : 'AFGESPROKEN TOTAAL EXCL. BTW') . '</span><p style="font-size:25px;font-weight:bold;margin:6px 0">' . esc_html($quotation && $data['total'] === '' ? 'Nog af te spreken' : strik_business_b2b_total_label($data['total'])) . '</p>' . ($data['agreement'] !== '' ? '<span style="font-size:13px">' . $paragraph($data['agreement']) . '</span>' : '') . '</td></tr></table>';
    if ($quotation) $html .= '<p style="padding:16px;background:#f0f5ee;border-left:3px solid #244b37">Dit is nog geen definitieve bestelling. ' . ($order['status'] === 'offerte' ? 'Wilt u akkoord geven of iets wijzigen? Antwoord op deze e-mail. Na onze bevestiging is uw bestelling definitief.' : 'Klopt dit overzicht of wilt u iets aanpassen? Antwoord op deze e-mail; we stemmen de prijs en levering samen af.') . '</p>';
    $html .= '<h2 style="font-size:18px;margin:24px 0 10px">Contactgegevens</h2><p><strong>' . esc_html($data['company']) . '</strong><br>' . esc_html($data['contact']) . '<br>' . esc_html($data['email'] !== '' ? $data['email'] : 'Geen e-mailadres opgegeven') . ($data['phone'] !== '' ? '<br>' . esc_html($data['phone']) : '') . '</p>';
    if ($internal) {
        foreach (array('Interne opmerkingen' => $order['importantNotes'], 'Factuurgegevens' => $order['invoiceInfo'], 'Productiedatum' => $order['productionDate'], 'Oude letteromschrijving' => $order['letterOrderText']) as $label => $value) if ($value !== '') $html .= '<p style="padding-top:12px;border-top:1px solid #e2e8df"><strong>' . esc_html($label) . '</strong><br>' . $paragraph($value) . '</p>';
        $url = 'https://app.strik-patisserie.nl/' . ($order['season'] === 'kerst' ? 'kerst' : 'sinterklaas') . '/b2b';
        $html .= '<p><a style="display:inline-block;background:#244b37;color:#fff;padding:13px 20px;border-radius:24px;text-decoration:none;font-weight:bold" href="' . esc_url($url) . '">Open B2B-bestellingen &rarr;</a></p>';
    } elseif ($quotation) $html .= '<p style="margin-top:24px"><strong>Met vriendelijke groet,<br>Team Strik Patisserie</strong></p>';
    else $html .= '<p style="margin-top:28px">Vragen of een wijziging doorgeven? Antwoord gerust op deze e-mail. Vermeld daarbij uw referentie <strong>' . esc_html($reference) . '</strong>.</p><p><strong>Met feestelijke groet,<br>Team Strik Patisserie</strong></p>';
    return $html . '</td></tr></table></td></tr></table></body></html>';
}
function strik_business_b2b_store_confirmed($order) {
    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $key = strik_sinterklaas_order_key($order['id']);
    $orders[$key] = $order;
    strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
    $stored = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    return isset($stored[$key]) && $stored[$key] === $order;
}
function strik_business_b2b_send_confirmation($order, $audience, $updated = false) {
    $version = $order['confirmationMail'][$audience === 'customer' ? 'version' : 'backupVersion'];
    $email = $audience === 'customer' ? $order['customerEmail'] : STRIK_SINTERKLAAS_RECIPIENT;
    $key = 'strik_b2b_mail_' . hash('sha256', $order['id'] . '|' . $audience . '|' . $version);
    $receipt = get_option($key, array());
    if (empty($receipt['state']) || $receipt['state'] === 'failed') {
        if (isset($receipt['updated'])) $updated = $receipt['updated'];
        $receipt = array('version' => $version, 'email' => $email, 'state' => 'sending', 'sentAt' => '', 'error' => '', 'updated' => $updated);
        if ($audience === 'backup') $receipt['snapshot'] = strik_business_b2b_mail_content($order, true);
        update_option($key, $receipt, false);
        if (get_option($key) !== $receipt) {
            $receipt['state'] = 'failed'; $receipt['error'] = 'Verzending gestopt: de verzendregistratie kon niet worden opgeslagen. Probeer opnieuw.';
        } else {
            $season = $order['season'] === 'kerst' ? 'Kerst' : ($order['season'] === 'sint-kerst' ? 'Sint & Kerst' : 'Sinterklaas');
            $headers = array('Content-Type: text/html; charset=UTF-8', $audience === 'backup' && is_email($order['customerEmail']) ? 'Reply-To: ' . $order['customerEmail'] : 'Reply-To: Strik Patisserie <info@strik-patisserie.nl>');
            $subject = ($audience === 'customer' ? ($updated ? 'Gewijzigde bestelbevestiging' : 'Definitieve bestelbevestiging') : ($updated ? 'GEWIJZIGDE DEFINITIEVE B2B-BESTELLING' : 'DEFINITIEVE B2B-BESTELLING')) . ' ' . $season . ' - ' . $order['customerName'] . ' - ' . $order['deliveryDate'];
            $sent = wp_mail($email, $subject, strik_business_b2b_confirmation_html($order, $audience === 'backup', $updated), $headers);
            $receipt['state'] = $sent ? 'sent' : 'failed';
            $receipt['sentAt'] = $sent ? wp_date(DATE_ATOM) : '';
            $receipt['error'] = $sent ? '' : 'Bestelling opgeslagen, maar deze mail is niet verstuurd. Probeer opnieuw.';
            update_option($key, $receipt, false);
            if (get_option($key) !== $receipt) { $receipt['state'] = 'sending'; $receipt['sentAt'] = ''; }
        }
    }
    if ($receipt['state'] === 'sending') $receipt['error'] = 'De verzendstatus is onzeker. Controleer eerst de mailbox; deze versie wordt niet automatisch nogmaals verstuurd.';
    $order['confirmationMail'][$audience] = $receipt;
    if ($audience === 'backup' && $receipt['state'] === 'sent' && isset($receipt['snapshot'])) $order['confirmationMail']['lastBackupSnapshot'] = $receipt['snapshot'];
    if ($audience === 'backup') {
        $order['confirmationEmailedAt'] = $receipt['sentAt'];
        $order['confirmationEmailError'] = $receipt['error'];
    }
    return $order;
}
function strik_business_b2b_send_quotation($order) {
    // Called inside the same database lock as ordinary order updates. Claim a
    // durable per-version receipt before sending; uncertain attempts stay put.
    $version = $order['quotationMail']['version'];
    $key = 'strik_b2b_mail_' . hash('sha256', $order['id'] . '|quotation|' . $version);
    $receipt = get_option($key, array());
    if (empty($receipt['state']) || $receipt['state'] === 'failed') {
        $receipt = array('version' => $version, 'email' => $order['customerEmail'], 'state' => 'sending', 'sentAt' => '', 'error' => '');
        update_option($key, $receipt, false);
        if (get_option($key) !== $receipt) {
            $receipt['state'] = 'failed'; $receipt['error'] = 'Verzending gestopt: de verzendregistratie kon niet worden opgeslagen.';
        } else {
            $sent = wp_mail($order['customerEmail'], strik_business_b2b_quotation_subject($order), strik_business_b2b_confirmation_html($order, false, false, true), array('Content-Type: text/html; charset=UTF-8', 'Reply-To: Strik Patisserie <info@strik-patisserie.nl>'));
            $receipt['state'] = $sent ? 'sent' : 'failed';
            $receipt['sentAt'] = $sent ? wp_date(DATE_ATOM) : '';
            $receipt['error'] = $sent ? '' : 'De mail is niet verstuurd. Je kunt dezelfde versie opnieuw proberen.';
            update_option($key, $receipt, false);
            if (get_option($key) !== $receipt) { $receipt['state'] = 'sending'; $receipt['sentAt'] = ''; }
        }
    }
    if ($receipt['state'] === 'sending') $receipt['error'] = 'De verzendstatus is onzeker. Controleer eerst de mailbox; deze versie wordt niet automatisch opnieuw verstuurd.';
    $order['quotationMail']['customer'] = $receipt;
    return $order;
}
}

if (!function_exists('strik_sinterklaas_b2b_save')) {
function strik_sinterklaas_b2b_save($request) {
    return strik_business_b2b_locked(function () use ($request) { return strik_sinterklaas_b2b_save_unlocked($request); });
}
function strik_sinterklaas_b2b_save_unlocked($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error('strik_sinterklaas_invalid_json', 'Geen geldige B2B-bestelling ontvangen.', array('status' => 400));
    }

    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $id = isset($params['id']) ? strik_sinterklaas_text($params['id'], 120) : '';
    $existing = $id !== '' && isset($orders[strik_sinterklaas_order_key($id)])
        ? $orders[strik_sinterklaas_order_key($id)]
        : array();
    if (!empty($params['previewCustomerQuotation']) || !empty($params['sendCustomerQuotation'])) {
        if (empty($existing) || !in_array($existing['status'], array('aanvraag', 'offerte'), true) || !empty($existing['cancelled']) || strpos($existing['id'], 'historie-') === 0) return new WP_Error('quotation_not_active', 'Alleen een actieve aanvraag of offerte kan op deze manier worden gemaild.', array('status' => 409));
        if (trim($existing['orderText']) === '' && empty($existing['letterLines'])) return new WP_Error('quotation_empty', 'Voeg eerst de producten of een omschrijving van de aanvraag toe.', array('status' => 400));
        $order = strik_business_b2b_prepare_confirmation($existing);
        if (!empty($params['previewCustomerQuotation'])) return rest_ensure_response(array('order' => $order, 'subject' => strik_business_b2b_quotation_subject($order), 'html' => strik_business_b2b_confirmation_html($order, false, false, true)));
        if (empty($params['quotationVersion']) || !hash_equals($order['quotationMail']['version'], (string) $params['quotationVersion'])) return new WP_Error('quotation_changed', 'De aanvraag, offerte of ontvanger is intussen gewijzigd. Open het mailvoorbeeld opnieuw.', array('status' => 409));
        if (!is_email($order['customerEmail'])) return new WP_Error('quotation_missing_email', 'Vul eerst een geldig e-mailadres bij de aanvraag of offerte in.', array('status' => 400));
        if (!strik_business_b2b_store_confirmed($order)) return new WP_Error('quotation_storage', 'Verzending gestopt: de aanvraag of offerte kon niet worden opgeslagen.', array('status' => 503));
        $order = strik_business_b2b_send_quotation($order);
        if (!strik_business_b2b_store_confirmed($order)) return new WP_Error('quotation_receipt_storage', 'Verzending verwerkt, maar de mailstatus kon niet worden opgeslagen. Haal de gegevens opnieuw op; dezelfde versie wordt niet dubbel verstuurd.', array('status' => 503));
        return rest_ensure_response($order);
    }
    if (!empty($params['previewCustomerConfirmation']) || !empty($params['sendCustomerConfirmation'])) {
        if (empty($existing) || $existing['status'] !== 'akkoord' || !empty($existing['cancelled'])) return new WP_Error('confirmation_not_final', 'Alleen een actieve definitieve bestelling kan worden bevestigd.', array('status' => 409));
        $order = strik_business_b2b_prepare_confirmation($existing);
        if (!empty($params['previewCustomerConfirmation'])) {
            $previous = isset($order['confirmationMail']['customer']) ? $order['confirmationMail']['customer'] : array();
            $updated = isset($previous['version']) && $previous['version'] === $order['confirmationMail']['version'] ? !empty($previous['updated']) : !empty($previous['sentAt']);
            return rest_ensure_response(array('order' => $order, 'html' => strik_business_b2b_confirmation_html($order, false, $updated)));
        }
        if (empty($params['confirmationVersion']) || !hash_equals($order['confirmationMail']['version'], (string) $params['confirmationVersion'])) return new WP_Error('confirmation_changed', 'De bestelling is intussen gewijzigd. Open het mailvoorbeeld opnieuw en controleer de nieuwe gegevens.', array('status' => 409));
        if (!is_email($order['customerEmail'])) return new WP_Error('confirmation_missing_email', 'Vul eerst een geldig e-mailadres bij de bestelling in.', array('status' => 400));
        if (!strik_business_b2b_store_confirmed($order)) return new WP_Error('confirmation_storage', 'Verzending gestopt: de bestelling kon niet worden opgeslagen.', array('status' => 503));
        $updated = !empty($order['confirmationMail']['customer']['sentAt']);
        $order = strik_business_b2b_send_confirmation($order, 'backup', $updated);
        $order = strik_business_b2b_send_confirmation($order, 'customer', $updated);
        if (!strik_business_b2b_store_confirmed($order)) return new WP_Error('confirmation_receipt_storage', 'De verzending is verwerkt, maar de status kon niet bij de bestelling worden opgeslagen. Probeer opnieuw; dezelfde versie wordt niet dubbel verstuurd.', array('status' => 503));
        return rest_ensure_response($order);
    }
    $order = strik_sinterklaas_sanitize_b2b_order(array_merge(is_array($existing) ? $existing : array(), $params), is_array($existing) ? $existing : array());

    if ($order === null) {
        return new WP_Error('strik_sinterklaas_invalid_b2b_order', 'Controleer klantnaam, bestelling, leverdatum en chocoladeletterregels (soort, formaat, letter en aantal).', array('status' => 400));
    }

    if (!empty($existing)) {
        $previous = strik_business_b2b_prepare_confirmation($existing);
        $order['confirmationMail'] = $previous['confirmationMail'];
        $order['quotationMail'] = $previous['quotationMail'];
    }
    $order = strik_business_b2b_prepare_confirmation($order);
    $became_confirmed = $order['status'] === 'akkoord'
        && (empty($existing) || (isset($existing['status']) && $existing['status'] !== 'akkoord'));
    $before = !empty($existing) ? strik_business_b2b_mail_content($existing, true) : array();
    $after = strik_business_b2b_mail_content($order, true);
    $details_changed = !empty($existing) && $before !== $after;
    if ($became_confirmed) {
        $order['confirmationMail']['backupChanges'] = array();
        $order['confirmationMail']['backupChangesVersion'] = $order['confirmationMail']['backupVersion'];
    } elseif ($details_changed) {
        $baseline = isset($order['confirmationMail']['lastBackupSnapshot']) ? $order['confirmationMail']['lastBackupSnapshot'] : $before;
        $changes = strik_business_b2b_order_changes($baseline, $after);
        $order['confirmationMail']['backupChanges'] = count($changes) ? $changes : strik_business_b2b_order_changes($before, $after);
        $order['confirmationMail']['backupChangesVersion'] = $order['confirmationMail']['backupVersion'];
    }
    if (!strik_business_b2b_store_confirmed($order)) return new WP_Error('b2b_storage_failed', 'De bestelling kon niet worden opgeslagen. Er is geen mail verstuurd.', array('status' => 503));
    $retry_requested = !empty($params['resendConfirmation']) && $order['status'] === 'akkoord';
    $skip_historical_import = empty($existing) && $order['source'] === 'excel';
    if ($order['status'] === 'akkoord' && empty($order['cancelled']) && !$skip_historical_import && ($became_confirmed || $details_changed || $retry_requested)) {
        $order = strik_business_b2b_send_confirmation($order, 'backup', !$became_confirmed);
        if (!strik_business_b2b_store_confirmed($order)) return new WP_Error('confirmation_receipt_storage', 'Bestelling opgeslagen; de mailstatus kon niet worden bijgewerkt. Probeer opnieuw; dezelfde versie wordt niet dubbel verstuurd.', array('status' => 503));
    }

    return rest_ensure_response($order);
}
}

if (!function_exists('strik_sinterklaas_create_b2b_confirmation_body')) {
function strik_sinterklaas_create_b2b_confirmation_body($order, $is_new_confirmation = true) {
    $fields = array(
        'Klant' => $order['customerName'],
        'Contactpersoon' => $order['contactName'],
        'E-mail klant' => $order['customerEmail'],
        'Telefoon' => $order['phone'],
        'Leverdatum' => $order['deliveryDate'],
        'Einde gewenste leverperiode' => isset($order['deliveryDateEnd']) ? $order['deliveryDateEnd'] : '',
        'Gewenste leverweek' => isset($order['deliveryWeek']) ? $order['deliveryWeek'] : '',
        'Afdeling' => $order['department'],
        'Bestelling' => $order['orderText'],
        'Logo' => $order['logo'],
        'Tekst' => $order['textInstructions'],
        'Verpakking' => $order['packaging'],
        'Belangrijke opmerkingen' => $order['importantNotes'],
        'Levering / afhalen' => $order['deliveryMethod'],
        'Bezorgadres' => $order['deliveryAddress'],
        'Prijsafspraak' => $order['priceAgreement'],
        'Totaal ex btw' => $order['totalExVat'],
        'Factuurgegevens' => $order['invoiceInfo'],
    );
    $lines = array($is_new_confirmation ? 'Nieuwe definitieve B2B-bestelling.' : 'Bijgewerkte definitieve B2B-bestelling: gebruik deze versie.', 'Zet deze bestelling in Bake-it en controleer de productieplanning.', '');
    foreach ($fields as $label => $value) {
        $lines[] = $label . ': ' . ($value !== '' ? $value : 'nog niet ingevuld');
    }
    if (!empty($order['productionDate'])) $lines[] = 'Optioneel geplande productiedag: ' . $order['productionDate'];
    if (!empty($order['letterOrderText'])) $lines[] = 'Oude vrije letteromschrijving: ' . $order['letterOrderText'];
    if (!empty($order['letterLines'])) {
        $lines[] = 'Chocoladeletterregels:';
        foreach ($order['letterLines'] as $line) $lines[] = sprintf('%d x %s - %s %s - %s%s', $line['quantity'], $line['letter'], $line['chocolate'], $line['style'], $line['size'], !empty($line['exceptions']) ? ' - VEREIST: ' . implode(', ', $line['exceptions']) : '') . ((isset($line['withLogo']) ? $line['withLogo'] : !empty($order['logo'])) ? ' - EIGEN LOGO' : '');
    }
    $lines[] = '';
    $lines[] = 'Order-id: ' . $order['id'];
    $lines[] = 'Dit is de back-upkopie van de bestelling uit de Strik Team app.';
    return implode("\n", $lines);
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
    return strik_business_b2b_locked(function () use ($request) { return strik_sinterklaas_b2b_delete_unlocked($request); });
}
function strik_sinterklaas_b2b_delete_unlocked($request) {
    $id = strik_sinterklaas_request_id($request);
    $params = $request->get_json_params();
    $reason = is_array($params) && isset($params['reason']) ? strik_sinterklaas_text($params['reason'], 40) : '';
    $reason_note = is_array($params) && isset($params['reasonNote']) ? strik_sinterklaas_textarea($params['reasonNote'], 500) : '';
    $reason_labels = array(
        'geannuleerd_door_klant' => 'Geannuleerd door klant',
        'verkeerd_ingevoerd' => 'Verkeerd ingevoerd',
        'anders' => 'Anders',
    );
    if ($id === '' || !isset($reason_labels[$reason]) || ($reason === 'anders' && $reason_note === '')) {
        return new WP_Error('strik_sinterklaas_invalid_delete', 'Kies een reden voor het verwijderen en licht Anders toe.', array('status' => 400));
    }

    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $key = strik_sinterklaas_order_key($id);
    if (!isset($orders[$key])) return rest_ensure_response(array('deleted' => false, 'id' => $id));

    $order = $orders[$key];
    if (!isset($order['status']) || $order['status'] === 'akkoord') {
        $lines = array(
            'LET OP: deze definitieve B2B-bestelling is verwijderd uit de Strik Team app.',
            'Reden: ' . $reason_labels[$reason] . ($reason_note !== '' ? ' - ' . $reason_note : ''),
            '',
            'Klant: ' . $order['customerName'],
            'Leverdatum: ' . $order['deliveryDate'],
            'Bestelling: ' . $order['orderText'],
            'Alleen chocoladeletters: ' . (isset($order['letterOrderText']) ? $order['letterOrderText'] : ''),
            'Letterregels: ' . wp_json_encode(isset($order['letterLines']) ? $order['letterLines'] : array()),
            'Order-id: ' . $order['id'],
            '',
            'Controleer Bake-it en de productieplanning; daar wordt niets automatisch verwijderd.',
        );
        $sent = wp_mail(
            STRIK_SINTERKLAAS_RECIPIENT,
            'LET OP: DEFINITIEVE B2B-BESTELLING VERWIJDERD - ' . $order['customerName'],
            implode("\n", $lines),
            array('Content-Type: text/plain; charset=UTF-8')
        );
        if (!$sent) return new WP_Error('strik_sinterklaas_delete_mail_failed', 'Verwijderen gestopt: de waarschuwingsmail kon niet worden verstuurd.', array('status' => 503));
    }

    unset($orders[$key]);
    strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
    return rest_ensure_response(array('deleted' => true, 'id' => $id));
}
}

if (!function_exists('strik_business_b2b_delivery_window')) {
function strik_business_b2b_delivery_window($order) {
    $type = isset($order['deliveryWindowType']) ? $order['deliveryWindowType'] : 'date';
    $start = isset($order['deliveryDate']) ? $order['deliveryDate'] : '';
    $end = isset($order['deliveryDateEnd']) ? $order['deliveryDateEnd'] : '';
    $week = isset($order['deliveryWeek']) ? $order['deliveryWeek'] : '';
    if (!empty($order['sourceSheet']) && preg_match('/__STRIK_LEVERPERIODE__(range|week)\|([^|]*)\|([^|]*)$/', $order['sourceSheet'], $m)) {
        $type = $m[1]; $end = $m[2]; $week = $m[3];
    }
    $valid = function ($value) {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('Europe/Amsterdam'));
        return $date && $date->format('Y-m-d') === $value;
    };
    if ($type === 'week' && preg_match('/^(\d{4})-W(\d{2})$/', $week, $m)) {
        $monday = (new DateTimeImmutable('today', new DateTimeZone('Europe/Amsterdam')))->setISODate((int) $m[1], (int) $m[2], 1);
        if ($monday->format('o-\WW') !== $week) return null;
        return array('start' => $monday->format('Y-m-d'), 'end' => $monday->modify('+6 days')->format('Y-m-d'), 'type' => 'week');
    }
    if (!$valid($start)) return null;
    return array('start' => $start, 'end' => $type === 'range' && $valid($end) && $end >= $start ? $end : $start, 'type' => $type);
}

function strik_business_b2b_attention($order, $today) {
    if (!is_array($order) || empty($order['id']) || strpos($order['id'], 'historie-') === 0 || !empty($order['cancelled']) || !empty($order['delivered'])) return null;
    $status = isset($order['status']) ? $order['status'] : 'aanvraag';
    if ($status === 'afgewezen' || ($status === 'akkoord' && !empty($order['entered']))) return null;
    $window = strik_business_b2b_delivery_window($order);
    if (!$window || $window['end'] < $today) return null;
    $timezone = new DateTimeZone('Europe/Amsterdam');
    $days = (int) (new DateTimeImmutable($today, $timezone))->diff(new DateTimeImmutable($window['start'], $timezone))->format('%r%a');
    if ($days > 7) return null;
    // A still-open delivery period remains relevant after its first possible day.
    $days = max(0, $days);
    $reason = $status === 'akkoord' ? 'not-entered' : 'not-confirmed';
    $stage = $days === 0 ? 'delivery-day' : ($days <= 2 ? 'two-days' : 'one-week');
    return array('reason' => $reason, 'stage' => $stage, 'days' => $days, 'window' => $window,
        'version' => hash('sha256', wp_json_encode(array($order['id'], $window, $reason, $stage))));
}

function strik_business_b2b_attention_html($order, $attention) {
    $data = strik_business_b2b_confirmation_data($order);
    $final = $attention['reason'] === 'not-entered';
    $title = $final ? 'Let op: nog invoeren in Bake-it' : 'Controleer akkoord en invoer';
    $action = $final ? 'Deze bestelling is definitief, maar nog niet als ingevoerd gemarkeerd. Voer de bestelling in Bake-it in en controleer de bon en bezorgafspraak.' : 'Deze aanvraag of offerte is nog niet definitief. Controleer het akkoord bij de klant en zorg dat de bestelling daarna ook in Bake-it staat.';
    $season = $order['season'] === 'kerst' ? 'Kerst' : ($order['season'] === 'sint-kerst' ? 'Sint & Kerst' : 'Sinterklaas');
    $url = 'https://app.strik-patisserie.nl/' . ($order['season'] === 'kerst' ? 'kerst' : 'sinterklaas') . '/b2b';
    $p = function ($text) { return nl2br(esc_html($text)); };
    $html = '<!doctype html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf3ed;font-family:Arial,sans-serif;color:#293e30"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf8;border-radius:22px;overflow:hidden"><tr><td style="padding:28px;background:#244b37;color:#fff"><p style="color:#e9cc89;font-size:12px;letter-spacing:2px">STRIK PATISSERIE · INTERNE CONTROLE</p><p>' . esc_html($season) . '</p><h1 style="font-size:26px;line-height:1.2">' . esc_html($title) . '</h1><strong>' . esc_html($data['company']) . '</strong></td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.55">';
    $html .= '<p style="padding:18px;background:#fff2d7;border-radius:12px"><strong>' . ($attention['days'] === 0 ? 'Levering vanaf vandaag / lopende leverperiode' : 'Eerste mogelijke levering over ' . (int) $attention['days'] . ' ' . ($attention['days'] === 1 ? 'dag' : 'dagen')) . '</strong><br>' . esc_html($action) . '</p>';
    $html .= '<h2 style="font-size:18px">Levering</h2><p><strong>' . esc_html($data['moment']) . '</strong><br>' . esc_html($data['method'] ?: 'Leverwijze nog afspreken') . ($data['address'] !== '' ? '<br>' . $p($data['address']) : '') . '</p>';
    $html .= '<p><strong>Fase:</strong> ' . ($final ? 'Definitief' : ($order['status'] === 'offerte' ? 'Offerte · akkoord nog controleren' : 'Aanvraag · akkoord nog controleren')) . '<br><strong>Bake-it:</strong> ' . (!empty($order['entered']) ? 'Gemarkeerd als ingevoerd' : 'Nog niet gemarkeerd als ingevoerd') . '</p>';
    $html .= '<h2 style="font-size:18px">Bestelling</h2>' . strik_business_quote_details_html($data['products']);
    foreach ($data['letters'] as $line) $html .= '<p><strong>' . absint($line['quantity']) . '× ' . esc_html(($line['style'] === 'vorm' ? 'Vormletter ' : 'Spuitletter ') . $line['letter']) . '</strong> · ' . esc_html($line['chocolate'] . ' · ' . $line['size']) . (!empty($line['withLogo']) ? ' · <strong>Eigen logo</strong>' : '') . (!empty($line['exceptions']) ? '<br>' . esc_html(implode(', ', $line['exceptions'])) : '') . '</p>';
    if ($data['legacyLetters'] !== '') $html .= '<p>' . $p($data['legacyLetters']) . '</p>';
    foreach (array('Logo' => $data['logo'], 'Verpakking' => $data['packaging'], 'Tekst' => $data['text'], 'Interne opmerkingen' => $order['importantNotes']) as $label => $value) if ($value !== '') $html .= '<p><strong>' . esc_html($label) . '</strong><br>' . $p($value) . '</p>';
    $html .= '<h2 style="font-size:18px">Contact</h2><p>' . $p(implode("\n", array_filter(array($data['company'], $data['contact'], $data['email'], $data['phone'])))) . '</p><p><strong>' . ($final ? 'Afgesproken totaal' : 'Huidige prijsindicatie') . ':</strong> ' . esc_html(strik_business_b2b_total_label($data['total'])) . ' excl. btw</p>';
    return $html . '<p><a href="' . esc_url($url) . '" style="display:inline-block;padding:13px 20px;background:#244b37;color:#fff;border-radius:24px;text-decoration:none;font-weight:bold">Open B2B-bestellingen &rarr;</a></p><p style="font-size:12px;color:#637568">Automatische interne controle. Deze mail gaat uitsluitend naar info@strik-patisserie.nl.</p></td></tr></table></td></tr></table></body></html>';
}

function strik_business_b2b_reminders_unlocked($today, $dry_run = false) {
    $orders = strik_sinterklaas_get_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME);
    $result = array('date' => $today, 'eligible' => 0, 'sent' => 0, 'failed' => 0, 'uncertain' => 0, 'alreadySent' => 0, 'dryRun' => $dry_run);
    foreach ($orders as $key => $order) {
        $attention = strik_business_b2b_attention($order, $today);
        if (!$attention) continue;
        $result['eligible']++;
        $receipt_key = 'strik_b2b_attention_' . $attention['version'];
        $receipt = get_option($receipt_key, array());
        if (!empty($receipt['state']) && $receipt['state'] === 'sent') { $orders[$key]['attentionMail'] = $receipt; $orders[$key]['reminderEmailedAt'] = $receipt['sentAt']; $orders[$key]['reminderEmailError'] = ''; $result['alreadySent']++; continue; }
        if (!empty($receipt['state']) && $receipt['state'] === 'sending') { $orders[$key]['attentionMail'] = $receipt; $orders[$key]['reminderEmailError'] = 'Verzendstatus onzeker; controleer de mailbox.'; $result['uncertain']++; continue; }
        if ($dry_run) continue;
        $receipt = array('state' => 'sending', 'version' => $attention['version'], 'reason' => $attention['reason'], 'stage' => $attention['stage'], 'sentAt' => '', 'error' => '');
        update_option($receipt_key, $receipt, false);
        if (get_option($receipt_key) !== $receipt) { $orders[$key]['reminderEmailError'] = 'Interne controlewaarschuwing gestopt: verzendregistratie kon niet worden opgeslagen.'; $result['failed']++; continue; }
        $subject = ($attention['reason'] === 'not-entered' ? 'LET OP: nog invoeren in Bake-it' : 'CONTROLEER: bestelling definitief en ingevoerd?') . ' - ' . $order['customerName'] . ' - ' . $attention['window']['start'];
        try {
            $sent = wp_mail(STRIK_SINTERKLAAS_RECIPIENT, $subject, strik_business_b2b_attention_html($order, $attention), array('Content-Type: text/html; charset=UTF-8'));
            $receipt['state'] = $sent ? 'sent' : 'failed';
            $receipt['sentAt'] = $sent ? wp_date(DATE_ATOM) : '';
            $receipt['error'] = $sent ? '' : 'Interne controlewaarschuwing kon niet worden verstuurd.';
        } catch (Throwable $error) {
            $receipt['state'] = 'sending';
            $receipt['error'] = 'Verzendstatus onzeker; controleer de mailbox voordat opnieuw wordt verstuurd.';
        }
        update_option($receipt_key, $receipt, false);
        if (get_option($receipt_key) !== $receipt) { $receipt['state'] = 'sending'; $receipt['sentAt'] = ''; $receipt['error'] = 'Verzendstatus onzeker; controleer de mailbox.'; }
        $result[$receipt['state'] === 'sent' ? 'sent' : ($receipt['state'] === 'failed' ? 'failed' : 'uncertain')]++;
        $orders[$key]['attentionMail'] = $receipt;
        $orders[$key]['reminderEmailedAt'] = $receipt['sentAt'];
        $orders[$key]['reminderEmailError'] = $receipt['error'];
    }
    if (!$dry_run) strik_sinterklaas_save_orders(STRIK_SINTERKLAAS_B2B_OPTION_NAME, $orders);
    return $result;
}

function strik_business_b2b_send_reminders($request) {
    $params = $request->get_json_params();
    $dry_run = is_array($params) && !empty($params['dryRun']);
    $today = (new DateTimeImmutable('today', new DateTimeZone('Europe/Amsterdam')))->format('Y-m-d');
    $result = strik_business_b2b_locked(function () use ($today, $dry_run) { return strik_business_b2b_reminders_unlocked($today, $dry_run); });
    return is_wp_error($result) ? $result : rest_ensure_response($result);
}
}


if (!function_exists('strik_business_mailing_selection')) {
function strik_business_mailing_selection($value) {
    return in_array($value, array('sint', 'kerst', 'sint-kerst'), true) ? $value : 'sint';
}
function strik_business_mailing_key($year, $selection) {
    return $selection === 'sint' ? $year : $year . ':' . $selection;
}
function strik_business_mailing_contacts($campaigns) {
    $book = get_option('strik_business_mailing_contacts_v1', null);
    if (is_array($book) && isset($book['customers'], $book['revision'])) return $book;
    // Start with the newest saved campaign, retaining contacts from older years.
    krsort($campaigns);
    $customers = array();
    $seen = array();
    foreach ($campaigns as $campaign) {
        foreach (isset($campaign['customers']) ? $campaign['customers'] : array() as $customer) {
            $recipients = array();
            foreach ($customer['recipients'] as $recipient) {
                $email = strtolower(trim($recipient['email']));
                if (isset($seen[$email])) {
                    // Never lose an unsubscribe when joining historical lists.
                    if (!empty($recipient['doNotEmail'])) {
                        foreach ($customers as &$saved_customer) foreach ($saved_customer['recipients'] as &$saved_recipient) {
                            if (strtolower($saved_recipient['email']) === $email) $saved_recipient['doNotEmail'] = true;
                        }
                        unset($saved_customer, $saved_recipient);
                    }
                    continue;
                }
                $seen[$email] = true;
                $recipient['sent'] = array();
                $recipients[] = $recipient;
            }
            if (!$recipients) continue;
            unset($customer['ordered'], $customer['orderedAt']);
            $customer['recipients'] = $recipients;
            $customers[] = $customer;
        }
    }
    return array('revision' => 0, 'customers' => strik_business_mailing_address_book($customers));
}
function strik_business_mailing_address_book($customers) {
    $result = array(); $seen = array(); $groups = array();
    foreach ($customers as $customer) {
        unset($customer['ordered'], $customer['orderedAt']);
        $group = strtolower(trim($customer['company']));
        if ($group === '') $group = $customer['id'];
        if (!isset($groups[$group])) {
            $groups[$group] = count($result);
            $copy = $customer; $copy['recipients'] = array();
            $result[] = $copy;
        }
        $ci = $groups[$group];
        foreach ($customer['recipients'] as $recipient) {
            $email = strtolower(trim($recipient['email']));
            if (isset($seen[$email])) {
                if (!empty($recipient['doNotEmail'])) {
                    $indices = $seen[$email];
                    $result[$indices[0]]['recipients'][$indices[1]]['doNotEmail'] = true;
                }
                continue;
            }
            $seen[$email] = array($ci, count($result[$ci]['recipients']));
            $recipient['sent'] = array();
            $result[$ci]['recipients'][] = $recipient;
        }
    }
    return array_values(array_filter($result, function ($customer) { return !empty($customer['recipients']); }));
}
function strik_business_mailing_overlay($campaign, $book) {
    $history = array(); $states = array();
    foreach (isset($campaign['customers']) ? $campaign['customers'] : array() as $customer) {
        foreach ($customer['recipients'] as $recipient) {
            $email = strtolower(trim($recipient['email']));
            $history[$email] = isset($recipient['sent']) ? $recipient['sent'] : array();
            $states[$email] = array('ordered' => !empty($customer['ordered']), 'orderedAt' => isset($customer['orderedAt']) ? $customer['orderedAt'] : '');
        }
    }
    $customers = $book['customers'];
    foreach ($customers as &$customer) {
        $customer['ordered'] = false; $customer['orderedAt'] = '';
        foreach ($customer['recipients'] as &$recipient) {
            $email = strtolower(trim($recipient['email']));
            $recipient['sent'] = isset($history[$email]) ? $history[$email] : array();
            if (!empty($states[$email]['ordered'])) {
                $customer['ordered'] = true; $customer['orderedAt'] = $states[$email]['orderedAt'];
            }
        }
        unset($recipient);
    }
    unset($customer);
    $campaign['customers'] = $customers;
    $campaign['contactsRevision'] = $book['revision'];
    return $campaign;
}
}

if (!function_exists('strik_sinterklaas_mailing_clean')) {
function strik_sinterklaas_mailing_clean($input, $existing = array()) {
    $customers = array(); $history_by_email = array();
    foreach (isset($existing['customers']) ? $existing['customers'] : array() as $old_customer) foreach ($old_customer['recipients'] as $old_recipient) $history_by_email[strtolower($old_recipient['email'])] = isset($old_recipient['sent']) ? $old_recipient['sent'] : array();
    foreach (array_slice(isset($input['customers']) && is_array($input['customers']) ? $input['customers'] : array(), 0, 2000) as $customer) {
        if (!is_array($customer)) continue;
        $customer_id = strik_sinterklaas_text(isset($customer['id']) ? $customer['id'] : '', 100);
        if ($customer_id === '') $customer_id = strik_sinterklaas_create_id('mailcustomer', isset($customer['company']) ? $customer['company'] : '');
        $recipients = array();
        foreach (array_slice(isset($customer['recipients']) && is_array($customer['recipients']) ? $customer['recipients'] : array(), 0, 30) as $recipient) {
            if (!is_array($recipient)) continue;
            $email = strik_sinterklaas_email(isset($recipient['email']) ? $recipient['email'] : '');
            if ($email === '') continue;
            $recipient_id = strik_sinterklaas_text(isset($recipient['id']) ? $recipient['id'] : '', 100);
            if ($recipient_id === '') $recipient_id = strik_sinterklaas_create_id('mailaddress', $email);
            // Delivery history belongs to the server, never to a stale browser.
            $sent = isset($history_by_email[strtolower($email)]) ? $history_by_email[strtolower($email)] : array();
            $interests = array_values(array_intersect(array('sint', 'kerst'), isset($recipient['interests']) && is_array($recipient['interests']) ? $recipient['interests'] : array()));
            $recipients[] = array('id' => $recipient_id, 'contactName' => strik_sinterklaas_text(isset($recipient['contactName']) ? $recipient['contactName'] : '', 160), 'email' => $email, 'doNotEmail' => !empty($recipient['doNotEmail']), 'sent' => $sent, 'interests' => $interests, 'consentAt' => strik_sinterklaas_text(isset($recipient['consentAt']) ? $recipient['consentAt'] : '', 80), 'consentSource' => strik_sinterklaas_text(isset($recipient['consentSource']) ? $recipient['consentSource'] : '', 160));
        }
        $customers[] = array('id' => $customer_id, 'company' => strik_sinterklaas_text(isset($customer['company']) ? $customer['company'] : '', 180), 'notes' => strik_sinterklaas_textarea(isset($customer['notes']) ? $customer['notes'] : '', 1600), 'ordered' => !empty($customer['ordered']), 'orderedAt' => strik_sinterklaas_text(isset($customer['orderedAt']) ? $customer['orderedAt'] : '', 80), 'recipients' => $recipients);
    }
    $result = array('year' => strik_sinterklaas_year(isset($input['year']) ? $input['year'] : ''), 'selection' => strik_business_mailing_selection(isset($input['selection']) ? $input['selection'] : 'sint'), 'customers' => $customers, 'updatedAt' => wp_date(DATE_ATOM));
    foreach (array('subject', 'reminder1Subject', 'reminder2Subject') as $key) $result[$key] = strik_sinterklaas_text(isset($input[$key]) ? $input[$key] : '', 240);
    foreach (array('body', 'reminder1Body', 'reminder2Body') as $key) $result[$key] = strik_sinterklaas_textarea(isset($input[$key]) ? $input[$key] : '', 12000);
    foreach (array('folderUrl', 'kerstFolderUrl') as $key) $result[$key] = esc_url_raw(isset($input[$key]) ? $input[$key] : '');
    return $result;
}
}

if (!function_exists('strik_sinterklaas_mailing_response')) {
function strik_sinterklaas_mailing_response($campaign) {
    if (!is_array($campaign)) $campaign = array();
    $campaign['mailTemplateVersion'] = 'strik-seasons-v1';
    $campaign['mailingSeasonsVersion'] = 'shared-v1';
    return rest_ensure_response($campaign);
}
}

if (!function_exists('strik_sinterklaas_mailing_get')) {
function strik_sinterklaas_mailing_get($request) {
    $year = strik_sinterklaas_year($request->get_param('year'));
    $selection = strik_business_mailing_selection($request->get_param('season'));
    $campaigns = get_option(STRIK_SINTERKLAAS_MAILING_OPTION_NAME, array());
    if (!is_array($campaigns)) $campaigns = array();
    $key = strik_business_mailing_key($year, $selection);
    $campaign = isset($campaigns[$key]) ? $campaigns[$key] : array('year' => $year, 'selection' => $selection, 'customers' => array());
    return strik_sinterklaas_mailing_response(strik_business_mailing_overlay($campaign, strik_business_mailing_contacts($campaigns)));
}
}

if (!function_exists('strik_business_mailing_prepare')) {
function strik_business_mailing_prepare($input, $selection) {
    $campaigns = get_option(STRIK_SINTERKLAAS_MAILING_OPTION_NAME, array());
    if (!is_array($campaigns)) $campaigns = array();
    $year = strik_sinterklaas_year(isset($input['year']) ? $input['year'] : '');
    $key = strik_business_mailing_key($year, $selection);
    $existing = isset($campaigns[$key]) ? $campaigns[$key] : array();
    $campaign = strik_sinterklaas_mailing_clean($input, $existing);
    $campaign['selection'] = $selection;
    $book = strik_business_mailing_contacts($campaigns);
    $contacts = strik_business_mailing_address_book($campaign['customers']);
    $changed = json_encode($contacts) !== json_encode(strik_business_mailing_address_book($book['customers']));
    $revision = isset($input['contactsRevision']) ? (int) $input['contactsRevision'] : 0;
    if ($changed && $revision !== (int) $book['revision']) return new WP_Error('contacts_changed', 'De gedeelde contactenlijst is intussen gewijzigd. Ververs de pagina voordat je opslaat; je campagne is niet overschreven.', array('status' => 409));
    if ($changed || (int) $book['revision'] === 0) {
        $book = array('revision' => (int) $book['revision'] + 1, 'customers' => $contacts);
        update_option('strik_business_mailing_contacts_v1', $book, false);
    }
    $campaign = strik_business_mailing_overlay($campaign, $book);
    $campaigns[$key] = $campaign;
    update_option(STRIK_SINTERKLAAS_MAILING_OPTION_NAME, $campaigns, false);
    return $campaign;
}
}

if (!function_exists('strik_sinterklaas_mailing_save')) {
function strik_sinterklaas_mailing_save($request) {
    $input = $request->get_json_params();
    if (!is_array($input)) return new WP_Error('invalid_mailing', 'Ongeldige mailing.', array('status' => 400));
    $campaign = strik_business_mailing_prepare($input, strik_business_mailing_selection($request->get_param('season')));
    return is_wp_error($campaign) ? $campaign : strik_sinterklaas_mailing_response($campaign);
}
}

if (!function_exists('strik_sinterklaas_mailing_send')) {
function strik_sinterklaas_mailing_paragraphs($body) {
    $parts = preg_split('/\r?\n\s*\r?\n/', trim((string) $body)); $html = '';
    foreach ($parts as $part) if (trim($part) !== '') $html .= '<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#4d4039;">' . nl2br(esc_html(trim($part)), false) . '</p>';
    return $html;
}
function strik_sinterklaas_mailing_html($body, $folder_url, $kind, $year, $selection = 'sint', $kerst_url = '') {
    $label = $selection === 'sint-kerst' ? 'Sint & Kerst' : ($selection === 'kerst' ? 'Kerst' : 'Sinterklaas');
    $header = $selection === 'sint' ? '#efb800' : '#244b37';
    $accent = $selection === 'sint' ? '#d62d1d' : '#79233c';
    $heading = $selection === 'sint' ? '#d62d1d' : '#f2d38b';
    $links = $selection === 'sint-kerst' ? array('Bekijk de Sintfolder' => $folder_url, 'Bekijk de Kerstfolder' => $kerst_url) : array('Bekijk de ' . ($selection === 'kerst' ? 'Kerstfolder' : 'Sintfolder') => $folder_url);
    $cta = '';
    foreach ($links as $button_label => $url) {
        if (!$url) continue;
        $cta .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;"><tr><td bgcolor="' . $accent . '" style="border-radius:999px;"><a href="' . esc_url($url) . '" style="display:inline-block;padding:14px 24px;font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">' . esc_html($button_label) . ' &rarr;</a></td></tr></table>';
    }
    return '<!doctype html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f0e9;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;">'
        . '<tr><td bgcolor="' . $header . '" style="padding:26px 30px;"><img src="https://app.strik-patisserie.nl/strik-logo.png" width="52" height="52" alt="Strik Patisserie" style="display:block;border:0;">'
        . '<div style="margin-top:12px;font-family:Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:.18em;color:#ffffff;">Zakelijk ' . esc_html($label) . ' ' . esc_html($year) . '</div><div style="font-family:Georgia,serif;font-size:28px;font-style:italic;color:' . $heading . ';">Met een Strik</div></td></tr>'
        . '<tr><td style="padding:30px;">' . strik_sinterklaas_mailing_paragraphs($body) . $cta . '</td></tr>'
        . '<tr><td bgcolor="#244b37" style="padding:20px 30px;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#f9e7cd;"><strong>Strik Patisserie</strong> &middot; Nijmegen &middot; <a href="mailto:info@strik-patisserie.nl" style="color:#ffffff;">info@strik-patisserie.nl</a><br>Je ontvangt deze zakelijke mail omdat je contact hebt gehad met Strik Patisserie. Geen mails meer ontvangen? Antwoord met <strong>afmelden</strong>.</td></tr></table></td></tr></table></body></html>';
}
function strik_sinterklaas_mailing_send($request) {
    $input = $request->get_json_params();
    if (!is_array($input) || empty($input['campaign'])) return new WP_Error('invalid_mailing', 'Ongeldige verzending.', array('status' => 400));
    $selection = strik_business_mailing_selection($request->get_param('season'));
    $kind = strik_sinterklaas_text(isset($input['kind']) ? $input['kind'] : '', 20);
    if (!in_array($kind, array('folder', 'reminder1', 'reminder2'), true)) return new WP_Error('invalid_kind', 'Onbekend mailingtype.', array('status' => 400));
    $campaign = strik_business_mailing_prepare($input['campaign'], $selection);
    if (is_wp_error($campaign)) return $campaign;
    foreach ($campaign['customers'] as $ci => $customer) {
        if ($customer['id'] !== $input['customerId']) continue;
        foreach ($customer['recipients'] as $ri => $contact) {
            if ($contact['id'] !== $input['recipientId']) continue;
            $required_interests = $selection === 'sint-kerst' ? array('sint', 'kerst') : array($selection);
            if ($contact['doNotEmail'] || $contact['email'] === '' || (!empty($contact['interests']) && array_diff($required_interests, $contact['interests']))) return new WP_Error('invalid_recipient', 'Dit contact mag niet voor deze campagne worden gemaild.', array('status' => 400));
            if (!empty($customer['ordered'])) return new WP_Error('already_ordered', 'Deze klant staat voor deze campagne op besteld.', array('status' => 400));
            $request_id = strik_sinterklaas_text(isset($input['requestId']) ? $input['requestId'] : '', 160);
            $has_previous = false; $has_requirement = $kind === 'folder';
            foreach ($contact['sent'] as $event) {
                if ($request_id !== '' && isset($event['requestId']) && $event['requestId'] === $request_id) return strik_sinterklaas_mailing_response($campaign);
                if ($event['kind'] === $kind) $has_previous = true;
                if ($event['kind'] === ($kind === 'reminder1' ? 'folder' : 'reminder1')) $has_requirement = true;
            }
            if ($has_previous && empty($input['includePreviouslySent'])) return strik_sinterklaas_mailing_response($campaign);
            if (!$has_requirement) return new WP_Error('missing_previous_mail', 'Verstuur eerst de eerdere nieuwsbrief of herinnering.', array('status' => 400));
            $subject_key = $kind === 'folder' ? 'subject' : ($kind === 'reminder1' ? 'reminder1Subject' : 'reminder2Subject');
            $body_key = $kind === 'folder' ? 'body' : ($kind === 'reminder1' ? 'reminder1Body' : 'reminder2Body');
            $subject = isset($input['subject']) ? strik_sinterklaas_text($input['subject'], 240) : $campaign[$subject_key];
            $body = str_replace('{{contactpersoon}}', $contact['contactName'] !== '' ? $contact['contactName'] : 'heer/mevrouw', isset($input['body']) ? strik_sinterklaas_textarea($input['body'], 12000) : $campaign[$body_key]);
            $url = isset($campaign['folderUrl']) ? $campaign['folderUrl'] : '';
            $kerst_url = isset($campaign['kerstFolderUrl']) ? $campaign['kerstFolderUrl'] : '';
            if (!preg_match('~^https://~i', $url) || ($selection === 'sint-kerst' && !preg_match('~^https://~i', $kerst_url))) return new WP_Error('invalid_folder', 'Controleer de https-folderlinks.', array('status' => 400));
            $html = strik_sinterklaas_mailing_html($body, $url, $kind, $campaign['year'], $selection, $kerst_url);
            $headers = array('Content-Type: text/html; charset=UTF-8', 'From: Strik Patisserie <info@strik-patisserie.nl>', 'Reply-To: Strik Patisserie <info@strik-patisserie.nl>', 'List-Unsubscribe: <mailto:info@strik-patisserie.nl?subject=Afmelden%20B2B%20nieuwsbrief>');
            if (!wp_mail($contact['email'], $subject, $html, $headers)) return new WP_Error('mail_failed', 'WordPress kon de e-mail niet versturen.', array('status' => 502));
            $campaign['customers'][$ci]['recipients'][$ri]['sent'][] = array('kind' => $kind, 'sentAt' => wp_date(DATE_ATOM), 'requestId' => $request_id);
            $campaigns = get_option(STRIK_SINTERKLAAS_MAILING_OPTION_NAME, array());
            $campaigns[strik_business_mailing_key($campaign['year'], $selection)] = $campaign;
            update_option(STRIK_SINTERKLAAS_MAILING_OPTION_NAME, $campaigns, false);
            return strik_sinterklaas_mailing_response($campaign);
        }
    }
    return new WP_Error('contact_missing', 'Contact niet gevonden.', array('status' => 404));
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/business-folder-quote', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'strik_business_folder_quote',
        'permission_callback' => 'strik_sinterklaas_permission',
    ));
    register_rest_route('strik/v1', '/sinterklaas-mailing', array(
        array('methods' => WP_REST_Server::READABLE, 'callback' => 'strik_sinterklaas_mailing_get', 'permission_callback' => 'strik_sinterklaas_permission'),
        array('methods' => WP_REST_Server::CREATABLE, 'callback' => 'strik_sinterklaas_mailing_save', 'permission_callback' => 'strik_sinterklaas_permission'),
        array('methods' => WP_REST_Server::EDITABLE, 'callback' => 'strik_sinterklaas_mailing_send', 'permission_callback' => 'strik_sinterklaas_permission'),
    ));
});

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

    register_rest_route('strik/v1', '/sinterklaas-letter-reminders', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'strik_sinterklaas_send_letter_reminders',
        'permission_callback' => 'strik_sinterklaas_permission',
    ));

    register_rest_route('strik/v1', '/business-order-reminders', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'strik_business_b2b_send_reminders',
        'permission_callback' => 'strik_sinterklaas_permission',
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
