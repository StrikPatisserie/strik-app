<?php
/**
 * Strik app - team agenda API
 *
 * Plaats deze snippet in WordPress. De app gebruikt:
 * GET /wp-json/strik/v1/team-agenda?key=...
 * PUT /wp-json/strik/v1/team-agenda?key=...
 */

if (!defined('STRIK_TEAM_AGENDA_API_KEY')) {
    define('STRIK_TEAM_AGENDA_API_KEY', 'schoonmaak-ijs-strik');
}

function strik_team_agenda_permission($request) {
    $key = (string) $request->get_param('key');

    if (hash_equals(STRIK_TEAM_AGENDA_API_KEY, $key)) {
        return true;
    }

    return new WP_Error(
        'strik_team_agenda_forbidden',
        'Geen toegang tot de Strik agenda.',
        array('status' => 403)
    );
}

function strik_team_agenda_allowed_types() {
    return array('event', 'holiday', 'training', 'closing', 'birthday', 'anniversary');
}

function strik_team_agenda_allowed_audiences() {
    return array('alle', 'lent', 'heyendaal', 'daalseweg', 'ziekerstraat');
}

function strik_team_agenda_get_data() {
    $data = get_option('strik_team_agenda_data', array());

    if (!is_array($data)) {
        $data = array();
    }

    return array(
        'events' => isset($data['events']) && is_array($data['events']) ? $data['events'] : array(),
        'updatedAt' => isset($data['updatedAt']) ? sanitize_text_field($data['updatedAt']) : '',
    );
}

function strik_team_agenda_get($request) {
    return rest_ensure_response(strik_team_agenda_get_data());
}

function strik_team_agenda_clean_choice($value, $allowed, $fallback) {
    $value = sanitize_key((string) $value);

    return in_array($value, $allowed, true) ? $value : $fallback;
}

function strik_team_agenda_clean_date($value) {
    $value = sanitize_text_field((string) $value);

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return $value;
    }

    return '';
}

function strik_team_agenda_sanitize_events($events) {
    $clean = array();

    if (!is_array($events)) {
        return $clean;
    }

    foreach (array_slice($events, 0, 500) as $event) {
        if (!is_array($event)) {
            continue;
        }

        $title = isset($event['title']) ? sanitize_text_field($event['title']) : '';
        $date = isset($event['date']) ? strik_team_agenda_clean_date($event['date']) : '';

        if ($title === '' || $date === '') {
            continue;
        }

        $clean[] = array(
            'id' => isset($event['id']) ? sanitize_key($event['id']) : uniqid('event-', true),
            'title' => $title,
            'date' => $date,
            'type' => strik_team_agenda_clean_choice(
                isset($event['type']) ? $event['type'] : 'event',
                strik_team_agenda_allowed_types(),
                'event'
            ),
            'audience' => strik_team_agenda_clean_choice(
                isset($event['audience']) ? $event['audience'] : 'alle',
                strik_team_agenda_allowed_audiences(),
                'alle'
            ),
            'description' => isset($event['description']) ? sanitize_textarea_field($event['description']) : '',
            'recurringYearly' => !empty($event['recurringYearly']),
            'source' => isset($event['source']) && $event['source'] === 'tamigo' ? 'tamigo' : 'manual',
            'createdAt' => isset($event['createdAt']) ? sanitize_text_field($event['createdAt']) : wp_date(DATE_ATOM),
            'updatedAt' => isset($event['updatedAt']) ? sanitize_text_field($event['updatedAt']) : wp_date(DATE_ATOM),
        );
    }

    return $clean;
}

function strik_team_agenda_save($request) {
    $params = $request->get_json_params();

    if (!is_array($params)) {
        $params = array();
    }

    $data = array(
        'events' => strik_team_agenda_sanitize_events(isset($params['events']) ? $params['events'] : array()),
        'updatedAt' => wp_date(DATE_ATOM),
    );

    update_option('strik_team_agenda_data', $data, false);

    return rest_ensure_response($data);
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/team-agenda', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_team_agenda_get',
            'permission_callback' => 'strik_team_agenda_permission',
        ),
        array(
            'methods' => WP_REST_Server::EDITABLE,
            'callback' => 'strik_team_agenda_save',
            'permission_callback' => 'strik_team_agenda_permission',
        ),
    ));
});
