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

if (!function_exists('strik_revenue_source')) {
function strik_revenue_source($value, $fallback = 'manual') {
    $value = strtolower(sanitize_text_field((string) $value));

    if ($value === 'excel') return 'excel';
    if (in_array($value, array('dagafsluiting', 'dagomzet', 'daily', 'gmail'), true)) {
        return 'dagafsluiting';
    }

    return $fallback;
}
}

if (!function_exists('strik_revenue_date')) {
function strik_revenue_date($value) {
    $value = sanitize_text_field((string) $value);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return '';

    $parts = explode('-', $value);
    return checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0])
        ? $value
        : '';
}
}

if (!function_exists('strik_revenue_iso_parts')) {
function strik_revenue_iso_parts($date) {
    $timezone = new DateTimeZone('UTC');
    $date_time = DateTime::createFromFormat('!Y-m-d', $date, $timezone);

    if (!$date_time) {
        return array('year' => 0, 'week' => 0);
    }

    return array(
        'year' => (int) $date_time->format('o'),
        'week' => (int) $date_time->format('W'),
    );
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
        'source' => isset($record['source']) ? strik_revenue_source($record['source']) : 'manual',
        'updatedAt' => isset($record['updatedAt']) ? strik_revenue_text($record['updatedAt'], 120) : wp_date(DATE_ATOM),
    );
}
}

if (!function_exists('strik_revenue_normalize_daily_record')) {
function strik_revenue_normalize_daily_record($record) {
    if (!is_array($record)) return null;

    $date = isset($record['date']) ? strik_revenue_date($record['date']) : '';
    $shop = isset($record['shop']) ? strik_revenue_shop($record['shop']) : '';
    $amount = isset($record['amount']) ? round((float) $record['amount'], 2) : 0;

    if ($date === '' || $shop === '') return null;

    $iso_parts = strik_revenue_iso_parts($date);
    $source = isset($record['source'])
        ? strik_revenue_source($record['source'], 'dagafsluiting')
        : 'dagafsluiting';
    if ($source === 'excel') $source = 'dagafsluiting';

    return array(
        'id' => isset($record['id'])
            ? sanitize_key($record['id'])
            : sanitize_key($date . '-' . $shop),
        'date' => $date,
        'year' => $iso_parts['year'],
        'week' => $iso_parts['week'],
        'shop' => $shop,
        'amount' => max(0, $amount),
        'note' => isset($record['note']) ? strik_revenue_text($record['note']) : '',
        'source' => $source,
        'messageId' => isset($record['messageId']) ? strik_revenue_text($record['messageId'], 200) : '',
        'importedAt' => isset($record['importedAt']) ? strik_revenue_text($record['importedAt'], 120) : wp_date(DATE_ATOM),
        'updatedAt' => isset($record['updatedAt']) ? strik_revenue_text($record['updatedAt'], 120) : wp_date(DATE_ATOM),
    );
}
}

if (!function_exists('strik_revenue_cash_denominations')) {
function strik_revenue_cash_denominations() {
    return array(
        'eur500', 'eur200', 'eur100', 'eur50', 'eur20', 'eur10', 'eur5',
        'eur2', 'eur1', 'cent50', 'cent20', 'cent10', 'cent5', 'cent2', 'cent1',
    );
}
}

if (!function_exists('strik_revenue_normalize_cash_denominations')) {
function strik_revenue_normalize_cash_denominations($value) {
    $counts = array();
    $source = is_array($value) ? $value : array();

    foreach (strik_revenue_cash_denominations() as $key) {
        $count = isset($source[$key]) ? absint($source[$key]) : 0;
        if ($count > 0) $counts[$key] = $count;
    }

    return $counts;
}
}

if (!function_exists('strik_revenue_normalize_cash_record')) {
function strik_revenue_normalize_cash_record($record) {
    if (!is_array($record)) return null;

    $date = isset($record['date']) ? strik_revenue_date($record['date']) : '';
    $shop = isset($record['shop']) ? strik_revenue_shop($record['shop']) : '';
    if ($date === '' || $shop === '') return null;

    $iso_parts = strik_revenue_iso_parts($date);
    $denominations = strik_revenue_normalize_cash_denominations(
        isset($record['denominations']) ? $record['denominations'] : array()
    );
    $source = isset($record['source'])
        ? strik_revenue_source($record['source'], 'dagafsluiting')
        : 'dagafsluiting';
    if ($source === 'excel') $source = 'dagafsluiting';

    return array(
        'id' => isset($record['id'])
            ? sanitize_key($record['id'])
            : sanitize_key('cash-' . $date . '-' . $shop),
        'date' => $date,
        'year' => $iso_parts['year'],
        'week' => $iso_parts['week'],
        'shop' => $shop,
        'denominations' => $denominations,
        'denominationTotal' => isset($record['denominationTotal']) ? round((float) $record['denominationTotal'], 2) : 0,
        'countedCash' => isset($record['countedCash']) ? round((float) $record['countedCash'], 2) : 0,
        'startCash' => isset($record['startCash']) ? round((float) $record['startCash'], 2) : null,
        'cashRevenue' => isset($record['cashRevenue']) ? round((float) $record['cashRevenue'], 2) : null,
        'expectedCash' => isset($record['expectedCash']) ? round((float) $record['expectedCash'], 2) : null,
        'difference' => isset($record['difference']) ? round((float) $record['difference'], 2) : null,
        'safeCash' => isset($record['safeCash']) ? round((float) $record['safeCash'], 2) : null,
        'safeDifference' => isset($record['safeDifference']) ? round((float) $record['safeDifference'], 2) : null,
        'iceCash' => isset($record['iceCash']) ? round((float) $record['iceCash'], 2) : null,
        'cashImportKind' => isset($record['cashImportKind']) && in_array(strtolower((string) $record['cashImportKind']), array('patisserie', 'ice'), true) ? strtolower((string) $record['cashImportKind']) : '',
        'countedBy' => isset($record['countedBy']) ? strik_revenue_text($record['countedBy'], 120) : '',
        'openedAt' => isset($record['openedAt']) ? strik_revenue_text($record['openedAt'], 40) : '',
        'closedAt' => isset($record['closedAt']) ? strik_revenue_text($record['closedAt'], 40) : '',
        'checkedAt' => isset($record['checkedAt']) ? strik_revenue_text($record['checkedAt'], 120) : '',
        'checkedBy' => isset($record['checkedBy']) ? strik_revenue_text($record['checkedBy'], 120) : '',
        'note' => isset($record['note']) ? strik_revenue_text($record['note']) : '',
        'source' => $source,
        'messageId' => isset($record['messageId']) ? strik_revenue_text($record['messageId'], 200) : '',
        'importedAt' => isset($record['importedAt']) ? strik_revenue_text($record['importedAt'], 120) : wp_date(DATE_ATOM),
        'updatedAt' => isset($record['updatedAt']) ? strik_revenue_text($record['updatedAt'], 120) : wp_date(DATE_ATOM),
    );
}
}

if (!function_exists('strik_revenue_normalize_cash_deposit')) {
function strik_revenue_normalize_cash_deposit($record) {
    if (!is_array($record)) return null;

    $year = isset($record['year']) ? absint($record['year']) : 0;
    $week = isset($record['week']) ? absint($record['week']) : 0;
    $shop = isset($record['shop']) ? strik_revenue_shop($record['shop']) : '';
    if ($year < 2020 || $year > 2100 || $week < 1 || $week > 53 || $shop === '') {
        return null;
    }

    $cash_record_ids = array();
    $raw_cash_record_ids = isset($record['cashRecordIds']) && is_array($record['cashRecordIds'])
        ? $record['cashRecordIds']
        : array();
    foreach (array_slice($raw_cash_record_ids, 0, 400) as $id) {
        $clean_id = strik_revenue_text($id, 160);
        if ($clean_id !== '') $cash_record_ids[] = $clean_id;
    }

    return array(
        'id' => isset($record['id'])
            ? sanitize_key($record['id'])
            : sanitize_key('cash-deposit-' . $year . '-' . $week . '-' . $shop),
        'year' => $year,
        'week' => $week,
        'shop' => $shop,
        'amount' => isset($record['amount']) ? max(0, round((float) $record['amount'], 2)) : 0,
        'dateFrom' => isset($record['dateFrom']) ? strik_revenue_date($record['dateFrom']) : '',
        'dateTo' => isset($record['dateTo']) ? strik_revenue_date($record['dateTo']) : '',
        'cashRecordIds' => $cash_record_ids,
        'depositedAt' => isset($record['depositedAt']) ? strik_revenue_text($record['depositedAt'], 120) : '',
        'depositedBy' => isset($record['depositedBy']) ? strik_revenue_text($record['depositedBy'], 120) : '',
        'note' => isset($record['note']) ? strik_revenue_text($record['note']) : '',
        'createdAt' => isset($record['createdAt']) ? strik_revenue_text($record['createdAt'], 120) : wp_date(DATE_ATOM),
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

    $daily_records = array();
    $raw_daily_records = isset($data['dailyRecords']) && is_array($data['dailyRecords'])
        ? $data['dailyRecords']
        : array();

    foreach (array_slice($raw_daily_records, 0, 5000) as $record) {
        $clean_record = strik_revenue_normalize_daily_record($record);
        if ($clean_record) $daily_records[] = $clean_record;
    }

    $cash_records = array();
    $raw_cash_records = isset($data['cashRecords']) && is_array($data['cashRecords'])
        ? $data['cashRecords']
        : array();

    foreach (array_slice($raw_cash_records, 0, 8000) as $record) {
        $clean_record = strik_revenue_normalize_cash_record($record);
        if ($clean_record) $cash_records[] = $clean_record;
    }

    $cash_deposits = array();
    $raw_cash_deposits = isset($data['cashDeposits']) && is_array($data['cashDeposits'])
        ? $data['cashDeposits']
        : array();

    foreach (array_slice($raw_cash_deposits, 0, 4000) as $record) {
        $clean_record = strik_revenue_normalize_cash_deposit($record);
        if ($clean_record) $cash_deposits[] = $clean_record;
    }

    return array(
        'records' => $records,
        'dailyRecords' => $daily_records,
        'cashRecords' => $cash_records,
        'cashDeposits' => $cash_deposits,
        'updatedAt' => isset($data['updatedAt']) ? strik_revenue_text($data['updatedAt'], 120) : '',
    );
}
}

if (!function_exists('strik_revenue_get_data')) {
function strik_revenue_get_data() {
    $data = get_option(STRIK_REVENUE_OPTION_NAME, array(
        'records' => array(),
        'dailyRecords' => array(),
        'cashRecords' => array(),
        'cashDeposits' => array(),
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
