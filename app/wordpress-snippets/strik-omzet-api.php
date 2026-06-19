<?php
/**
 * Strik app - omzet API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * - GET /wp-json/strik/v1/revenue?key=...
 * - PUT/POST /wp-json/strik/v1/revenue?key=...
 */

if (!defined('STRIK_REVENUE_API_KEY')) {
    define('STRIK_REVENUE_API_KEY', 'schoonmaak-ijs-strik');
}

if (!defined('STRIK_REVENUE_OPTION_NAME')) {
    define('STRIK_REVENUE_OPTION_NAME', 'strik_revenue_data');
}

if (!function_exists('strik_revenue_permission')) {
function strik_revenue_permission($request) {
    return hash_equals(STRIK_REVENUE_API_KEY, (string) $request->get_param('key'))
        ? true
        : new WP_Error('strik_revenue_forbidden', 'Geen toegang tot omzetdata.', array('status' => 403));
}
}

if (!function_exists('strik_revenue_allowed_shops')) {
function strik_revenue_allowed_shops() {
    return array('Heyendaal', 'Ziekerstraat', 'Daalseweg', 'Lent');
}
}

if (!function_exists('strik_revenue_shop')) {
function strik_revenue_shop($value) {
    $value = sanitize_text_field((string) $value);
    foreach (strik_revenue_allowed_shops() as $shop) {
        if (strcasecmp($value, $shop) === 0) return $shop;
    }

    return '';
}
}

if (!function_exists('strik_revenue_text')) {
function strik_revenue_text($value, $max_length = 1200) {
    $value = sanitize_textarea_field((string) $value);

    return strlen($value) > $max_length ? substr($value, 0, $max_length) : $value;
}
}

if (!function_exists('strik_revenue_normalize_record')) {
function strik_revenue_normalize_record($record) {
    if (!is_array($record)) return null;

    $year = isset($record['year']) ? absint($record['year']) : 0;
    $week = isset($record['week']) ? absint($record['week']) : 0;
    $shop = isset($record['shop']) ? strik_revenue_shop($record['shop']) : '';
    $amount = isset($record['amount']) ? round((float) $record['amount'], 2) : 0;

    if ($year < 2020 || $year > 2100 || $week < 1 || $week > 53 || $shop === '') {
        return null;
    }

    return array(
        'id' => isset($record['id'])
            ? sanitize_key($record['id'])
            : sanitize_key($year . '-' . $week . '-' . $shop),
        'year' => $year,
        'week' => $week,
        'shop' => $shop,
        'amount' => max(0, $amount),
        'note' => isset($record['note']) ? strik_revenue_text($record['note']) : '',
        'source' => isset($record['source']) && $record['source'] === 'excel' ? 'excel' : 'manual',
        'updatedAt' => isset($record['updatedAt']) ? strik_revenue_text($record['updatedAt'], 120) : wp_date(DATE_ATOM),
    );
}
}

if (!function_exists('strik_revenue_normalize_data')) {
function strik_revenue_normalize_data($data) {
    if (!is_array($data)) {
        $data = array();
    }

    $records = array();
    $raw_records = isset($data['records']) && is_array($data['records']) ? $data['records'] : array();

    foreach (array_slice($raw_records, 0, 1000) as $record) {
        $clean_record = strik_revenue_normalize_record($record);
        if ($clean_record) $records[] = $clean_record;
    }

    return array(
        'records' => $records,
        'updatedAt' => isset($data['updatedAt']) ? strik_revenue_text($data['updatedAt'], 120) : '',
    );
}
}

if (!function_exists('strik_revenue_get_data')) {
function strik_revenue_get_data() {
    $data = get_option(STRIK_REVENUE_OPTION_NAME, array(
        'records' => array(),
        'updatedAt' => '',
    ));

    return strik_revenue_normalize_data($data);
}
}

if (!function_exists('strik_revenue_get')) {
function strik_revenue_get() {
    return rest_ensure_response(strik_revenue_get_data());
}
}

if (!function_exists('strik_revenue_save')) {
function strik_revenue_save($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error(
            'strik_revenue_invalid_json',
            'Geen geldige omzetdata ontvangen.',
            array('status' => 400)
        );
    }

    $clean = strik_revenue_normalize_data($params);
    $clean['updatedAt'] = wp_date(DATE_ATOM);

    update_option(STRIK_REVENUE_OPTION_NAME, $clean, false);

    return rest_ensure_response($clean);
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/revenue', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_revenue_get',
            'permission_callback' => 'strik_revenue_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_revenue_save',
            'permission_callback' => 'strik_revenue_permission',
        ),
    ));
});
