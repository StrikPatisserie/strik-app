<?php
/**
 * Strik app - Recepturen API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * - GET /wp-json/strik/v1/recepturen?key=...
 * - PUT/POST /wp-json/strik/v1/recepturen?key=...
 * - POST /wp-json/strik/v1/recepturen-home-photo?key=...
 *
 * Hiermee worden recepturen, ingredienten en Beko factuurimports in WordPress
 * opgeslagen zodat koppelingen, prijsupdates en voorpagina-aanbiedingen niet
 * alleen lokaal/mockdata zijn.
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

if (!defined('STRIK_RECEPTUREN_HOME_PHOTO_UPLOAD_MAX_BYTES')) {
    define('STRIK_RECEPTUREN_HOME_PHOTO_UPLOAD_MAX_BYTES', 2500000);
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
        'packagingItems' => array(),
        'invoiceImports' => array(),
        'manualProductionPlanningItems' => array(),
        'bakeryHome' => array(
            'notes' => array(),
            'offers' => array(),
        ),
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

if (!function_exists('strik_recepturen_v1_clean_date')) {
function strik_recepturen_v1_clean_date($value) {
    $value = sanitize_text_field((string) $value);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
}
}

if (!function_exists('strik_recepturen_v1_normalize_bakery_home')) {
function strik_recepturen_v1_normalize_bakery_home($value) {
    if (!is_array($value)) {
        $value = array();
    }

    $notes = array();
    $raw_notes = isset($value['notes']) && is_array($value['notes']) ? $value['notes'] : array();
    foreach (array_slice($raw_notes, 0, 20) as $note) {
        if (!is_array($note)) continue;

        $text = isset($note['text']) ? strik_recepturen_v1_text($note['text'], 1200) : '';
        $notes[] = array(
            'id' => isset($note['id']) ? sanitize_text_field($note['id']) : uniqid('note-', true),
            'text' => $text,
            'updatedAt' => isset($note['updatedAt']) ? strik_recepturen_v1_text($note['updatedAt'], 120) : '',
        );
    }

    $offers = array();
    $raw_offers = isset($value['offers']) && is_array($value['offers']) ? $value['offers'] : array();
    foreach (array_slice($raw_offers, 0, 120) as $offer) {
        if (!is_array($offer)) continue;

        $week_start = isset($offer['weekStart']) ? strik_recepturen_v1_clean_date($offer['weekStart']) : '';
        $week_end = isset($offer['weekEnd']) ? strik_recepturen_v1_clean_date($offer['weekEnd']) : '';
        $image_url = isset($offer['imageUrl']) ? esc_url_raw($offer['imageUrl']) : '';

        if ($week_start === '' || $image_url === '') continue;

        $offers[] = array(
            'id' => isset($offer['id']) ? sanitize_text_field($offer['id']) : uniqid('offer-', true),
            'weekStart' => $week_start,
            'weekEnd' => $week_end,
            'label' => isset($offer['label']) ? strik_recepturen_v1_text($offer['label'], 200) : '',
            'imageUrl' => $image_url,
            'mediaId' => isset($offer['mediaId']) ? absint($offer['mediaId']) : 0,
            'fileName' => isset($offer['fileName']) ? sanitize_file_name($offer['fileName']) : '',
            'createdAt' => isset($offer['createdAt']) ? strik_recepturen_v1_text($offer['createdAt'], 120) : '',
            'updatedAt' => isset($offer['updatedAt']) ? strik_recepturen_v1_text($offer['updatedAt'], 120) : '',
        );
    }

    return array(
        'notes' => $notes,
        'offers' => $offers,
    );
}
}

if (!function_exists('strik_recepturen_v1_normalize_manual_planning_items')) {
function strik_recepturen_v1_normalize_manual_planning_items($value) {
    if (!is_array($value)) {
        return array();
    }

    $items = array();
    foreach (array_slice($value, 0, 500) as $index => $item) {
        if (!is_array($item)) continue;

        $title = isset($item['title']) ? strik_recepturen_v1_text($item['title'], 160) : '';
        $date = isset($item['date']) ? strik_recepturen_v1_clean_date($item['date']) : '';

        if ($title === '' || $date === '') continue;

        $quantity = isset($item['quantity']) ? (float) $item['quantity'] : 1;

        $items[] = array(
            'id' => isset($item['id']) && $item['id'] !== ''
                ? sanitize_text_field($item['id'])
                : 'manual-planning-' . ($index + 1),
            'date' => $date,
            'title' => $title,
            'quantity' => max(0, $quantity),
            'unit' => isset($item['unit']) && $item['unit'] !== ''
                ? strik_recepturen_v1_text($item['unit'], 40)
                : 'stuks',
            'note' => isset($item['note']) ? strik_recepturen_v1_text($item['note'], 400) : '',
            'status' => isset($item['status']) && $item['status'] === 'done' ? 'done' : 'open',
            'createdAt' => isset($item['createdAt']) ? strik_recepturen_v1_text($item['createdAt'], 120) : '',
            'completedAt' => isset($item['completedAt']) ? strik_recepturen_v1_clean_date($item['completedAt']) : '',
        );
    }

    return $items;
}
}

if (!function_exists('strik_recepturen_v1_normalize_production_log')) {
function strik_recepturen_v1_normalize_production_log($value) {
    if (!is_array($value)) {
        return array();
    }

    $items = array();
    foreach (array_slice($value, 0, 250) as $index => $item) {
        if (!is_array($item)) continue;

        $date = isset($item['date']) ? strik_recepturen_v1_clean_date($item['date']) : '';
        $quantity = isset($item['quantity']) ? (float) $item['quantity'] : 0;
        $source = isset($item['source']) ? sanitize_text_field($item['source']) : 'manual';

        if (!in_array($source, array('work', 'manual', 'stock'), true)) {
            $source = 'manual';
        }
        if ($date === '' || ($source === 'stock' ? $quantity < 0 : $quantity <= 0)) continue;

        $items[] = array(
            'id' => isset($item['id']) && $item['id'] !== ''
                ? sanitize_text_field($item['id'])
                : 'production-' . ($index + 1),
            'date' => $date,
            'quantity' => $quantity,
            'note' => isset($item['note']) ? strik_recepturen_v1_text($item['note'], 240) : '',
            'source' => $source,
        );
    }

    usort($items, function ($first, $second) {
        return strcmp($second['date'], $first['date']);
    });

    return $items;
}
}

if (!function_exists('strik_recepturen_v1_normalize_recipes')) {
function strik_recepturen_v1_normalize_recipes($value) {
    $recipes = strik_recepturen_v1_limit_list($value, 3000);

    foreach ($recipes as &$recipe) {
        $production_log = strik_recepturen_v1_normalize_production_log(
            isset($recipe['productionLog']) ? $recipe['productionLog'] : array()
        );
        $latest_production = null;

        foreach ($production_log as $entry) {
            if (!isset($entry['source']) || $entry['source'] !== 'stock') {
                $latest_production = $entry;
                break;
            }
        }

        $legacy_date = isset($recipe['lastProducedAt'])
            ? strik_recepturen_v1_clean_date($recipe['lastProducedAt'])
            : '';
        $legacy_quantity = isset($recipe['lastProducedQuantity'])
            ? (float) $recipe['lastProducedQuantity']
            : 0;

        $recipe['productionLog'] = $production_log;
        $recipe['lastProducedAt'] = $latest_production
            ? $latest_production['date']
            : $legacy_date;
        $recipe['lastProducedQuantity'] = $latest_production
            ? (float) $latest_production['quantity']
            : max(0, $legacy_quantity);
    }
    unset($recipe);

    return $recipes;
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
        'recipes' => strik_recepturen_v1_normalize_recipes(
            isset($data['recipes']) ? $data['recipes'] : array()
        ),
        'packagingItems' => strik_recepturen_v1_limit_list(
            isset($data['packagingItems']) ? $data['packagingItems'] : array(),
            1000
        ),
        'invoiceImports' => strik_recepturen_v1_limit_list(
            isset($data['invoiceImports']) ? $data['invoiceImports'] : array(),
            100
        ),
        'manualProductionPlanningItems' => strik_recepturen_v1_normalize_manual_planning_items(
            isset($data['manualProductionPlanningItems']) ? $data['manualProductionPlanningItems'] : array()
        ),
        'bakeryHome' => strik_recepturen_v1_normalize_bakery_home(
            isset($data['bakeryHome']) ? $data['bakeryHome'] : array()
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

if (!function_exists('strik_recepturen_v1_home_photo_upload')) {
function strik_recepturen_v1_home_photo_upload($request) {
    $files = $request->get_file_params();

    if (!isset($files['file']) || !is_array($files['file'])) {
        return new WP_Error(
            'strik_recepturen_home_photo_missing',
            'Geen aanbiedingfoto ontvangen.',
            array('status' => 400)
        );
    }

    $file = $files['file'];
    $error = isset($file['error']) ? absint($file['error']) : UPLOAD_ERR_OK;

    if ($error !== UPLOAD_ERR_OK) {
        return new WP_Error(
            'strik_recepturen_home_photo_upload_error',
            'Aanbiedingfoto uploaden is mislukt.',
            array('status' => 400)
        );
    }

    $size = isset($file['size']) ? absint($file['size']) : 0;
    if ($size <= 0 || $size > STRIK_RECEPTUREN_HOME_PHOTO_UPLOAD_MAX_BYTES) {
        return new WP_Error(
            'strik_recepturen_home_photo_too_large',
            'Aanbiedingfoto is te groot om veilig op te slaan.',
            array('status' => 413)
        );
    }

    $mime = isset($file['type']) ? sanitize_mime_type($file['type']) : '';
    $allowed_mimes = array('image/jpeg', 'image/png', 'image/webp');

    if (!in_array($mime, $allowed_mimes, true)) {
        return new WP_Error(
            'strik_recepturen_home_photo_type',
            'Alleen jpg, png en webp afbeeldingen zijn toegestaan.',
            array('status' => 400)
        );
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $upload = wp_handle_upload(
        $file,
        array(
            'test_form' => false,
            'mimes' => array(
                'jpg|jpeg|jpe' => 'image/jpeg',
                'png' => 'image/png',
                'webp' => 'image/webp',
            ),
        )
    );

    if (!is_array($upload) || isset($upload['error']) || empty($upload['file']) || empty($upload['url'])) {
        return new WP_Error(
            'strik_recepturen_home_photo_save_failed',
            isset($upload['error']) ? $upload['error'] : 'Aanbiedingfoto kon niet worden opgeslagen.',
            array('status' => 500)
        );
    }

    $week_start = strik_recepturen_v1_clean_date((string) $request->get_param('weekStart'));
    $label = strik_recepturen_v1_text((string) $request->get_param('label'), 200);
    $title_parts = array_filter(array($week_start, 'Bakkerij aanbieding', $label));
    $title = !empty($title_parts)
        ? implode(' - ', $title_parts)
        : sanitize_file_name(basename($upload['file']));

    $attachment_id = wp_insert_attachment(
        array(
            'guid' => $upload['url'],
            'post_mime_type' => $upload['type'],
            'post_title' => $title,
            'post_content' => '',
            'post_status' => 'inherit',
        ),
        $upload['file']
    );

    if (is_wp_error($attachment_id)) {
        return $attachment_id;
    }

    update_post_meta($attachment_id, '_strik_recepturen_home_photo', '1');
    if ($week_start !== '') update_post_meta($attachment_id, '_strik_recepturen_home_photo_week_start', $week_start);
    if ($label !== '') update_post_meta($attachment_id, '_strik_recepturen_home_photo_label', $label);

    $metadata = wp_generate_attachment_metadata($attachment_id, $upload['file']);
    if (!is_wp_error($metadata)) {
        wp_update_attachment_metadata($attachment_id, $metadata);
    }

    return rest_ensure_response(array(
        'id' => absint($attachment_id),
        'url' => esc_url_raw($upload['url']),
        'fileName' => sanitize_file_name(basename($upload['file'])),
    ));
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

    register_rest_route('strik/v1', '/recepturen-home-photo', array(
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_recepturen_v1_home_photo_upload',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
    ));

    register_rest_route('strik/v1', '/recepturen/home-photo', array(
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_recepturen_v1_home_photo_upload',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
    ));
});
