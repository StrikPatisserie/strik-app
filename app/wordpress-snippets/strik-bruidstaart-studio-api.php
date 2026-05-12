<?php
/**
 * Strik app - Bruidstaart Studio API
 *
 * Plaats deze snippet in WordPress. De app gebruikt:
 * GET /wp-json/strik/v1/wedding-cakes?key=...&search=JANSEN
 * PUT /wp-json/strik/v1/wedding-cakes?key=...
 */

if (!defined('STRIK_WEDDING_CAKE_API_KEY')) {
    define('STRIK_WEDDING_CAKE_API_KEY', 'schoonmaak-ijs-strik');
}

if (!function_exists('strik_wedding_cakes_permission')) {
function strik_wedding_cakes_permission($request) {
    $key = (string) $request->get_param('key');

    if (hash_equals(STRIK_WEDDING_CAKE_API_KEY, $key)) {
        return true;
    }

    return new WP_Error(
        'strik_wedding_cakes_forbidden',
        'Geen toegang tot bruidstaart aanvragen.',
        array('status' => 403)
    );
}
}

if (!function_exists('strik_wedding_cakes_get_all')) {
function strik_wedding_cakes_get_all() {
    $drafts = get_option('strik_wedding_cake_drafts', array());
    return is_array($drafts) ? $drafts : array();
}
}

if (!function_exists('strik_wedding_cakes_sanitize_deep')) {
function strik_wedding_cakes_sanitize_deep($value) {
    if (is_array($value)) {
        $clean = array();

        foreach ($value as $key => $item) {
            $clean_key = is_int($key)
                ? $key
                : preg_replace('/[^A-Za-z0-9_-]/', '', (string) $key);
            $clean[$clean_key] = strik_wedding_cakes_sanitize_deep($item);
        }

        return $clean;
    }

    if (is_bool($value)) {
        return $value;
    }

    if (is_int($value) || is_float($value)) {
        return $value;
    }

    return sanitize_textarea_field((string) $value);
}
}

if (!function_exists('strik_wedding_cakes_text')) {
function strik_wedding_cakes_text($value) {
    return sanitize_text_field((string) $value);
}
}

if (!function_exists('strik_wedding_cakes_matches')) {
function strik_wedding_cakes_matches($draft, $search) {
    if ($search === '') {
        return true;
    }

    $haystack = strtolower(
        implode(' ', array(
            isset($draft['code']) ? $draft['code'] : '',
            isset($draft['surname']) ? $draft['surname'] : '',
            isset($draft['names']) ? $draft['names'] : '',
        ))
    );

    return strpos($haystack, strtolower($search)) !== false;
}
}

if (!function_exists('strik_wedding_cakes_get')) {
function strik_wedding_cakes_get($request) {
    $search = strik_wedding_cakes_text($request->get_param('search'));
    $drafts = array_values(strik_wedding_cakes_get_all());
    $filtered = array();

    foreach ($drafts as $draft) {
        if (!is_array($draft) || !strik_wedding_cakes_matches($draft, $search)) {
            continue;
        }

        $filtered[] = $draft;
    }

    usort($filtered, function ($a, $b) {
        return strcmp(
            isset($b['updatedAt']) ? $b['updatedAt'] : '',
            isset($a['updatedAt']) ? $a['updatedAt'] : ''
        );
    });

    return rest_ensure_response(array(
        'drafts' => array_slice($filtered, 0, 50),
    ));
}
}

if (!function_exists('strik_wedding_cakes_save')) {
function strik_wedding_cakes_save($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        $params = array();
    }

    $config = isset($params['config']) && is_array($params['config'])
        ? strik_wedding_cakes_sanitize_deep($params['config'])
        : array();
    $contact = isset($config['contact']) && is_array($config['contact'])
        ? $config['contact']
        : array();

    $code = isset($params['code']) ? strik_wedding_cakes_text($params['code']) : '';
    if ($code === '' && isset($contact['recognitionCode'])) {
        $code = strik_wedding_cakes_text($contact['recognitionCode']);
    }
    if ($code === '') {
        return new WP_Error(
            'strik_wedding_cakes_missing_code',
            'Herkenningscode is verplicht.',
            array('status' => 400)
        );
    }

    $surname = isset($params['surname']) ? strik_wedding_cakes_text($params['surname']) : '';
    if ($surname === '' && isset($contact['surname'])) {
        $surname = strik_wedding_cakes_text($contact['surname']);
    }

    $names = isset($params['names']) ? strik_wedding_cakes_text($params['names']) : '';
    if ($names === '' && isset($contact['names'])) {
        $names = strik_wedding_cakes_text($contact['names']);
    }

    $drafts = strik_wedding_cakes_get_all();
    $storage_key = sanitize_key(strtolower($code));
    $existing = isset($drafts[$storage_key]) && is_array($drafts[$storage_key])
        ? $drafts[$storage_key]
        : array();
    $created_at = isset($existing['createdAt']) ? $existing['createdAt'] : wp_date(DATE_ATOM);

    $draft = array(
        'id' => $code,
        'code' => $code,
        'surname' => $surname,
        'names' => $names,
        'config' => $config,
        'createdAt' => $created_at,
        'updatedAt' => wp_date(DATE_ATOM),
    );

    $drafts[$storage_key] = $draft;
    update_option('strik_wedding_cake_drafts', $drafts, false);

    return rest_ensure_response($draft);
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/wedding-cakes', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_wedding_cakes_get',
            'permission_callback' => 'strik_wedding_cakes_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_wedding_cakes_save',
            'permission_callback' => 'strik_wedding_cakes_permission',
        ),
    ));
});
