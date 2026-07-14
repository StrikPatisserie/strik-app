<?php
/**
 * Strik app - Vierdaagse orders API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * - GET  /wp-json/strik/v1/vierdaagse-orders?key=...
 * - POST /wp-json/strik/v1/vierdaagse-orders?key=...
 * - PUT  /wp-json/strik/v1/vierdaagse-orders?key=...
 * - DELETE /wp-json/strik/v1/vierdaagse-orders?key=...&id=...
 * - GET  /wp-json/strik/v1/vierdaagse-products?key=...
 * - POST /wp-json/strik/v1/vierdaagse-products?key=...
 *
 * Hiermee worden Vierdaagse kassabonnen centraal opgeslagen, zodat meerdere
 * iPads dezelfde bonnen, statusvinkjes en productknoppen kunnen zien.
 */

if (!defined('STRIK_VIERDAAGSE_API_KEY')) {
    define('STRIK_VIERDAAGSE_API_KEY', 'schoonmaak-ijs-strik');
}

if (!defined('STRIK_VIERDAAGSE_OPTION_NAME')) {
    define('STRIK_VIERDAAGSE_OPTION_NAME', 'strik_vierdaagse_orders');
}

if (!defined('STRIK_VIERDAAGSE_PRODUCTS_OPTION_NAME')) {
    define('STRIK_VIERDAAGSE_PRODUCTS_OPTION_NAME', 'strik_vierdaagse_products');
}

if (!defined('STRIK_VIERDAAGSE_MAX_ORDERS')) {
    define('STRIK_VIERDAAGSE_MAX_ORDERS', 2500);
}

if (!defined('STRIK_VIERDAAGSE_MAX_PRODUCTS')) {
    define('STRIK_VIERDAAGSE_MAX_PRODUCTS', 500);
}

if (!defined('STRIK_VIERDAAGSE_MAX_JSON_BYTES')) {
    define('STRIK_VIERDAAGSE_MAX_JSON_BYTES', 2500000);
}

if (!function_exists('strik_vierdaagse_permission')) {
function strik_vierdaagse_permission($request) {
    return hash_equals(STRIK_VIERDAAGSE_API_KEY, (string) $request->get_param('key'))
        ? true
        : new WP_Error('strik_vierdaagse_forbidden', 'Geen toegang tot Vierdaagse orders.', array('status' => 403));
}
}

if (!function_exists('strik_vierdaagse_text')) {
function strik_vierdaagse_text($value, $max_length = 600) {
    $value = (string) $value;
    if (strlen($value) > $max_length) {
        $value = substr($value, 0, $max_length);
    }

    return sanitize_text_field($value);
}
}

if (!function_exists('strik_vierdaagse_textarea')) {
function strik_vierdaagse_textarea($value, $max_length = 1200) {
    $value = (string) $value;
    if (strlen($value) > $max_length) {
        $value = substr($value, 0, $max_length);
    }

    return sanitize_textarea_field($value);
}
}

if (!function_exists('strik_vierdaagse_choice')) {
function strik_vierdaagse_choice($value, $allowed, $fallback) {
    $value = sanitize_key((string) $value);

    return in_array($value, $allowed, true) ? $value : $fallback;
}
}

if (!function_exists('strik_vierdaagse_date')) {
function strik_vierdaagse_date($value) {
    $value = sanitize_text_field((string) $value);

    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
}
}

if (!function_exists('strik_vierdaagse_iso')) {
function strik_vierdaagse_iso($value) {
    $value = sanitize_text_field((string) $value);

    return preg_match('/^\d{4}-\d{2}-\d{2}T/', $value) ? $value : '';
}
}

if (!function_exists('strik_vierdaagse_sanitize_item')) {
function strik_vierdaagse_sanitize_item($item, $index = 0) {
    if (!is_array($item)) return null;

    $name = isset($item['name']) ? strik_vierdaagse_text($item['name'], 160) : '';
    $product_id = isset($item['productId']) ? strik_vierdaagse_text($item['productId'], 120) : '';
    $quantity = isset($item['quantity']) ? absint($item['quantity']) : 0;

    if ($name === '' || $product_id === '' || $quantity < 1) {
        return null;
    }

    return array(
        'id' => isset($item['id']) && $item['id'] !== ''
            ? strik_vierdaagse_text($item['id'], 140)
            : uniqid('item-' . $index . '-', true),
        'productId' => $product_id,
        'name' => $name,
        'category' => strik_vierdaagse_choice(
            isset($item['category']) ? $item['category'] : '',
            array('koffie-thee', 'fris-koud', 'bakkerij', 'gebak', 'hartig', 'overig'),
            'overig'
        ),
        'quantity' => min($quantity, 99),
        'status' => strik_vierdaagse_choice(
            isset($item['status']) ? $item['status'] : '',
            array('niet_gestart', 'klaar'),
            'niet_gestart'
        ),
        'detail' => isset($item['detail']) ? strik_vierdaagse_text($item['detail'], 180) : '',
    );
}
}

if (!function_exists('strik_vierdaagse_sanitize_text_list')) {
function strik_vierdaagse_sanitize_text_list($items, $max_items = 24, $max_length = 120) {
    if (!is_array($items)) {
        return array();
    }

    $clean = array();
    foreach (array_slice($items, 0, $max_items) as $item) {
        $value = strik_vierdaagse_text($item, $max_length);
        if ($value !== '') {
            $clean[] = $value;
        }
    }

    return $clean;
}
}

if (!function_exists('strik_vierdaagse_sanitize_product')) {
function strik_vierdaagse_sanitize_product($product, $index = 0) {
    if (!is_array($product)) return null;

    $name = isset($product['name']) ? strik_vierdaagse_text($product['name'], 180) : '';
    $id = isset($product['id']) ? strik_vierdaagse_text($product['id'], 140) : '';

    if ($id === '' || $name === '') {
        return null;
    }

    $badge = isset($product['badge']) ? strtoupper(strik_vierdaagse_text($product['badge'], 8)) : '';
    if ($badge === '') {
        $badge = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 4));
    }
    if ($badge === '') {
        $badge = 'P' . absint($index + 1);
    }

    $clean = array(
        'id' => $id,
        'name' => $name,
        'category' => strik_vierdaagse_choice(
            isset($product['category']) ? $product['category'] : '',
            array('koffie-thee', 'fris-koud', 'bakkerij', 'gebak', 'hartig', 'overig'),
            'overig'
        ),
        'badge' => substr($badge, 0, 4),
    );

    if (!empty($product['needsDetail'])) {
        $clean['needsDetail'] = true;
    }

    if (isset($product['detailLabel'])) {
        $clean['detailLabel'] = strik_vierdaagse_text($product['detailLabel'], 160);
    }

    if (isset($product['detailOptions'])) {
        $clean['detailOptions'] = strik_vierdaagse_sanitize_text_list($product['detailOptions']);
    }

    if (isset($product['modifierLabel'])) {
        $clean['modifierLabel'] = strik_vierdaagse_text($product['modifierLabel'], 160);
    }

    if (isset($product['modifierOptions'])) {
        $clean['modifierOptions'] = strik_vierdaagse_sanitize_text_list($product['modifierOptions']);
    }

    return $clean;
}
}

if (!function_exists('strik_vierdaagse_sanitize_products')) {
function strik_vierdaagse_sanitize_products($products) {
    if (!is_array($products)) {
        return array();
    }

    $clean = array();
    $used_ids = array();

    foreach (array_slice($products, 0, STRIK_VIERDAAGSE_MAX_PRODUCTS) as $index => $product) {
        $clean_product = strik_vierdaagse_sanitize_product($product, $index);
        if ($clean_product === null || isset($used_ids[$clean_product['id']])) {
            continue;
        }

        $used_ids[$clean_product['id']] = true;
        $clean[] = $clean_product;
    }

    usort($clean, function ($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    return $clean;
}
}

if (!function_exists('strik_vierdaagse_sanitize_order')) {
function strik_vierdaagse_sanitize_order($order) {
    if (!is_array($order)) return null;

    $id = isset($order['id']) ? strik_vierdaagse_text($order['id'], 140) : '';
    $table_number = isset($order['tableNumber']) ? strik_vierdaagse_text($order['tableNumber'], 120) : '';
    $created_at = isset($order['createdAt']) ? strik_vierdaagse_iso($order['createdAt']) : '';
    $date = isset($order['date']) ? strik_vierdaagse_date($order['date']) : '';
    $items = array();

    if (isset($order['items']) && is_array($order['items'])) {
        foreach (array_slice($order['items'], 0, 80) as $index => $item) {
            $clean_item = strik_vierdaagse_sanitize_item($item, $index);
            if ($clean_item !== null) $items[] = $clean_item;
        }
    }

    if ($id === '' || $table_number === '' || $created_at === '' || count($items) < 1) {
        return null;
    }

    if ($date === '') {
        $date = substr($created_at, 0, 10);
    }

    $year = isset($order['year']) ? absint($order['year']) : absint(substr($date, 0, 4));

    return array(
        'id' => $id,
        'date' => $date,
        'year' => $year,
        'createdAt' => $created_at,
        'tableNumber' => $table_number,
        'location' => strik_vierdaagse_choice(
            isset($order['location']) ? $order['location'] : '',
            array('terras', 'binnen', 'geen_tafel'),
            'geen_tafel'
        ),
        'items' => $items,
        'note' => isset($order['note']) ? strik_vierdaagse_textarea($order['note'], 1200) : '',
        'status' => strik_vierdaagse_choice(
            isset($order['status']) ? $order['status'] : '',
            array('nieuw', 'in_productie', 'klaar_voor_bediening', 'geleverd', 'geannuleerd'),
            'nieuw'
        ),
        'readyAt' => isset($order['readyAt']) ? strik_vierdaagse_iso($order['readyAt']) : '',
        'deliveredAt' => isset($order['deliveredAt']) ? strik_vierdaagse_iso($order['deliveredAt']) : '',
        'cancelledAt' => isset($order['cancelledAt']) ? strik_vierdaagse_iso($order['cancelledAt']) : '',
        'createdBy' => isset($order['createdBy']) ? strik_vierdaagse_text($order['createdBy'], 120) : '',
        'deliveredBy' => isset($order['deliveredBy']) ? strik_vierdaagse_text($order['deliveredBy'], 120) : '',
        'updatedAt' => wp_date(DATE_ATOM),
    );
}
}

if (!function_exists('strik_vierdaagse_get_orders')) {
function strik_vierdaagse_get_orders() {
    $orders = get_option(STRIK_VIERDAAGSE_OPTION_NAME, array());

    if (!is_array($orders)) {
        return array();
    }

    $clean = array();
    foreach ($orders as $order) {
        $clean_order = strik_vierdaagse_sanitize_order($order);
        if ($clean_order !== null) $clean[] = $clean_order;
    }

    usort($clean, function ($a, $b) {
        return strcmp($b['createdAt'], $a['createdAt']);
    });

    return array_slice($clean, 0, STRIK_VIERDAAGSE_MAX_ORDERS);
}
}

if (!function_exists('strik_vierdaagse_get')) {
function strik_vierdaagse_get($request) {
    return rest_ensure_response(strik_vierdaagse_get_orders());
}
}

if (!function_exists('strik_vierdaagse_save')) {
function strik_vierdaagse_save($request) {
    $params = $request->get_json_params();

    if (!is_array($params)) {
        return new WP_Error('strik_vierdaagse_invalid_json', 'Geen geldige order ontvangen.', array('status' => 400));
    }

    $raw_order = isset($params['order']) && is_array($params['order']) ? $params['order'] : $params;
    $order = strik_vierdaagse_sanitize_order($raw_order);

    if ($order === null) {
        return new WP_Error('strik_vierdaagse_invalid_order', 'Order is niet compleet.', array('status' => 400));
    }

    $orders = strik_vierdaagse_get_orders();
    $next = array();
    $saved = false;

    foreach ($orders as $existing_order) {
        if (isset($existing_order['id']) && $existing_order['id'] === $order['id']) {
            $next[] = $order;
            $saved = true;
        } else {
            $next[] = $existing_order;
        }
    }

    if (!$saved) {
        array_unshift($next, $order);
    }

    usort($next, function ($a, $b) {
        return strcmp($b['createdAt'], $a['createdAt']);
    });

    $next = array_slice($next, 0, STRIK_VIERDAAGSE_MAX_ORDERS);
    $encoded = wp_json_encode($next);

    if (is_string($encoded) && strlen($encoded) > STRIK_VIERDAAGSE_MAX_JSON_BYTES) {
        return new WP_Error('strik_vierdaagse_storage_full', 'Vierdaagse opslag is te groot.', array('status' => 413));
    }

    update_option(STRIK_VIERDAAGSE_OPTION_NAME, $next, false);

    return rest_ensure_response($order);
}
}

if (!function_exists('strik_vierdaagse_delete')) {
function strik_vierdaagse_delete($request) {
    $id = strik_vierdaagse_text($request->get_param('id'), 140);

    if ($id === '') {
        return new WP_Error('strik_vierdaagse_missing_id', 'Geen bon gekozen om te verwijderen.', array('status' => 400));
    }

    $orders = strik_vierdaagse_get_orders();
    $next = array();
    $deleted = false;

    foreach ($orders as $order) {
        if (isset($order['id']) && $order['id'] === $id) {
            $deleted = true;
            continue;
        }

        $next[] = $order;
    }

    update_option(STRIK_VIERDAAGSE_OPTION_NAME, $next, false);

    return rest_ensure_response(array(
        'deleted' => $deleted,
        'id' => $id,
    ));
}
}

if (!function_exists('strik_vierdaagse_get_products')) {
function strik_vierdaagse_get_products($request) {
    $products = get_option(STRIK_VIERDAAGSE_PRODUCTS_OPTION_NAME, array());

    return rest_ensure_response(strik_vierdaagse_sanitize_products($products));
}
}

if (!function_exists('strik_vierdaagse_save_products')) {
function strik_vierdaagse_save_products($request) {
    $params = $request->get_json_params();

    if (!is_array($params)) {
        return new WP_Error('strik_vierdaagse_products_invalid_json', 'Geen geldige productlijst ontvangen.', array('status' => 400));
    }

    $raw_products = isset($params['products']) && is_array($params['products'])
        ? $params['products']
        : $params;
    $products = strik_vierdaagse_sanitize_products($raw_products);

    if (count($products) < 1) {
        return new WP_Error('strik_vierdaagse_products_empty', 'Productlijst is leeg.', array('status' => 400));
    }

    $encoded = wp_json_encode($products);

    if (is_string($encoded) && strlen($encoded) > STRIK_VIERDAAGSE_MAX_JSON_BYTES) {
        return new WP_Error('strik_vierdaagse_products_storage_full', 'Vierdaagse productopslag is te groot.', array('status' => 413));
    }

    update_option(STRIK_VIERDAAGSE_PRODUCTS_OPTION_NAME, $products, false);

    return rest_ensure_response($products);
}
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/vierdaagse-orders', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_vierdaagse_get',
            'permission_callback' => 'strik_vierdaagse_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_vierdaagse_save',
            'permission_callback' => 'strik_vierdaagse_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_vierdaagse_save',
            'permission_callback' => 'strik_vierdaagse_permission',
        ),
        array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => 'strik_vierdaagse_delete',
            'permission_callback' => 'strik_vierdaagse_permission',
        ),
    ));

    register_rest_route('strik/v1', '/vierdaagse-products', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_vierdaagse_get_products',
            'permission_callback' => 'strik_vierdaagse_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_vierdaagse_save_products',
            'permission_callback' => 'strik_vierdaagse_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_vierdaagse_save_products',
            'permission_callback' => 'strik_vierdaagse_permission',
        ),
    ));
});
