export const TEMPERATURE_REGISTRATION_SNIPPET = String.raw`<?php
/**
 * Strik app - temperatuurregistratie API
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * De app gebruikt:
 * - GET  /wp-json/strik/v1/temperature-registration
 * - POST /wp-json/strik/v1/temperature-registration
 *
 * Elke POST overschrijft de bestaande registratie met dezelfde datum + winkel.
 */

if (!defined('STRIK_TEMPERATURE_API_KEY')) {
    define('STRIK_TEMPERATURE_API_KEY', 'schoonmaak-ijs-strik');
}

function strik_temperature_v1_permission($request) {
    return hash_equals(STRIK_TEMPERATURE_API_KEY, (string) $request->get_param('key'))
        ? true
        : new WP_Error('strik_temperature_forbidden', 'Geen toegang.', array('status' => 403));
}

function strik_temperature_v1_clean_date($value) {
    $value = sanitize_text_field((string) $value);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
}

function strik_temperature_v1_registrations($items) {
    $clean = array();

    if (!is_array($items)) return $clean;

    foreach (array_slice($items, 0, 80) as $item) {
        if (!is_array($item)) continue;

        $naam = isset($item['naam']) ? sanitize_text_field($item['naam']) : '';
        $display_temperatuur = isset($item['displayTemperatuur']) ? sanitize_text_field($item['displayTemperatuur']) : '';
        $hand_temperatuur = isset($item['handTemperatuur']) ? sanitize_text_field($item['handTemperatuur']) : '';
        if ($hand_temperatuur === '' && isset($item['temperatuur'])) {
            $hand_temperatuur = sanitize_text_field($item['temperatuur']);
        }

        if ($naam === '' && $display_temperatuur === '' && $hand_temperatuur === '') continue;

        $clean[] = array(
            'id' => isset($item['id']) ? sanitize_text_field($item['id']) : uniqid('temp-', true),
            'naam' => $naam,
            'displayTemperatuur' => $display_temperatuur,
            'handTemperatuur' => $hand_temperatuur,
        );
    }

    return $clean;
}

function strik_temperature_v1_option_items() {
    $items = get_option('strik_temperature_registration_items', array());

    if (!is_array($items)) return array();
    if (isset($items['items']) && is_array($items['items'])) $items = $items['items'];

    return array_values(array_filter($items, 'is_array'));
}

function strik_temperature_v1_normalize_item($item) {
    return array(
        'id' => isset($item['id']) ? absint($item['id']) : 0,
        'winkel' => isset($item['winkel']) ? sanitize_text_field($item['winkel']) : '',
        'naam' => isset($item['naam']) ? sanitize_text_field($item['naam']) : '',
        'datum' => isset($item['datum']) ? strik_temperature_v1_clean_date($item['datum']) : '',
        'opmerking' => isset($item['opmerking']) ? sanitize_textarea_field($item['opmerking']) : '',
        'temperatuurRegistraties' => strik_temperature_v1_registrations(isset($item['temperatuurRegistraties']) ? $item['temperatuurRegistraties'] : array()),
        'createdAt' => isset($item['createdAt']) ? sanitize_text_field($item['createdAt']) : '',
        'updatedAt' => isset($item['updatedAt']) ? sanitize_text_field($item['updatedAt']) : '',
        'source' => 'option',
    );
}

function strik_temperature_v1_get_items() {
    $items = array();

    foreach (strik_temperature_v1_option_items() as $item) {
        $clean = strik_temperature_v1_normalize_item($item);
        if ($clean['datum'] !== '' && $clean['winkel'] !== '') $items[] = $clean;
    }

    return $items;
}

function strik_temperature_v1_get($request) {
    return rest_ensure_response(strik_temperature_v1_get_items());
}

function strik_temperature_v1_save($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) $params = array();

    $items = strik_temperature_v1_option_items();
    $max_id = 0;
    $now = wp_date(DATE_ATOM);
    $datum = isset($params['datum']) && strik_temperature_v1_clean_date($params['datum']) !== ''
        ? strik_temperature_v1_clean_date($params['datum'])
        : wp_date('Y-m-d');
    $winkel = isset($params['winkel']) ? sanitize_text_field($params['winkel']) : '';
    $existing_index = null;
    $existing_item = null;

    foreach ($items as $index => $item) {
        if (isset($item['id'])) $max_id = max($max_id, absint($item['id']));

        $item_datum = isset($item['datum']) ? strik_temperature_v1_clean_date($item['datum']) : '';
        $item_winkel = isset($item['winkel']) ? sanitize_text_field($item['winkel']) : '';

        if ($item_datum === $datum && $item_winkel === $winkel) {
            $existing_index = $index;
            $existing_item = $item;
        }
    }

    $new_item = array(
        'id' => $existing_item && isset($existing_item['id']) ? absint($existing_item['id']) : $max_id + 1,
        'winkel' => $winkel,
        'naam' => isset($params['naam']) ? sanitize_text_field($params['naam']) : '',
        'datum' => $datum,
        'opmerking' => isset($params['opmerking']) ? sanitize_textarea_field($params['opmerking']) : '',
        'temperatuurRegistraties' => strik_temperature_v1_registrations(isset($params['temperatuurRegistraties']) ? $params['temperatuurRegistraties'] : array()),
        'createdAt' => $existing_item && isset($existing_item['createdAt']) ? sanitize_text_field($existing_item['createdAt']) : $now,
        'updatedAt' => $now,
    );

    if ($existing_index !== null) {
        $items[$existing_index] = $new_item;
    } else {
        $items[] = $new_item;
    }

    if (count($items) > 1200) $items = array_slice($items, -1200);

    update_option('strik_temperature_registration_items', array_values($items), false);

    return rest_ensure_response($new_item);
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/temperature-registration', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_temperature_v1_get',
            'permission_callback' => 'strik_temperature_v1_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_temperature_v1_save',
            'permission_callback' => 'strik_temperature_v1_permission',
        ),
    ), true);
});

function strik_temperature_v1_admin_menu() {
    add_menu_page(
        'Temperatuurregistraties',
        'Temperatuurregistraties',
        'manage_options',
        'strik-temperatuurregistraties',
        'strik_temperature_v1_admin_page',
        'dashicons-temperature',
        26
    );
}

add_action('admin_menu', 'strik_temperature_v1_admin_menu');

function strik_temperature_v1_admin_page() {
    if (!current_user_can('manage_options')) wp_die('Geen toegang.');

    $items = strik_temperature_v1_get_items();

    usort($items, function ($a, $b) {
        return strcmp(isset($b['datum']) ? $b['datum'] : '', isset($a['datum']) ? $a['datum'] : '');
    });

    echo '<div class="wrap">';
    echo '<h1>Temperatuurregistraties</h1>';
    echo '<p>Gevonden registraties: <strong>' . esc_html(count($items)) . '</strong></p>';

    if (empty($items)) {
        echo '<div class="notice notice-info"><p>Nog geen temperatuurregistraties opgeslagen.</p></div>';
        echo '</div>';
        return;
    }

    echo '<table class="widefat striped">';
    echo '<thead><tr><th>Datum</th><th>Winkel</th><th>Naam</th><th>Temperaturen</th><th>Opmerking</th><th>Laatst opgeslagen</th></tr></thead><tbody>';

    foreach ($items as $item) {
        $temps = isset($item['temperatuurRegistraties']) && is_array($item['temperatuurRegistraties'])
            ? $item['temperatuurRegistraties']
            : array();

        echo '<tr>';
        echo '<td>' . esc_html($item['datum']) . '</td>';
        echo '<td>' . esc_html($item['winkel']) . '</td>';
        echo '<td>' . esc_html($item['naam']) . '</td>';
        echo '<td><ul>';
        foreach ($temps as $temp) {
            $display_temperatuur = isset($temp['displayTemperatuur']) ? $temp['displayTemperatuur'] : '';
            $hand_temperatuur = isset($temp['handTemperatuur']) ? $temp['handTemperatuur'] : (isset($temp['temperatuur']) ? $temp['temperatuur'] : '');

            echo '<li>' . esc_html($temp['naam'] . ': display ' . ($display_temperatuur !== '' ? $display_temperatuur : '-') . ' °C, handmeting ' . ($hand_temperatuur !== '' ? $hand_temperatuur : '-') . ' °C') . '</li>';
        }
        echo '</ul></td>';
        echo '<td>' . nl2br(esc_html($item['opmerking'])) . '</td>';
        echo '<td>' . esc_html($item['updatedAt']) . '</td>';
        echo '</tr>';
    }

    echo '</tbody></table>';
    echo '</div>';
}
`;
