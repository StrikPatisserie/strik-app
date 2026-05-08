<?php
/**
 * Strik app - notities API
 *
 * Plaats deze snippet in WordPress. De app gebruikt:
 * GET /wp-json/strik/v1/notes?key=...&winkel=lent
 * PUT /wp-json/strik/v1/notes?key=...&winkel=lent
 */

if (!defined('STRIK_NOTES_API_KEY')) {
    define('STRIK_NOTES_API_KEY', 'schoonmaak-ijs-strik');
}

function strik_notes_allowed_winkels() {
    return array(
        'lent' => 'Lent',
        'heyendaal' => 'Heyendaal',
        'daalseweg' => 'Daalseweg',
        'ziekerstraat' => 'Ziekerstraat',
    );
}

function strik_notes_normalize_winkel($winkel) {
    $slug = sanitize_title((string) $winkel);

    if (strpos($slug, 'ijsloket-') === 0) {
        $slug = substr($slug, strlen('ijsloket-'));
    }

    $allowed = strik_notes_allowed_winkels();
    return array_key_exists($slug, $allowed) ? $slug : '';
}

function strik_notes_permission($request) {
    $key = (string) $request->get_param('key');

    if (hash_equals(STRIK_NOTES_API_KEY, $key)) {
        return true;
    }

    return new WP_Error(
        'strik_notes_forbidden',
        'Geen toegang tot notities.',
        array('status' => 403)
    );
}

function strik_notes_get_all_boards() {
    $boards = get_option('strik_notes_boards', array());
    return is_array($boards) ? $boards : array();
}

function strik_notes_empty_board($winkel) {
    return array(
        'winkel' => $winkel,
        'notes' => array(),
        'todos' => array(),
        'updatedAt' => '',
    );
}

function strik_notes_get_board($request) {
    $winkel = strik_notes_normalize_winkel($request->get_param('winkel'));

    if (!$winkel) {
        return new WP_Error(
            'strik_notes_invalid_winkel',
            'Onbekende winkel.',
            array('status' => 400)
        );
    }

    $boards = strik_notes_get_all_boards();
    $board = isset($boards[$winkel]) && is_array($boards[$winkel])
        ? $boards[$winkel]
        : strik_notes_empty_board($winkel);

    return rest_ensure_response($board);
}

function strik_notes_sanitize_items($items, $type) {
    $clean = array();

    if (!is_array($items)) {
        return $clean;
    }

    foreach (array_slice($items, 0, 200) as $item) {
        if (!is_array($item)) {
            continue;
        }

        $text = isset($item['text']) ? sanitize_textarea_field($item['text']) : '';
        if ($text === '') {
            continue;
        }

        $clean_item = array(
            'id' => isset($item['id']) ? sanitize_key($item['id']) : uniqid($type . '-', true),
            'text' => $text,
            'createdAt' => isset($item['createdAt']) ? sanitize_text_field($item['createdAt']) : wp_date(DATE_ATOM),
        );

        if ($type === 'todo') {
            $clean_item['done'] = !empty($item['done']);
        }

        $clean[] = $clean_item;
    }

    return $clean;
}

function strik_notes_save_board($request) {
    $winkel = strik_notes_normalize_winkel($request->get_param('winkel'));

    if (!$winkel) {
        return new WP_Error(
            'strik_notes_invalid_winkel',
            'Onbekende winkel.',
            array('status' => 400)
        );
    }

    $params = $request->get_json_params();
    if (!is_array($params)) {
        $params = array();
    }

    $board = array(
        'winkel' => $winkel,
        'notes' => strik_notes_sanitize_items(isset($params['notes']) ? $params['notes'] : array(), 'note'),
        'todos' => strik_notes_sanitize_items(isset($params['todos']) ? $params['todos'] : array(), 'todo'),
        'updatedAt' => wp_date(DATE_ATOM),
    );

    $boards = strik_notes_get_all_boards();
    $boards[$winkel] = $board;

    update_option('strik_notes_boards', $boards, false);

    return rest_ensure_response($board);
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/notes', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_notes_get_board',
            'permission_callback' => 'strik_notes_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_notes_save_board',
            'permission_callback' => 'strik_notes_permission',
        ),
    ));
});
