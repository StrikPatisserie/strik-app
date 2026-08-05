<?php
/**
 * Strik app - Recepturen API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * - GET /wp-json/strik/v1/recepturen?key=...
 * - PUT/POST /wp-json/strik/v1/recepturen?key=...
 * - GET /wp-json/strik/v1/recepturen-revisions?key=...
 * - GET /wp-json/strik/v1/recepturen-revisions/{id}?key=...
 * - POST /wp-json/strik/v1/recepturen-revisions/{id}/restore?key=...
 * - POST /wp-json/strik/v1/recepturen-home-photo?key=...
 * - WordPress beheer: Recepturen menu met download en handmatige backup.
 *
 * Hiermee worden recepturen, ingredienten en Beko factuurimports in WordPress
 * opgeslagen zodat koppelingen, prijsupdates en voorpagina-aanbiedingen niet
 * alleen lokaal/mockdata zijn. Bij elke save wordt eerst een private revisie
 * van de bestaande ruwe data opgeslagen, zodat oude recepturen teruggezet
 * kunnen worden als een verouderde browser-tab per ongeluk data overschrijft.
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

if (!defined('STRIK_RECEPTUREN_REVISION_POST_TYPE')) {
    define('STRIK_RECEPTUREN_REVISION_POST_TYPE', 'strik_recipe_revision');
}

if (!defined('STRIK_RECEPTUREN_MAX_REVISIONS')) {
    define('STRIK_RECEPTUREN_MAX_REVISIONS', 80);
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

if (!function_exists('strik_recepturen_v1_register_revision_post_type')) {
function strik_recepturen_v1_register_revision_post_type() {
    register_post_type(STRIK_RECEPTUREN_REVISION_POST_TYPE, array(
        'labels' => array(
            'name' => 'Strik recepturen revisies',
            'singular_name' => 'Strik recepturen revisie',
        ),
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => 'strik-recepturen',
        'supports' => array('title', 'editor'),
        'capability_type' => 'post',
    ));
}
}

add_action('init', 'strik_recepturen_v1_register_revision_post_type');
if (did_action('init')) {
    strik_recepturen_v1_register_revision_post_type();
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

if (!function_exists('strik_recepturen_v1_count_list')) {
function strik_recepturen_v1_count_list($data, $key) {
    return isset($data[$key]) && is_array($data[$key]) ? count($data[$key]) : 0;
}
}

if (!function_exists('strik_recepturen_v1_has_recovery_data')) {
function strik_recepturen_v1_has_recovery_data($data) {
    if (!is_array($data)) return false;

    return strik_recepturen_v1_count_list($data, 'recipes') > 0
        || strik_recepturen_v1_count_list($data, 'ingredients') > 0
        || strik_recepturen_v1_count_list($data, 'packagingItems') > 0
        || strik_recepturen_v1_count_list($data, 'invoiceImports') > 0
        || strik_recepturen_v1_count_list($data, 'manualProductionPlanningItems') > 0;
}
}

if (!function_exists('strik_recepturen_v1_revision_summary')) {
function strik_recepturen_v1_revision_summary($post) {
    return array(
        'id' => absint($post->ID),
        'createdAt' => get_post_time(DATE_ATOM, true, $post),
        'title' => get_the_title($post),
        'reason' => sanitize_text_field((string) get_post_meta($post->ID, '_strik_recepturen_revision_reason', true)),
        'recipes' => absint(get_post_meta($post->ID, '_strik_recepturen_revision_recipes', true)),
        'ingredients' => absint(get_post_meta($post->ID, '_strik_recepturen_revision_ingredients', true)),
        'packagingItems' => absint(get_post_meta($post->ID, '_strik_recepturen_revision_packaging_items', true)),
        'invoiceImports' => absint(get_post_meta($post->ID, '_strik_recepturen_revision_invoice_imports', true)),
        'bytes' => absint(get_post_meta($post->ID, '_strik_recepturen_revision_bytes', true)),
    );
}
}

if (!function_exists('strik_recepturen_v1_prune_revisions')) {
function strik_recepturen_v1_prune_revisions() {
    $old_revision_ids = get_posts(array(
        'post_type' => STRIK_RECEPTUREN_REVISION_POST_TYPE,
        'post_status' => 'private',
        'fields' => 'ids',
        'posts_per_page' => 200,
        'offset' => STRIK_RECEPTUREN_MAX_REVISIONS,
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true,
    ));

    foreach ($old_revision_ids as $revision_id) {
        wp_delete_post(absint($revision_id), true);
    }
}
}

if (!function_exists('strik_recepturen_v1_create_revision')) {
function strik_recepturen_v1_create_revision($data, $reason = 'before_save') {
    if (!is_array($data) || !strik_recepturen_v1_has_recovery_data($data)) {
        return 0;
    }

    $snapshot = strik_recepturen_v1_normalize_data($data);
    $json = wp_json_encode($snapshot);
    if (!is_string($json) || strlen($json) < 2 || strlen($json) > STRIK_RECEPTUREN_MAX_JSON_BYTES) {
        return 0;
    }

    $created_at = wp_date(DATE_ATOM);
    $recipe_count = strik_recepturen_v1_count_list($snapshot, 'recipes');
    $ingredient_count = strik_recepturen_v1_count_list($snapshot, 'ingredients');
    $title = sprintf(
        'Recepturen backup %s - %d recepten',
        wp_date('Y-m-d H:i:s'),
        $recipe_count
    );

    $revision_id = wp_insert_post(array(
        'post_type' => STRIK_RECEPTUREN_REVISION_POST_TYPE,
        'post_status' => 'private',
        'post_title' => $title,
        'post_content' => $json,
        'post_excerpt' => sprintf(
            '%d recepten, %d grondstoffen, opgeslagen voor herstel.',
            $recipe_count,
            $ingredient_count
        ),
    ), true);

    if (is_wp_error($revision_id) || !$revision_id) {
        return 0;
    }

    update_post_meta($revision_id, '_strik_recepturen_revision_created_at', $created_at);
    update_post_meta($revision_id, '_strik_recepturen_revision_reason', sanitize_text_field((string) $reason));
    update_post_meta($revision_id, '_strik_recepturen_revision_recipes', $recipe_count);
    update_post_meta($revision_id, '_strik_recepturen_revision_ingredients', $ingredient_count);
    update_post_meta($revision_id, '_strik_recepturen_revision_packaging_items', strik_recepturen_v1_count_list($snapshot, 'packagingItems'));
    update_post_meta($revision_id, '_strik_recepturen_revision_invoice_imports', strik_recepturen_v1_count_list($snapshot, 'invoiceImports'));
    update_post_meta($revision_id, '_strik_recepturen_revision_bytes', strlen($json));

    strik_recepturen_v1_prune_revisions();

    return absint($revision_id);
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

    $previous = get_option(STRIK_RECEPTUREN_OPTION_NAME, array());
    $revision_id = strik_recepturen_v1_create_revision($previous, 'before_save');
    $clean = strik_recepturen_v1_normalize_data(strik_recepturen_v1_sanitize_deep($params));
    $clean['updatedAt'] = wp_date(DATE_ATOM);

    update_option(STRIK_RECEPTUREN_OPTION_NAME, $clean, false);
    $clean['revisionId'] = $revision_id;

    return rest_ensure_response($clean);
}
}

if (!function_exists('strik_recepturen_v1_revisions_get')) {
function strik_recepturen_v1_revisions_get() {
    $posts = get_posts(array(
        'post_type' => STRIK_RECEPTUREN_REVISION_POST_TYPE,
        'post_status' => 'private',
        'posts_per_page' => STRIK_RECEPTUREN_MAX_REVISIONS,
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true,
    ));

    return rest_ensure_response(array(
        'revisions' => array_map('strik_recepturen_v1_revision_summary', $posts),
    ));
}
}

if (!function_exists('strik_recepturen_v1_get_revision_post')) {
function strik_recepturen_v1_get_revision_post($revision_id) {
    $post = get_post(absint($revision_id));
    if (!$post || $post->post_type !== STRIK_RECEPTUREN_REVISION_POST_TYPE || $post->post_status !== 'private') {
        return null;
    }

    return $post;
}
}

if (!function_exists('strik_recepturen_v1_revision_get')) {
function strik_recepturen_v1_revision_get($request) {
    $post = strik_recepturen_v1_get_revision_post($request->get_param('revisionId'));
    if (!$post) {
        return new WP_Error(
            'strik_recepturen_revision_not_found',
            'Recepturenrevisie niet gevonden.',
            array('status' => 404)
        );
    }

    $data = json_decode($post->post_content, true);
    if (!is_array($data)) {
        return new WP_Error(
            'strik_recepturen_revision_invalid',
            'Recepturenrevisie bevat geen geldige data.',
            array('status' => 500)
        );
    }

    return rest_ensure_response(array(
        'revision' => strik_recepturen_v1_revision_summary($post),
        'data' => strik_recepturen_v1_normalize_data($data),
    ));
}
}

if (!function_exists('strik_recepturen_v1_revision_restore')) {
function strik_recepturen_v1_revision_restore($request) {
    $post = strik_recepturen_v1_get_revision_post($request->get_param('revisionId'));
    if (!$post) {
        return new WP_Error(
            'strik_recepturen_revision_not_found',
            'Recepturenrevisie niet gevonden.',
            array('status' => 404)
        );
    }

    $data = json_decode($post->post_content, true);
    if (!is_array($data)) {
        return new WP_Error(
            'strik_recepturen_revision_invalid',
            'Recepturenrevisie bevat geen geldige data.',
            array('status' => 500)
        );
    }

    strik_recepturen_v1_create_revision(
        get_option(STRIK_RECEPTUREN_OPTION_NAME, array()),
        'before_restore'
    );

    $clean = strik_recepturen_v1_normalize_data(strik_recepturen_v1_sanitize_deep($data));
    $clean['updatedAt'] = wp_date(DATE_ATOM);

    update_option(STRIK_RECEPTUREN_OPTION_NAME, $clean, false);

    return rest_ensure_response(array(
        'restored' => true,
        'revision' => strik_recepturen_v1_revision_summary($post),
        'data' => $clean,
    ));
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

if (!function_exists('strik_recepturen_v1_option_storage_bytes')) {
function strik_recepturen_v1_option_storage_bytes() {
    global $wpdb;

    $bytes = $wpdb->get_var($wpdb->prepare(
        "SELECT OCTET_LENGTH(option_value) FROM {$wpdb->options} WHERE option_name = %s",
        STRIK_RECEPTUREN_OPTION_NAME
    ));

    return $bytes === null ? 0 : absint($bytes);
}
}

if (!function_exists('strik_recepturen_v1_admin_size')) {
function strik_recepturen_v1_admin_size($bytes) {
    $bytes = absint($bytes);

    return function_exists('size_format')
        ? size_format($bytes)
        : $bytes . ' bytes';
}
}

if (!function_exists('strik_recepturen_v1_admin_revision_posts')) {
function strik_recepturen_v1_admin_revision_posts($limit = 12) {
    return get_posts(array(
        'post_type' => STRIK_RECEPTUREN_REVISION_POST_TYPE,
        'post_status' => 'private',
        'posts_per_page' => absint($limit),
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true,
    ));
}
}

if (!function_exists('strik_recepturen_v1_admin_metric')) {
function strik_recepturen_v1_admin_metric($label, $value, $hint = '') {
    echo '<div class="strik-recepturen-metric">';
    echo '<span>' . esc_html($label) . '</span>';
    echo '<strong>' . esc_html((string) $value) . '</strong>';
    if ($hint !== '') {
        echo '<small>' . esc_html($hint) . '</small>';
    }
    echo '</div>';
}
}

if (!function_exists('strik_recepturen_v1_admin_notice')) {
function strik_recepturen_v1_admin_notice() {
    $status = isset($_GET['strik_recepturen_backup'])
        ? sanitize_text_field(wp_unslash($_GET['strik_recepturen_backup']))
        : '';

    if ($status === 'created') {
        $revision_id = isset($_GET['revision_id']) ? absint($_GET['revision_id']) : 0;
        echo '<div class="notice notice-success inline"><p>Recepturenbackup opgeslagen.';
        if ($revision_id > 0) {
            echo ' Revisie #' . esc_html((string) $revision_id) . '.';
        }
        echo '</p></div>';
    }

    if ($status === 'failed') {
        echo '<div class="notice notice-error inline"><p>Recepturenbackup kon niet worden opgeslagen. Download voor de zekerheid eerst de huidige JSON.</p></div>';
    }
}
}

if (!function_exists('strik_recepturen_v1_admin_page')) {
function strik_recepturen_v1_admin_page() {
    if (!current_user_can('manage_options')) {
        wp_die('Geen toegang tot recepturen.');
    }

    $data = strik_recepturen_v1_get_data();
    $revisions = strik_recepturen_v1_admin_revision_posts(12);
    $json = wp_json_encode($data);
    $json_bytes = is_string($json) ? strlen($json) : 0;
    $storage_bytes = strik_recepturen_v1_option_storage_bytes();
    $offers = isset($data['bakeryHome']['offers']) && is_array($data['bakeryHome']['offers'])
        ? count($data['bakeryHome']['offers'])
        : 0;
    $download_url = wp_nonce_url(
        admin_url('admin-post.php?action=strik_recepturen_download_current'),
        'strik_recepturen_download_current'
    );

    echo '<div class="wrap strik-recepturen-admin">';
    echo '<style>
        .strik-recepturen-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:18px 0 22px}
        .strik-recepturen-metric{background:#fff;border:1px solid #dcdcde;border-radius:4px;padding:14px 16px;min-height:88px}
        .strik-recepturen-metric span{display:block;color:#646970;font-size:12px;font-weight:600;text-transform:uppercase}
        .strik-recepturen-metric strong{display:block;color:#1d2327;font-size:28px;line-height:1.25;margin-top:6px}
        .strik-recepturen-metric small{display:block;color:#646970;margin-top:6px}
        .strik-recepturen-actions{align-items:center;display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 22px}
        .strik-recepturen-actions form{margin:0}
        .strik-recepturen-note{max-width:780px}
    </style>';
    echo '<h1>Recepturen</h1>';
    echo '<p class="strik-recepturen-note">Hier staat de actuele recepturendata uit de WordPress option <code>' . esc_html(STRIK_RECEPTUREN_OPTION_NAME) . '</code>. De app blijft dezelfde opslag gebruiken; dit scherm maakt de data zichtbaar, downloadbaar en handmatig te backuppen.</p>';

    strik_recepturen_v1_admin_notice();

    echo '<div class="strik-recepturen-grid">';
    strik_recepturen_v1_admin_metric('Recepten', number_format_i18n(strik_recepturen_v1_count_list($data, 'recipes')));
    strik_recepturen_v1_admin_metric('Ingredienten', number_format_i18n(strik_recepturen_v1_count_list($data, 'ingredients')));
    strik_recepturen_v1_admin_metric('Verpakkingen', number_format_i18n(strik_recepturen_v1_count_list($data, 'packagingItems')));
    strik_recepturen_v1_admin_metric('Factuurimports', number_format_i18n(strik_recepturen_v1_count_list($data, 'invoiceImports')));
    strik_recepturen_v1_admin_metric('Planning', number_format_i18n(strik_recepturen_v1_count_list($data, 'manualProductionPlanningItems')));
    strik_recepturen_v1_admin_metric('Aanbiedingen', number_format_i18n($offers), 'voorpagina');
    strik_recepturen_v1_admin_metric('JSON grootte', strik_recepturen_v1_admin_size($json_bytes), 'download');
    strik_recepturen_v1_admin_metric('WordPress opslag', strik_recepturen_v1_admin_size($storage_bytes), 'option');
    echo '</div>';

    echo '<h2>Backup en export</h2>';
    echo '<p class="strik-recepturen-note">Download de huidige data als JSON voordat je grote wijzigingen doet. Met "Maak nu backup" komt er een herstelpunt onder Recepturen > Strik recepturen revisies.</p>';
    echo '<div class="strik-recepturen-actions">';
    echo '<a class="button button-secondary" href="' . esc_url($download_url) . '">Download huidige data</a>';
    echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
    echo '<input type="hidden" name="action" value="strik_recepturen_create_backup">';
    wp_nonce_field('strik_recepturen_create_backup');
    submit_button('Maak nu backup', 'primary', 'submit', false);
    echo '</form>';
    echo '</div>';

    echo '<h2>WordPress backups</h2>';
    if (empty($revisions)) {
        echo '<div class="notice notice-warning inline"><p>Nog geen WordPress backups gevonden. Klik op "Maak nu backup" om meteen een eerste herstelpunt te maken.</p></div>';
    } else {
        echo '<table class="widefat striped">';
        echo '<thead><tr><th>Datum</th><th>Titel</th><th>Reden</th><th>Recepten</th><th>Ingredienten</th><th>Grootte</th><th></th></tr></thead>';
        echo '<tbody>';
        foreach ($revisions as $revision_post) {
            $summary = strik_recepturen_v1_revision_summary($revision_post);
            $edit_link = get_edit_post_link($summary['id'], '');
            echo '<tr>';
            echo '<td>' . esc_html($summary['createdAt']) . '</td>';
            echo '<td>' . esc_html($summary['title']) . '</td>';
            echo '<td>' . esc_html($summary['reason']) . '</td>';
            echo '<td>' . esc_html(number_format_i18n($summary['recipes'])) . '</td>';
            echo '<td>' . esc_html(number_format_i18n($summary['ingredients'])) . '</td>';
            echo '<td>' . esc_html(strik_recepturen_v1_admin_size($summary['bytes'])) . '</td>';
            echo '<td>';
            if ($edit_link) {
                echo '<a href="' . esc_url($edit_link) . '">Bekijk</a>';
            }
            echo '</td>';
            echo '</tr>';
        }
        echo '</tbody></table>';
    }

    echo '<p class="strik-recepturen-note"><strong>Laatst bijgewerkt:</strong> ' . esc_html($data['updatedAt'] !== '' ? $data['updatedAt'] : 'nog onbekend') . '</p>';
    echo '</div>';
}
}

if (!function_exists('strik_recepturen_v1_admin_menu')) {
function strik_recepturen_v1_admin_menu() {
    add_menu_page(
        'Strik recepturen',
        'Recepturen',
        'manage_options',
        'strik-recepturen',
        'strik_recepturen_v1_admin_page',
        'dashicons-list-view',
        24
    );
}
}

add_action('admin_menu', 'strik_recepturen_v1_admin_menu');

if (!function_exists('strik_recepturen_v1_admin_download_current')) {
function strik_recepturen_v1_admin_download_current() {
    if (!current_user_can('manage_options')) {
        wp_die('Geen toegang tot recepturen.');
    }

    check_admin_referer('strik_recepturen_download_current');

    $json = wp_json_encode(
        strik_recepturen_v1_get_data(),
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE
    );

    if (!is_string($json)) {
        wp_die('Recepturendata kon niet worden geexporteerd.');
    }

    nocache_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="strik-recepturen-' . wp_date('Ymd-His') . '.json"');
    header('Content-Length: ' . strlen($json));
    echo $json;
    exit;
}
}

add_action('admin_post_strik_recepturen_download_current', 'strik_recepturen_v1_admin_download_current');

if (!function_exists('strik_recepturen_v1_admin_create_backup')) {
function strik_recepturen_v1_admin_create_backup() {
    if (!current_user_can('manage_options')) {
        wp_die('Geen toegang tot recepturen.');
    }

    check_admin_referer('strik_recepturen_create_backup');

    $revision_id = strik_recepturen_v1_create_revision(
        get_option(STRIK_RECEPTUREN_OPTION_NAME, array()),
        'manual_admin_backup'
    );

    $args = $revision_id > 0
        ? array('strik_recepturen_backup' => 'created', 'revision_id' => $revision_id)
        : array('strik_recepturen_backup' => 'failed');

    wp_safe_redirect(add_query_arg($args, admin_url('admin.php?page=strik-recepturen')));
    exit;
}
}

add_action('admin_post_strik_recepturen_create_backup', 'strik_recepturen_v1_admin_create_backup');

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

    register_rest_route('strik/v1', '/recepturen-revisions', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_recepturen_v1_revisions_get',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
    ));

    register_rest_route('strik/v1', '/recepturen-revisions/(?P<revisionId>\d+)', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_recepturen_v1_revision_get',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
    ));

    register_rest_route('strik/v1', '/recepturen-revisions/(?P<revisionId>\d+)/restore', array(
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_recepturen_v1_revision_restore',
            'permission_callback' => 'strik_recepturen_v1_permission',
        ),
    ));
});
