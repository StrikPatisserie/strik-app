<?php
/**
 * Strik app - Bruidstaart Studio API
 *
 * Plaats deze snippet in WordPress. De app gebruikt:
 * GET /wp-json/strik/v1/wedding-cakes?key=...&search=JANSEN&deliveryDate=2026-05-12
 * GET /wp-json/strik/v1/wedding-cakes?key=...&year=2026&limit=all
 * PUT /wp-json/strik/v1/wedding-cakes?key=...
 * DELETE /wp-json/strik/v1/wedding-cakes?key=...&code=BRUID123
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

if (!function_exists('strik_wedding_cakes_year')) {
function strik_wedding_cakes_year($value) {
    $year = preg_replace('/[^0-9]/', '', (string) $value);
    return strlen($year) === 4 ? $year : '';
}
}

if (!function_exists('strik_wedding_cakes_get_contact')) {
function strik_wedding_cakes_get_contact($draft) {
    if (!isset($draft['config']) || !is_array($draft['config'])) {
        return array();
    }

    if (!isset($draft['config']['contact']) || !is_array($draft['config']['contact'])) {
        return array();
    }

    return $draft['config']['contact'];
}
}

if (!function_exists('strik_wedding_cakes_overview_date')) {
function strik_wedding_cakes_overview_date($draft) {
    $contact = strik_wedding_cakes_get_contact($draft);

    foreach (array('deliveryDate', 'weddingDate') as $key) {
        if (!empty($contact[$key])) {
            return strik_wedding_cakes_text($contact[$key]);
        }
    }

    if (!empty($draft['updatedAt'])) {
        return substr(strik_wedding_cakes_text($draft['updatedAt']), 0, 10);
    }

    if (!empty($draft['createdAt'])) {
        return substr(strik_wedding_cakes_text($draft['createdAt']), 0, 10);
    }

    return '';
}
}

if (!function_exists('strik_wedding_cakes_matches_year')) {
function strik_wedding_cakes_matches_year($draft, $year) {
    if ($year === '') {
        return true;
    }

    return substr(strik_wedding_cakes_overview_date($draft), 0, 4) === $year;
}
}

if (!function_exists('strik_wedding_cakes_matches')) {
function strik_wedding_cakes_matches($draft, $search, $delivery_date) {
    $contact = strik_wedding_cakes_get_contact($draft);

    $haystack = strtolower(
        implode(' ', array(
            isset($draft['code']) ? $draft['code'] : '',
            isset($draft['surname']) ? $draft['surname'] : '',
            isset($draft['names']) ? $draft['names'] : '',
            isset($contact['deliveryDate']) ? $contact['deliveryDate'] : '',
            isset($contact['weddingDate']) ? $contact['weddingDate'] : '',
        ))
    );

    $matches_search = $search === '' || strpos($haystack, strtolower($search)) !== false;
    $matches_date = $delivery_date === ''
        || (isset($contact['deliveryDate']) && $contact['deliveryDate'] === $delivery_date)
        || (isset($contact['weddingDate']) && $contact['weddingDate'] === $delivery_date);

    return $matches_search && $matches_date;
}
}

if (!function_exists('strik_wedding_cakes_get')) {
function strik_wedding_cakes_get($request) {
    $search = strik_wedding_cakes_text($request->get_param('search'));
    $delivery_date = strik_wedding_cakes_text($request->get_param('deliveryDate'));
    $year = strik_wedding_cakes_year($request->get_param('year'));
    $limit = strik_wedding_cakes_text($request->get_param('limit'));
    $drafts = array_values(strik_wedding_cakes_get_all());
    $filtered = array();

    foreach ($drafts as $draft) {
        if (
            !is_array($draft)
            || !strik_wedding_cakes_matches($draft, $search, $delivery_date)
            || !strik_wedding_cakes_matches_year($draft, $year)
        ) {
            continue;
        }

        $filtered[] = $draft;
    }

    usort($filtered, function ($a, $b) use ($year) {
        if ($year !== '') {
            $date_compare = strcmp(
                strik_wedding_cakes_overview_date($a),
                strik_wedding_cakes_overview_date($b)
            );

            if ($date_compare) return $date_compare;

            return strcmp(
                isset($a['code']) ? $a['code'] : '',
                isset($b['code']) ? $b['code'] : ''
            );
        }

        return strcmp(
            isset($b['updatedAt']) ? $b['updatedAt'] : '',
            isset($a['updatedAt']) ? $a['updatedAt'] : ''
        );
    });

    $response_drafts = $limit === 'all'
        ? $filtered
        : array_slice($filtered, 0, 50);

    return rest_ensure_response(array(
        'drafts' => $response_drafts,
        'total' => count($filtered),
        'year' => $year,
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

if (!function_exists('strik_wedding_cakes_delete')) {
function strik_wedding_cakes_delete($request) {
    $code = strik_wedding_cakes_text($request->get_param('code'));

    if ($code === '') {
        $params = $request->get_json_params();
        if (is_array($params) && isset($params['code'])) {
            $code = strik_wedding_cakes_text($params['code']);
        }
    }

    if ($code === '') {
        return new WP_Error(
            'strik_wedding_cakes_missing_code',
            'Herkenningscode is verplicht om te verwijderen.',
            array('status' => 400)
        );
    }

    $drafts = strik_wedding_cakes_get_all();
    $storage_key = sanitize_key(strtolower($code));

    if (!isset($drafts[$storage_key])) {
        return rest_ensure_response(array(
            'deleted' => false,
            'code' => $code,
            'message' => 'Concept niet gevonden.',
        ));
    }

    unset($drafts[$storage_key]);
    update_option('strik_wedding_cake_drafts', $drafts, false);

    return rest_ensure_response(array(
        'deleted' => true,
        'code' => $code,
    ));
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
        array(
            'methods' => WP_REST_Server::DELETABLE,
            'callback' => 'strik_wedding_cakes_delete',
            'permission_callback' => 'strik_wedding_cakes_permission',
        ),
    ));
});

if (!function_exists('strik_wedding_cakes_admin_date')) {
function strik_wedding_cakes_admin_date($value) {
    $value = strik_wedding_cakes_text($value);
    return $value !== '' ? $value : '-';
}
}

if (!function_exists('strik_wedding_cakes_admin_value')) {
function strik_wedding_cakes_admin_value($array, $key, $fallback = '-') {
    if (!is_array($array) || !isset($array[$key])) {
        return $fallback;
    }

    $value = strik_wedding_cakes_text($array[$key]);
    return $value !== '' ? $value : $fallback;
}
}

if (!function_exists('strik_wedding_cakes_admin_years')) {
function strik_wedding_cakes_admin_years($drafts) {
    $years = array();

    foreach ($drafts as $draft) {
        if (!is_array($draft)) continue;

        $year = substr(strik_wedding_cakes_overview_date($draft), 0, 4);
        if (strlen($year) === 4) {
            $years[$year] = true;
        }
    }

    $years = array_keys($years);
    rsort($years, SORT_STRING);

    if (empty($years)) {
        $years[] = wp_date('Y');
    }

    return $years;
}
}

if (!function_exists('strik_wedding_cakes_admin_menu')) {
function strik_wedding_cakes_admin_menu() {
    add_menu_page(
        'Bruidstaarten',
        'Bruidstaarten',
        'manage_options',
        'strik-bruidstaarten',
        'strik_wedding_cakes_admin_page',
        'dashicons-heart',
        26
    );
}
}

add_action('admin_menu', 'strik_wedding_cakes_admin_menu');

if (!function_exists('strik_wedding_cakes_admin_page')) {
function strik_wedding_cakes_admin_page() {
    if (!current_user_can('manage_options')) wp_die('Geen toegang.');

    $all_drafts = array_values(strik_wedding_cakes_get_all());
    $years = strik_wedding_cakes_admin_years($all_drafts);
    $selected_year = strik_wedding_cakes_year(isset($_GET['jaar']) ? wp_unslash($_GET['jaar']) : '');
    if ($selected_year === '') {
        $selected_year = isset($years[0]) ? $years[0] : wp_date('Y');
    }

    $drafts = array_values(array_filter($all_drafts, function ($draft) use ($selected_year) {
        return is_array($draft) && strik_wedding_cakes_matches_year($draft, $selected_year);
    }));

    usort($drafts, function ($a, $b) {
        $date_compare = strcmp(
            strik_wedding_cakes_overview_date($b),
            strik_wedding_cakes_overview_date($a)
        );

        if ($date_compare) return $date_compare;

        return strcmp(
            isset($a['code']) ? $a['code'] : '',
            isset($b['code']) ? $b['code'] : ''
        );
    });

    $completed_count = 0;
    foreach ($drafts as $draft) {
        if (!empty($draft['config']['completed'])) $completed_count += 1;
    }

    echo '<div class="wrap">';
    echo '<h1>Bruidstaarten</h1>';
    echo '<p>Reserve-overzicht van de bruidstaart studio. Concepten en definitieve bestellingen staan samen in deze lijst.</p>';

    echo '<form method="get" style="margin: 1rem 0;">';
    echo '<input type="hidden" name="page" value="strik-bruidstaarten">';
    echo '<label for="strik-wedding-cakes-year"><strong>Jaar</strong></label> ';
    echo '<select id="strik-wedding-cakes-year" name="jaar">';
    foreach ($years as $year) {
        echo '<option value="' . esc_attr($year) . '"' . selected($selected_year, $year, false) . '>' . esc_html($year) . '</option>';
    }
    echo '</select> ';
    submit_button('Toon jaar', 'secondary', '', false);
    echo '</form>';

    echo '<p>Gevonden bruidstaarten in <strong>' . esc_html($selected_year) . '</strong>: <strong>' . esc_html(count($drafts)) . '</strong>';
    echo ' &middot; Definitief: <strong>' . esc_html($completed_count) . '</strong>';
    echo ' &middot; Concept: <strong>' . esc_html(count($drafts) - $completed_count) . '</strong></p>';

    if (empty($drafts)) {
        echo '<div class="notice notice-warning"><p>Nog geen bruidstaarten gevonden voor dit jaar.</p></div>';
        echo '</div>';
        return;
    }

    echo '<table class="widefat striped">';
    echo '<thead><tr><th>Leverdatum</th><th>Trouwdatum</th><th>Status</th><th>Code</th><th>Naam</th><th>Bijgewerkt</th><th>Details</th></tr></thead><tbody>';

    foreach ($drafts as $draft) {
        $config = isset($draft['config']) && is_array($draft['config']) ? $draft['config'] : array();
        $contact = isset($config['contact']) && is_array($config['contact']) ? $config['contact'] : array();
        $status = !empty($config['completed']) ? 'Definitief' : 'Concept';
        $paid = !empty($config['paid']) ? 'Ja' : 'Nee';
        $name = trim(
            strik_wedding_cakes_admin_value($draft, 'surname', '') . ' ' .
            strik_wedding_cakes_admin_value($draft, 'names', '')
        );
        if ($name === '') $name = '-';

        echo '<tr>';
        echo '<td>' . esc_html(strik_wedding_cakes_admin_date(isset($contact['deliveryDate']) ? $contact['deliveryDate'] : '')) . '</td>';
        echo '<td>' . esc_html(strik_wedding_cakes_admin_date(isset($contact['weddingDate']) ? $contact['weddingDate'] : '')) . '</td>';
        echo '<td>' . esc_html($status) . '</td>';
        echo '<td><code>' . esc_html(strik_wedding_cakes_admin_value($draft, 'code')) . '</code></td>';
        echo '<td>' . esc_html($name) . '</td>';
        echo '<td>' . esc_html(strik_wedding_cakes_admin_date(isset($draft['updatedAt']) ? substr($draft['updatedAt'], 0, 16) : '')) . '</td>';
        echo '<td><details><summary>Bekijk</summary>';
        echo '<p><strong>Contact</strong><br>';
        echo 'Telefoon: ' . esc_html(strik_wedding_cakes_admin_value($contact, 'phone')) . '<br>';
        echo 'E-mail: ' . esc_html(strik_wedding_cakes_admin_value($contact, 'email')) . '<br>';
        echo 'Levering: ' . esc_html(strik_wedding_cakes_admin_value($contact, 'deliveryMethod')) . '<br>';
        echo 'Adres: ' . esc_html(strik_wedding_cakes_admin_value($contact, 'deliveryAddress')) . '</p>';
        echo '<p><strong>Betaald:</strong> ' . esc_html($paid) . '</p>';

        if (!empty($contact['notes'])) {
            echo '<p><strong>Notities:</strong><br>' . nl2br(esc_html($contact['notes'])) . '</p>';
        }

        echo '<p><strong>Volledige configuratie:</strong></p>';
        echo '<pre style="max-height: 28rem; overflow: auto; white-space: pre-wrap; background: #f6f7f7; padding: 10px;">' . esc_html(wp_json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) . '</pre>';
        echo '</details></td>';
        echo '</tr>';
    }

    echo '</tbody></table>';
    echo '</div>';
}
}
