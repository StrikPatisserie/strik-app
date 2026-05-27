<?php
/**
 * Strik app - schoonmaak API + herstel oude WordPress data
 *
 * Plaats deze snippet in WordPress via Code Snippets.
 *
 * Belangrijk:
 * - Houd maar een schoonmaak/cleaning snippet tegelijk actief.
 * - Deze snippet registreert GET en POST op /wp-json/strik/v1/cleaning.
 * - Normale app-calls lezen de snelle option-opslag.
 * - Oude WordPress posts met "ijsloket" data zijn optioneel via ?legacy=1.
 */

if (!defined('STRIK_CLEANING_API_KEY')) {
    define('STRIK_CLEANING_API_KEY', 'schoonmaak-ijs-strik');
}

if (!defined('STRIK_CLEANING_OPTION_NAME')) {
    define('STRIK_CLEANING_OPTION_NAME', 'strik_cleaning_items');
}

if (!defined('STRIK_CLEANING_ARCHIVE_PREFIX')) {
    define('STRIK_CLEANING_ARCHIVE_PREFIX', STRIK_CLEANING_OPTION_NAME . '_archived_');
}

if (!defined('STRIK_CLEANING_OPTION_MAX_BYTES')) {
    define('STRIK_CLEANING_OPTION_MAX_BYTES', 2500000);
}

if (!defined('STRIK_CLEANING_PHOTO_RETENTION_DAYS')) {
    define('STRIK_CLEANING_PHOTO_RETENTION_DAYS', 31);
}

if (!defined('STRIK_CLEANING_PHOTO_PREVIEW_MAX_BYTES')) {
    define('STRIK_CLEANING_PHOTO_PREVIEW_MAX_BYTES', 90000);
}

if (!defined('STRIK_CLEANING_PHOTO_UPLOAD_MAX_BYTES')) {
    define('STRIK_CLEANING_PHOTO_UPLOAD_MAX_BYTES', 750000);
}

if (!defined('STRIK_CLEANING_PHOTO_MARKER_PREFIX')) {
    define('STRIK_CLEANING_PHOTO_MARKER_PREFIX', '__strik_photo:');
}

if (!defined('STRIK_CLEANING_PHOTO_MARKER_V2_PREFIX')) {
    define('STRIK_CLEANING_PHOTO_MARKER_V2_PREFIX', '__strik_photo_v2:');
}

if (!defined('STRIK_CLEANING_PHOTO_TEMPERATURE_PREFIX')) {
    define('STRIK_CLEANING_PHOTO_TEMPERATURE_PREFIX', '__strik_photo_temperature:');
}

function strik_cleaning_v5_permission($request) {
    return hash_equals(STRIK_CLEANING_API_KEY, (string) $request->get_param('key'))
        ? true
        : new WP_Error('strik_cleaning_forbidden', 'Geen toegang.', array('status' => 403));
}

function strik_cleaning_v5_starts_with($value, $prefix) {
    return is_string($value) && strpos($value, $prefix) === 0;
}

function strik_cleaning_v5_is_photo_marker($value) {
    return strik_cleaning_v5_starts_with($value, STRIK_CLEANING_PHOTO_MARKER_PREFIX)
        || strik_cleaning_v5_starts_with($value, STRIK_CLEANING_PHOTO_MARKER_V2_PREFIX);
}

function strik_cleaning_v5_is_photo_temperature_name($value) {
    return strik_cleaning_v5_starts_with($value, STRIK_CLEANING_PHOTO_TEMPERATURE_PREFIX);
}

function strik_cleaning_v5_option_storage_stats() {
    global $wpdb;

    $row = $wpdb->get_row(
        $wpdb->prepare(
            "SELECT option_id, OCTET_LENGTH(option_value) AS bytes
             FROM {$wpdb->options}
             WHERE option_name = %s
             LIMIT 1",
            STRIK_CLEANING_OPTION_NAME
        ),
        ARRAY_A
    );

    return array(
        'exists' => is_array($row),
        'bytes' => is_array($row) && isset($row['bytes']) ? absint($row['bytes']) : 0,
    );
}

function strik_cleaning_v5_archive_option_storage($reason = 'manual') {
    global $wpdb;

    $stats = strik_cleaning_v5_option_storage_stats();
    if (!$stats['exists']) {
        add_option(STRIK_CLEANING_OPTION_NAME, array(), '', false);

        return array(
            'archived' => false,
            'reason' => sanitize_key($reason),
            'bytes' => 0,
            'message' => 'Geen bestaande schoonmaakopslag gevonden.',
        );
    }

    $archive_name = STRIK_CLEANING_OPTION_NAME . '_archived_' . gmdate('Ymd_His');
    $updated = $wpdb->update(
        $wpdb->options,
        array(
            'option_name' => $archive_name,
            'autoload' => 'no',
        ),
        array('option_name' => STRIK_CLEANING_OPTION_NAME),
        array('%s', '%s'),
        array('%s')
    );

    wp_cache_delete(STRIK_CLEANING_OPTION_NAME, 'options');
    wp_cache_delete('alloptions', 'options');

    if ($updated === false) {
        return array(
            'archived' => false,
            'reason' => sanitize_key($reason),
            'bytes' => $stats['bytes'],
            'message' => 'Archiveren van de oude schoonmaakopslag is mislukt.',
        );
    }

    add_option(STRIK_CLEANING_OPTION_NAME, array(), '', false);

    return array(
        'archived' => true,
        'reason' => sanitize_key($reason),
        'bytes' => $stats['bytes'],
        'archiveName' => $archive_name,
        'message' => 'Oude schoonmaakopslag is gearchiveerd; nieuwe opslag is leeg gestart.',
    );
}

function strik_cleaning_v5_is_archive_option_name($name) {
    return is_string($name)
        && strpos($name, STRIK_CLEANING_ARCHIVE_PREFIX) === 0
        && preg_match('/^[A-Za-z0-9_]+$/', $name);
}

function strik_cleaning_v5_archive_options() {
    global $wpdb;

    $rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT option_name, OCTET_LENGTH(option_value) AS bytes
             FROM {$wpdb->options}
             WHERE option_name LIKE %s
             ORDER BY option_id DESC
             LIMIT 20",
            $wpdb->esc_like(STRIK_CLEANING_ARCHIVE_PREFIX) . '%'
        ),
        ARRAY_A
    );

    return array_map(function ($row) {
        return array(
            'name' => isset($row['option_name']) ? sanitize_text_field($row['option_name']) : '',
            'bytes' => isset($row['bytes']) ? absint($row['bytes']) : 0,
        );
    }, is_array($rows) ? $rows : array());
}

function strik_cleaning_v5_decode($value) {
    if (is_array($value)) return $value;
    if (!is_string($value) || $value === '') return $value;

    $decoded = json_decode($value, true);
    return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
}

function strik_cleaning_v5_clean_date($value) {
    $value = sanitize_text_field((string) $value);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
}

function strik_cleaning_v5_week_range($date = '') {
    $date = strik_cleaning_v5_clean_date($date);
    if ($date === '') $date = wp_date('Y-m-d');

    $timestamp = strtotime($date . ' 00:00:00');
    if (!$timestamp) $timestamp = time();

    $day = (int) date('N', $timestamp);
    $monday = strtotime('-' . ($day - 1) . ' days', $timestamp);
    $sunday = strtotime('+' . (7 - $day) . ' days', $timestamp);

    return array(
        'startDate' => date('Y-m-d', $monday),
        'endDate' => date('Y-m-d', $sunday),
    );
}

function strik_cleaning_v5_photo_cutoff_date() {
    $timestamp = strtotime('-' . STRIK_CLEANING_PHOTO_RETENTION_DAYS . ' days', strtotime(wp_date('Y-m-d') . ' 00:00:00'));

    return date('Y-m-d', $timestamp ?: time());
}

function strik_cleaning_v5_date_is_past_photo_retention($date) {
    $date = strik_cleaning_v5_clean_date($date);
    if ($date === '') return false;

    return strcmp($date, strik_cleaning_v5_photo_cutoff_date()) < 0;
}

function strik_cleaning_v5_parse_title($title) {
    $parts = preg_split('/\s+[–-]\s+/u', (string) $title);

    return array(
        'datum' => isset($parts[0]) ? strik_cleaning_v5_clean_date($parts[0]) : '',
        'winkel' => isset($parts[1]) ? sanitize_text_field($parts[1]) : '',
        'naam' => isset($parts[2]) ? sanitize_text_field($parts[2]) : '',
    );
}

function strik_cleaning_v5_meta($post_id, $keys, $fallback = '') {
    foreach ($keys as $key) {
        $value = get_post_meta($post_id, $key, true);
        if ($value !== '' && $value !== null && $value !== array()) {
            return strik_cleaning_v5_decode($value);
        }
    }

    return $fallback;
}

function strik_cleaning_v5_content_data($post) {
    $decoded = json_decode(trim((string) $post->post_content), true);
    return is_array($decoded) ? $decoded : array();
}

function strik_cleaning_v5_value($data, $keys, $fallback = '') {
    foreach ($keys as $key) {
        if (isset($data[$key]) && $data[$key] !== '') {
            return $data[$key];
        }
    }

    return $fallback;
}

function strik_cleaning_v5_text_array($items) {
    $items = strik_cleaning_v5_decode($items);
    $clean = array();

    if (!is_array($items)) return $clean;

    foreach (array_slice($items, 0, 500) as $item) {
        if (strik_cleaning_v5_is_photo_marker($item)) continue;
        if (is_array($item) || is_object($item)) continue;

        $text = sanitize_text_field(substr((string) $item, 0, 2000));
        if ($text !== '') $clean[] = $text;
    }

    return $clean;
}

function strik_cleaning_v5_temperatures($items) {
    $items = strik_cleaning_v5_decode($items);
    $clean = array();

    if (!is_array($items)) return $clean;

    foreach (array_slice($items, 0, 200) as $item) {
        if (!is_array($item)) continue;

        $naam = isset($item['naam']) ? sanitize_text_field($item['naam']) : '';
        $temperatuur = isset($item['temperatuur']) ? sanitize_text_field($item['temperatuur']) : '';

        if (strik_cleaning_v5_is_photo_temperature_name($naam)) continue;
        if ($naam === '' || $temperatuur === '') continue;

        $clean[] = array(
            'id' => isset($item['id']) ? sanitize_text_field($item['id']) : uniqid('temp-', true),
            'naam' => $naam,
            'temperatuur' => $temperatuur,
        );
    }

    return $clean;
}

function strik_cleaning_v5_clean_photo_data_url($value, $max_bytes = STRIK_CLEANING_PHOTO_PREVIEW_MAX_BYTES) {
    if (!is_string($value) || $value === '') return '';
    if (strlen($value) > $max_bytes) return '';

    $value = trim($value);
    if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+\/=_-]+$/i', $value)) {
        return '';
    }

    return $value;
}

function strik_cleaning_v5_photo_upload($request) {
    $files = $request->get_file_params();

    if (!isset($files['file']) || !is_array($files['file'])) {
        return new WP_Error(
            'strik_cleaning_photo_missing',
            'Geen foto ontvangen.',
            array('status' => 400)
        );
    }

    $file = $files['file'];
    $error = isset($file['error']) ? absint($file['error']) : UPLOAD_ERR_OK;

    if ($error !== UPLOAD_ERR_OK) {
        return new WP_Error(
            'strik_cleaning_photo_upload_error',
            'Foto uploaden is mislukt.',
            array('status' => 400)
        );
    }

    $size = isset($file['size']) ? absint($file['size']) : 0;
    if ($size <= 0 || $size > STRIK_CLEANING_PHOTO_UPLOAD_MAX_BYTES) {
        return new WP_Error(
            'strik_cleaning_photo_too_large',
            'Foto is te groot om veilig op te slaan.',
            array('status' => 413)
        );
    }

    $mime = isset($file['type']) ? sanitize_mime_type($file['type']) : '';
    $allowed_mimes = array('image/jpeg', 'image/png', 'image/webp');

    if (!in_array($mime, $allowed_mimes, true)) {
        return new WP_Error(
            'strik_cleaning_photo_type',
            'Alleen jpg, png en webp foto’s zijn toegestaan.',
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
            'strik_cleaning_photo_save_failed',
            isset($upload['error']) ? $upload['error'] : 'Foto kon niet worden opgeslagen.',
            array('status' => 500)
        );
    }

    $label = sanitize_text_field((string) $request->get_param('label'));
    $winkel = sanitize_text_field((string) $request->get_param('winkel'));
    $datum = strik_cleaning_v5_clean_date((string) $request->get_param('datum'));
    $title_parts = array_filter(array($datum, $winkel, $label));
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

function strik_cleaning_v5_photos($items, $include_data_url = false) {
    $items = strik_cleaning_v5_decode($items);
    $clean = array();

    if (!is_array($items)) return $clean;

    foreach (array_slice($items, 0, 50) as $item) {
        if (!is_array($item)) continue;

        $photo = array(
            'id' => isset($item['id']) ? sanitize_text_field($item['id']) : uniqid('foto-', true),
            'label' => isset($item['label']) ? sanitize_text_field($item['label']) : '',
            'fileName' => isset($item['fileName']) ? sanitize_file_name($item['fileName']) : '',
            'url' => isset($item['url']) ? esc_url_raw($item['url']) : '',
            'mediaId' => isset($item['mediaId']) ? absint($item['mediaId']) : 0,
            'unavailable' => !empty($item['unavailable']),
        );

        if ($photo['unavailable']) {
            $photo['url'] = '';
            $photo['mediaId'] = 0;
        }

        if ($photo['url'] === '' && isset($item['dataUrl']) && is_string($item['dataUrl'])) {
            $max_bytes = $include_data_url ? 600000 : STRIK_CLEANING_PHOTO_PREVIEW_MAX_BYTES;
            $data_url = strik_cleaning_v5_clean_photo_data_url($item['dataUrl'], $max_bytes);
            if ($data_url !== '') $photo['dataUrl'] = $data_url;
        }

        $clean[] = $photo;
    }

    return $clean;
}

function strik_cleaning_v5_expire_photos($photos) {
    $expired = array();

    foreach ($photos as $photo) {
        if (!is_array($photo)) continue;

        $label = isset($photo['label']) ? sanitize_text_field($photo['label']) : '';
        $file_name = isset($photo['fileName']) ? sanitize_file_name($photo['fileName']) : '';

        if ($label === '' && $file_name === '') continue;

        $expired[] = array(
            'id' => isset($photo['id']) ? sanitize_text_field($photo['id']) : uniqid('foto-', true),
            'label' => $label,
            'fileName' => $file_name,
            'url' => '',
            'mediaId' => 0,
            'unavailable' => true,
        );
    }

    return $expired;
}

function strik_cleaning_v5_option_items() {
    $stats = strik_cleaning_v5_option_storage_stats();
    if ($stats['exists'] && $stats['bytes'] > STRIK_CLEANING_OPTION_MAX_BYTES) {
        strik_cleaning_v5_archive_option_storage('too_large');
        return array();
    }

    $items = get_option(STRIK_CLEANING_OPTION_NAME, array());

    if (!is_array($items)) return array();
    if (isset($items['items']) && is_array($items['items'])) $items = $items['items'];

    return array_values(array_filter($items, 'is_array'));
}

function strik_cleaning_v5_find_post_ids() {
    global $wpdb;

    $needle = '%' . $wpdb->esc_like('ijsloket') . '%';

    return $wpdb->get_col(
        $wpdb->prepare(
            "SELECT ID
             FROM {$wpdb->posts}
             WHERE post_status NOT IN ('trash', 'auto-draft', 'inherit')
             AND (post_title LIKE %s OR post_content LIKE %s)
             ORDER BY post_date_gmt DESC, ID DESC
             LIMIT 1500",
            $needle,
            $needle
        )
    );
}

function strik_cleaning_v5_found_post_types() {
    global $wpdb;

    $needle = '%' . $wpdb->esc_like('ijsloket') . '%';

    return $wpdb->get_results(
        $wpdb->prepare(
            "SELECT post_type, COUNT(*) AS total
             FROM {$wpdb->posts}
             WHERE post_status NOT IN ('trash', 'auto-draft', 'inherit')
             AND (post_title LIKE %s OR post_content LIKE %s)
             GROUP BY post_type
             ORDER BY total DESC",
            $needle,
            $needle
        ),
        ARRAY_A
    );
}

function strik_cleaning_v5_post_to_item($post, $include_data_url = false) {
    $title = strik_cleaning_v5_parse_title($post->post_title);
    $data = strik_cleaning_v5_content_data($post);

    $datum = strik_cleaning_v5_meta($post->ID, array('datum', '_datum'), '');
    if ($datum === '') $datum = strik_cleaning_v5_value($data, array('datum', 'date'), $title['datum']);

    $winkel = strik_cleaning_v5_meta($post->ID, array('winkel', '_winkel'), '');
    if ($winkel === '') $winkel = strik_cleaning_v5_value($data, array('winkel', 'shop'), $title['winkel']);

    $naam = strik_cleaning_v5_meta($post->ID, array('naam', '_naam'), '');
    if ($naam === '') $naam = strik_cleaning_v5_value($data, array('naam', 'name'), $title['naam']);

    $titel = strik_cleaning_v5_meta($post->ID, array('titel', '_titel', 'planType', 'plan_type'), '');
    if ($titel === '') $titel = strik_cleaning_v5_value($data, array('titel', 'planType', 'plan_type'), '');

    $taken = strik_cleaning_v5_meta($post->ID, array('taken', '_taken', 'tasks'), array());
    if (empty($taken)) $taken = strik_cleaning_v5_value($data, array('taken', 'tasks'), array());

    $opmerking = strik_cleaning_v5_meta($post->ID, array('opmerking', '_opmerking', 'comment'), '');
    if ($opmerking === '') $opmerking = strik_cleaning_v5_value($data, array('opmerking', 'comment'), '');

    $temperaturen = strik_cleaning_v5_meta($post->ID, array('temperatuurRegistraties', '_temperatuurRegistraties', 'temperaturen'), array());
    if (empty($temperaturen)) $temperaturen = strik_cleaning_v5_value($data, array('temperatuurRegistraties', 'temperaturen'), array());

    $fotos = strik_cleaning_v5_meta($post->ID, array('fotoUploads', '_fotoUploads', 'foto_uploads'), array());
    if (empty($fotos)) $fotos = strik_cleaning_v5_value($data, array('fotoUploads', 'foto_uploads'), array());

    return array(
        'id' => absint($post->ID),
        'titel' => sanitize_text_field((string) $titel),
        'winkel' => sanitize_text_field((string) $winkel),
        'naam' => sanitize_text_field((string) $naam),
        'datum' => strik_cleaning_v5_clean_date($datum),
        'taken' => strik_cleaning_v5_text_array($taken),
        'opmerking' => sanitize_textarea_field((string) $opmerking),
        'temperatuurRegistraties' => strik_cleaning_v5_temperatures($temperaturen),
        'fotoUploads' => strik_cleaning_v5_photos($fotos, $include_data_url),
        'createdAt' => get_post_time(DATE_ATOM, true, $post),
        'source' => 'wordpress-post',
    );
}

function strik_cleaning_v5_normalize_option_item($item, $include_data_url = false) {
    $datum = isset($item['datum']) ? strik_cleaning_v5_clean_date($item['datum']) : '';
    $photos = strik_cleaning_v5_photos(isset($item['fotoUploads']) ? $item['fotoUploads'] : array(), $include_data_url);

    if (strik_cleaning_v5_date_is_past_photo_retention($datum)) {
        $photos = strik_cleaning_v5_expire_photos($photos);
    }

    return array(
        'id' => isset($item['id']) ? absint($item['id']) : 0,
        'titel' => isset($item['titel']) ? sanitize_text_field($item['titel']) : '',
        'winkel' => isset($item['winkel']) ? sanitize_text_field($item['winkel']) : '',
        'naam' => isset($item['naam']) ? sanitize_text_field($item['naam']) : '',
        'datum' => $datum,
        'taken' => strik_cleaning_v5_text_array(isset($item['taken']) ? $item['taken'] : array()),
        'opmerking' => isset($item['opmerking']) ? sanitize_textarea_field($item['opmerking']) : '',
        'temperatuurRegistraties' => strik_cleaning_v5_temperatures(isset($item['temperatuurRegistraties']) ? $item['temperatuurRegistraties'] : array()),
        'fotoUploads' => $photos,
        'createdAt' => isset($item['createdAt']) ? sanitize_text_field($item['createdAt']) : '',
        'source' => 'option',
    );
}

function strik_cleaning_v5_item_has_inline_photo_data($item) {
    if (!is_array($item)) return true;

    if (isset($item['fotoUploads']) && is_array($item['fotoUploads'])) {
        $datum = isset($item['datum']) ? strik_cleaning_v5_clean_date($item['datum']) : '';

        foreach ($item['fotoUploads'] as $photo) {
            if (is_array($photo) && isset($photo['dataUrl']) && is_string($photo['dataUrl']) && $photo['dataUrl'] !== '') {
                if (strik_cleaning_v5_clean_photo_data_url($photo['dataUrl']) === '') {
                    return true;
                }
            }

            if (
                strik_cleaning_v5_date_is_past_photo_retention($datum) &&
                is_array($photo) &&
                (
                    !empty($photo['url']) ||
                    !isset($photo['unavailable']) ||
                    empty($photo['unavailable'])
                )
            ) {
                return true;
            }
        }
    }

    if (isset($item['taken']) && is_array($item['taken'])) {
        foreach ($item['taken'] as $taak) {
            if (strik_cleaning_v5_is_photo_marker($taak)) return true;
        }
    }

    if (isset($item['temperatuurRegistraties']) && is_array($item['temperatuurRegistraties'])) {
        foreach ($item['temperatuurRegistraties'] as $registratie) {
            if (!is_array($registratie)) continue;
            $naam = isset($registratie['naam']) ? (string) $registratie['naam'] : '';
            $temperatuur = isset($registratie['temperatuur']) ? (string) $registratie['temperatuur'] : '';

            if (strik_cleaning_v5_is_photo_temperature_name($naam) || strpos($temperatuur, 'data:image/') !== false) {
                return true;
            }
        }
    }

    return false;
}

function strik_cleaning_v5_repair_option_items($items) {
    $changed = false;
    $cleaned = array();

    foreach ($items as $item) {
        if (!is_array($item)) {
            $changed = true;
            continue;
        }

        if (strik_cleaning_v5_item_has_inline_photo_data($item)) {
            $changed = true;
        }

        $clean = strik_cleaning_v5_normalize_option_item($item, false);
        if ($clean['datum'] === '' || $clean['winkel'] === '') {
            $changed = true;
            continue;
        }

        $cleaned[] = $clean;
    }

    if ($changed) {
        update_option(STRIK_CLEANING_OPTION_NAME, array_values($cleaned), false);
    }

    return $cleaned;
}

function strik_cleaning_v5_import_archive($archive_name = '', $filters = array()) {
    $archives = strik_cleaning_v5_archive_options();
    $start_date = isset($filters['startDate']) ? strik_cleaning_v5_clean_date($filters['startDate']) : '';
    $end_date = isset($filters['endDate']) ? strik_cleaning_v5_clean_date($filters['endDate']) : '';
    $include_photos = isset($filters['includePhotos']) ? (bool) $filters['includePhotos'] : true;

    if ($archive_name === '' && !empty($archives[0]['name'])) {
        $archive_name = $archives[0]['name'];
    }

    if (!strik_cleaning_v5_is_archive_option_name($archive_name)) {
        return new WP_Error(
            'strik_cleaning_archive_invalid',
            'Geen geldig schoonmaakarchief gekozen.',
            array('status' => 400)
        );
    }

    $archive_items = get_option($archive_name, array());
    if (!is_array($archive_items)) {
        return new WP_Error(
            'strik_cleaning_archive_unreadable',
            'Dit schoonmaakarchief kan niet als lijst worden gelezen.',
            array('status' => 500)
        );
    }

    if (isset($archive_items['items']) && is_array($archive_items['items'])) {
        $archive_items = $archive_items['items'];
    }

    $active_items = strik_cleaning_v5_repair_option_items(strik_cleaning_v5_option_items());
    $max_id = 0;
    $seen = array();

    foreach ($active_items as $item) {
        if (isset($item['id'])) $max_id = max($max_id, absint($item['id']));

        $seen[] = implode('|', array(
            isset($item['datum']) ? $item['datum'] : '',
            isset($item['winkel']) ? $item['winkel'] : '',
            isset($item['titel']) ? $item['titel'] : '',
            isset($item['naam']) ? $item['naam'] : '',
            isset($item['createdAt']) ? $item['createdAt'] : '',
        ));
    }

    $seen = array_flip($seen);
    $imported = 0;

    foreach ($archive_items as $item) {
        if (!is_array($item)) continue;

        $clean = strik_cleaning_v5_normalize_option_item($item, false);
        if ($clean['datum'] === '' || $clean['winkel'] === '') continue;
        if ($start_date !== '' && strcmp($clean['datum'], $start_date) < 0) continue;
        if ($end_date !== '' && strcmp($clean['datum'], $end_date) > 0) continue;

        if (!$include_photos) {
            $clean['fotoUploads'] = array();
        }

        $key = implode('|', array(
            $clean['datum'],
            $clean['winkel'],
            $clean['titel'],
            $clean['naam'],
            $clean['createdAt'],
        ));

        if (isset($seen[$key])) continue;

        $max_id += 1;
        $clean['id'] = $max_id;
        $active_items[] = $clean;
        $seen[$key] = true;
        $imported += 1;
    }

    if (count($active_items) > 1500) {
        $active_items = array_slice($active_items, -1500);
    }

    update_option(STRIK_CLEANING_OPTION_NAME, array_values($active_items), false);

    return array(
        'archiveName' => $archive_name,
        'imported' => $imported,
        'totalActive' => count($active_items),
        'startDate' => $start_date,
        'endDate' => $end_date,
        'includePhotos' => $include_photos,
        'message' => 'Schoonmaakarchief is opgeschoond teruggezet in de actieve lijst.',
    );
}

function strik_cleaning_v5_get_items($include_legacy_posts = false, $include_data_url = false) {
    $items = array();
    $option_items = strik_cleaning_v5_option_items();

    if (!$include_data_url) {
        $option_items = strik_cleaning_v5_repair_option_items($option_items);
    }

    foreach ($option_items as $item) {
        $clean = strik_cleaning_v5_normalize_option_item($item, $include_data_url);
        if ($clean['datum'] !== '' && $clean['winkel'] !== '') $items[] = $clean;
    }

    if (!$include_legacy_posts) {
        return $items;
    }

    foreach (strik_cleaning_v5_find_post_ids() as $post_id) {
        $post = get_post(absint($post_id));
        if (!$post) continue;

        $clean = strik_cleaning_v5_post_to_item($post, $include_data_url);
        if ($clean['datum'] !== '' && $clean['winkel'] !== '') $items[] = $clean;
    }

    return $items;
}

function strik_cleaning_v5_get($request) {
    if ((string) $request->get_param('health') === '1') {
        return rest_ensure_response(strik_cleaning_v5_option_storage_stats());
    }

    if ((string) $request->get_param('archive') === 'list') {
        return rest_ensure_response(strik_cleaning_v5_archive_options());
    }

    if ((string) $request->get_param('archive') === 'import') {
        return rest_ensure_response(
            strik_cleaning_v5_import_archive((string) $request->get_param('archiveName'))
        );
    }

    if ((string) $request->get_param('archive') === 'import-week') {
        $range = strik_cleaning_v5_week_range((string) $request->get_param('date'));

        return rest_ensure_response(
            strik_cleaning_v5_import_archive(
                (string) $request->get_param('archiveName'),
                array(
                    'startDate' => $range['startDate'],
                    'endDate' => $range['endDate'],
                    'includePhotos' => false,
                )
            )
        );
    }

    if ((string) $request->get_param('repair') === 'archive') {
        return rest_ensure_response(strik_cleaning_v5_archive_option_storage('manual'));
    }

    $include_legacy_posts = (string) $request->get_param('legacy') === '1';
    $include_data_url = (string) $request->get_param('includeDataUrl') === '1';

    return rest_ensure_response(strik_cleaning_v5_get_items($include_legacy_posts, $include_data_url));
}

function strik_cleaning_v5_save($request) {
    $params = $request->get_json_params();
    if (!is_array($params)) $params = array();

    $items = strik_cleaning_v5_repair_option_items(strik_cleaning_v5_option_items());
    $max_id = 0;

    foreach ($items as $item) {
        if (isset($item['id'])) $max_id = max($max_id, absint($item['id']));
    }

    $new_item = array(
        'id' => $max_id + 1,
        'titel' => isset($params['titel']) ? sanitize_text_field($params['titel']) : 'Schoonmaak',
        'winkel' => isset($params['winkel']) ? sanitize_text_field($params['winkel']) : '',
        'naam' => isset($params['naam']) ? sanitize_text_field($params['naam']) : '',
        'datum' => isset($params['datum']) && strik_cleaning_v5_clean_date($params['datum']) !== '' ? strik_cleaning_v5_clean_date($params['datum']) : wp_date('Y-m-d'),
        'taken' => strik_cleaning_v5_text_array(isset($params['taken']) ? $params['taken'] : array()),
        'opmerking' => isset($params['opmerking']) ? sanitize_textarea_field($params['opmerking']) : '',
        'temperatuurRegistraties' => strik_cleaning_v5_temperatures(isset($params['temperatuurRegistraties']) ? $params['temperatuurRegistraties'] : array()),
        'fotoUploads' => strik_cleaning_v5_photos(isset($params['fotoUploads']) ? $params['fotoUploads'] : array(), false),
        'createdAt' => wp_date(DATE_ATOM),
    );

    if (strik_cleaning_v5_date_is_past_photo_retention($new_item['datum'])) {
        $new_item['fotoUploads'] = strik_cleaning_v5_expire_photos($new_item['fotoUploads']);
    }

    $items[] = $new_item;
    if (count($items) > 1500) $items = array_slice($items, -1500);

    update_option(STRIK_CLEANING_OPTION_NAME, array_values($items), false);

    return rest_ensure_response($new_item);
}

add_action('rest_api_init', function () {
    register_rest_route('strik/v1', '/cleaning', array(
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'strik_cleaning_v5_get',
            'permission_callback' => 'strik_cleaning_v5_permission',
        ),
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_cleaning_v5_save',
            'permission_callback' => 'strik_cleaning_v5_permission',
        ),
    ), true);

    register_rest_route('strik/v1', '/cleaning-photo', array(
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'strik_cleaning_v5_photo_upload',
            'permission_callback' => 'strik_cleaning_v5_permission',
        ),
    ), true);
});

function strik_cleaning_v5_admin_menu() {
    add_menu_page(
        'Schoonmaaklijsten',
        'Schoonmaaklijsten',
        'manage_options',
        'strik-schoonmaaklijsten',
        'strik_cleaning_v5_admin_page',
        'dashicons-clipboard',
        25
    );
}

add_action('admin_menu', 'strik_cleaning_v5_admin_menu');

function strik_cleaning_v5_admin_page() {
    if (!current_user_can('manage_options')) wp_die('Geen toegang.');

    $items = strik_cleaning_v5_get_items();
    $post_types = strik_cleaning_v5_found_post_types();

    usort($items, function ($a, $b) {
        return strcmp(isset($b['datum']) ? $b['datum'] : '', isset($a['datum']) ? $a['datum'] : '');
    });

    echo '<div class="wrap">';
    echo '<h1>Schoonmaaklijsten</h1>';
    echo '<p>Gevonden registraties: <strong>' . esc_html(count($items)) . '</strong></p>';

    echo '<p><strong>Gevonden WordPress post types met ijsloket-data:</strong> ';
    if (empty($post_types)) {
        echo 'geen';
    } else {
        foreach ($post_types as $row) {
            echo '<code>' . esc_html($row['post_type']) . ': ' . esc_html($row['total']) . '</code> ';
        }
    }
    echo '</p>';

    if (empty($items)) {
        echo '<div class="notice notice-warning"><p>Nog geen oude registraties gevonden. Dan staat de oude data waarschijnlijk onder een andere titel/zoekterm dan <code>ijsloket</code>.</p></div>';
        echo '</div>';
        return;
    }

    echo '<table class="widefat striped">';
    echo '<thead><tr><th>Datum</th><th>Winkel</th><th>Naam</th><th>Type</th><th>Bron</th><th>Taken</th><th>Details</th></tr></thead><tbody>';

    foreach ($items as $item) {
        $taken = isset($item['taken']) && is_array($item['taken']) ? $item['taken'] : array();
        $temps = isset($item['temperatuurRegistraties']) && is_array($item['temperatuurRegistraties']) ? $item['temperatuurRegistraties'] : array();

        echo '<tr>';
        echo '<td>' . esc_html($item['datum']) . '</td>';
        echo '<td>' . esc_html($item['winkel']) . '</td>';
        echo '<td>' . esc_html($item['naam']) . '</td>';
        echo '<td>' . esc_html($item['titel']) . '</td>';
        echo '<td>' . esc_html($item['source']) . '</td>';
        echo '<td>' . esc_html(count($taken)) . '</td>';
        echo '<td><details><summary>Bekijk</summary>';

        if (!empty($taken)) {
            echo '<p><strong>Taken:</strong></p><ul>';
            foreach ($taken as $taak) echo '<li>' . esc_html($taak) . '</li>';
            echo '</ul>';
        }

        if (!empty($temps)) {
            echo '<p><strong>Temperaturen:</strong></p><ul>';
            foreach ($temps as $temp) {
                echo '<li>' . esc_html($temp['naam'] . ': ' . $temp['temperatuur'] . ' °C') . '</li>';
            }
            echo '</ul>';
        }

        if (!empty($item['opmerking'])) {
            echo '<p><strong>Opmerking:</strong><br>' . nl2br(esc_html($item['opmerking'])) . '</p>';
        }

        echo '</details></td>';
        echo '</tr>';
    }

    echo '</tbody></table>';
    echo '</div>';
}
