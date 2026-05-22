<?php
/**
 * Strik app - Recepturen API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * - GET /wp-json/strik/v1/recepturen?key=...
 * - PUT/POST /wp-json/strik/v1/recepturen?key=...
 *
 * Hiermee worden recepturen, ingredienten en Beko factuurimports in WordPress
 * opgeslagen zodat koppelingen en prijsupdates niet alleen lokaal/mockdata zijn.
 */

if (!defined('STRIK_RECEPTUREN_API_KEY')) {
    define('STRIK_RECEPTUREN_API_KEY', 'schoonmaak-ijs-strik');
}

if (!defined('STRIK_RECEPTUREN_OPTION_NAME')) {
    define('STRIK_RECEPTUREN_OPTION_NAME', 'strik_recepturen_data');
}

if (!defined('STRIK_RECEPTUREN_MAX_JSON_BYTES')) {
    define('STRIK_RECEPTUREN_MAX_JSON_BYTES', 4500000);
}

if (!defined('STRIK_RECEPTUREN_PHOTO_PREVIEW_MAX_BYTES')) {
    define('STRIK_RECEPTUREN_PHOTO_PREVIEW_MAX_BYTES', 60000);
}

if (!function_exists('strik_recepturen_v1_permission')) {
function strik_recepturen_v1_permission($request) {
    return hash_equals(STRIK_RECEPTUREN_API_KEY, (string) $request->get_param('key'))
        ? true
        : new WP_Error('strik_recepturen_forbidden', 'Geen toegang tot recepturen.', array('status' => 403));
}
}

if (!function_exists('strik_recepturen_v1_defaults')) {
function strik_recepturen_v1_defaults() {
    return array(
        'ingredients' => array(),
        'recipes' => array(),
        'invoiceImports' => array(),
        'updatedAt' => '',
    );
}
}

if (!function_exists('strik_recepturen_v1_text')) {
function strik_recepturen_v1_text($value, $max_length = 6000) {
    $value = (string) $value;
    if (strlen($value) > $max_length) {
        $value = substr($value, 0, $max_length);
    }

    return sanitize_textarea_field($value);
}
}

if (!function_exists('strik_recepturen_v1_sanitize_key')) {
function strik_recepturen_v1_sanitize_key($key) {
    if (is_int($key)) return $key;

    $clean = preg_replace('/[^A-Za-z0-9_-]/', '', (string) $key);
    return $clean === '' ? 'field' : $clean;
}
}

if (!function_exists('strik_recepturen_v1_is_photo_preview_key')) {
function strik_recepturen_v1_is_photo_preview_key($key_path) {
    $suffix = '.photoPreviewDataUrl';

    return $key_path === 'photoPreviewDataUrl'
        || substr((string) $key_path, -strlen($suffix)) === $suffix;
}
}

if (!function_exists('strik_recepturen_v1_clean_photo_data_url')) {
function strik_recepturen_v1_clean_photo_data_url($value) {
    if (!is_string($value) || $value === '') return '';

    $value = trim($value);
    if (strlen($value) > STRIK_RECEPTUREN_PHOTO_PREVIEW_MAX_BYTES) return '';

    return preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+\/=]+$/i', $value)
        ? $value
        : '';
}
}

if (!function_exists('strik_recepturen_v1_sanitize_deep')) {
function strik_recepturen_v1_sanitize_deep($value, $key_path = '') {
    if (is_array($value)) {
        $clean = array();

        foreach ($value as $key => $item) {
            $clean_key = strik_recepturen_v1_sanitize_key($key);
            $next_key_path = $key_path === ''
                ? (string) $clean_key
                : $key_path . '.' . $clean_key;

            $clean[$clean_key] = strik_recepturen_v1_sanitize_deep($item, $next_key_path);
        }

        return $clean;
    }

    if (is_bool($value) || is_int($value) || is_float($value)) {
        return $value;
    }

    if (is_numeric($value) && !is_string($value)) {
        return 0 + $value;
    }

    if (strik_recepturen_v1_is_photo_preview_key($key_path)) {
        return strik_recepturen_v1_clean_photo_data_url($value);
    }

    return strik_recepturen_v1_text($value);
}
}

if (!function_exists('strik_recepturen_v1_limit_list')) {
function strik_recepturen_v1_limit_list($items, $limit) {
    if (!is_array($items)) return array();

    return array_slice(array_values(array_filter($items, 'is_array')), 0, $limit);
}
}

if (!function_exists('strik_recepturen_v1_normalize_data')) {
function strik_recepturen_v1_normalize_data($data) {
    if (!is_array($data)) {
        $data = array();
    }

    return array(
        'ingredients' => strik_recepturen_v1_limit_list(
            isset($data['ingredients']) ? $data['ingredients'] : array(),
            5000
        ),
        'recipes' => strik_recepturen_v1_limit_list(
            isset($data['recipes']) ? $data['recipes'] : array(),
            3000
        ),
        'invoiceImports' => strik_recepturen_v1_limit_list(
            isset($data['invoiceImports']) ? $data['invoiceImports'] : array(),
            100
        ),
        'updatedAt' => isset($data['updatedAt']) ? strik_recepturen_v1_text($data['updatedAt'], 120) : '',
    );
}
}

if (!function_exists('strik_recepturen_v1_get_data')) {
function strik_recepturen_v1_get_data() {
    $data = get_option(STRIK_RECEPTUREN_OPTION_NAME, strik_recepturen_v1_defaults());
    $data = strik_recepturen_v1_normalize_data($data);

    if (!isset($data['updatedAt'])) {
        $data['updatedAt'] = '';
    }

    return $data;
}
}

if (!function_exists('strik_recepturen_v1_get')) {
function strik_recepturen_v1_get() {
    return rest_ensure_response(strik_recepturen_v1_get_data());
}
}

if (!function_exists('strik_recepturen_v1_save')) {
function strik_recepturen_v1_save($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        return new WP_Error(
            'strik_recepturen_invalid_json',
            'Geen geldige recepturendata ontvangen.',
            array('status' => 400)
        );
    }

    $json = wp_json_encode($params);
    if (is_string($json) && strlen($json) > STRIK_RECEPTUREN_MAX_JSON_BYTES) {
        return new WP_Error(
            'strik_recepturen_too_large',
            'Recepturendata is te groot om veilig in een WordPress option op te slaan.',
            array('status' => 413)
        );
    }

    $clean = strik_recepturen_v1_normalize_data(strik_recepturen_v1_sanitize_deep($params));
    $clean['updatedAt'] = wp_date(DATE_ATOM);

    update_option(STRIK_RECEPTUREN_OPTION_NAME, $clean, false);

    return rest_ensure_response($clean);
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/recepturen', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_recepturen_v1_get',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_recepturen_v1_save',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_recepturen_v1_save',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
    ));
});
