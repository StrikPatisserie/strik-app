<?php
/**
 * Strik bruidstaarten — public website documents from the existing app.
 * Install as a PHP Code Snippet, run everywhere. No WordPress theme changes.
 * Only two anonymous HTML documents are fetched. No cookies, authorization,
 * visitor query strings or booking/contact data are forwarded by WordPress.
 */
if (!defined('ABSPATH')) exit;

// Set true after verifying both ?strik-wedding-preview=1 pages as an admin.
if (!defined('STRIK_WEDDING_WEBSITE_LIVE')) define('STRIK_WEDDING_WEBSITE_LIVE', false);

function strik_wedding_website_route($uri) {
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path)) return null;
    $path = rtrim($path, '/');
    $routes = array(
        '/bruidstaarten' => array('page' => 'inspiration', 'source' => '/bruidstaart'),
        '/bruidstaarten/afspraak' => array('page' => 'appointment', 'source' => '/bruidstaart/afspraak'),
        '/bruiloften' => array('redirect' => '/bruidstaarten'),
        '/afspraakbruidstaart' => array('redirect' => '/bruidstaarten/afspraak'),
    );
    return isset($routes[$path]) ? $routes[$path] : null;
}

function strik_wedding_website_asset($uri) {
    $path = parse_url($uri, PHP_URL_PATH);
    // Only immutable, public client assets. No API, server files or arbitrary
    // upstream destination can be requested through this bridge.
    if (!is_string($path) || strpos($path, '..') !== false) return null;
    if (!preg_match('~^/_next/static/[a-zA-Z0-9_./%\[\]()-]+\.(?:js|css|woff2?|ttf|otf)$~D', $path)) return null;
    if (strpos($path, '%') !== false) return null;
    return 'https://app.strik-patisserie.nl' . $path;
}

function strik_wedding_website_html($html) {
    // Initial assets load directly from Vercel, keeping fonts/CSS URLs correct.
    // Next can discover further public chunks while hydrating; the narrow
    // asset redirect above covers those without proxying app/API requests.
    return str_replace(
        array('src="/_next/', 'href="/_next/'),
        array('src="https://app.strik-patisserie.nl/_next/', 'href="https://app.strik-patisserie.nl/_next/'),
        $html
    );
}

function strik_wedding_website_document($route) {
    $key = 'strik_wedding_website_v1_' . $route['page'];
    $cached = get_transient($key);
    if (is_string($cached) && $cached !== '') return $cached;
    $response = wp_remote_get('https://app.strik-patisserie.nl' . $route['source'], array(
        'timeout' => 15,
        'redirection' => 0,
        'sslverify' => true,
        'limit_response_size' => 2 * 1024 * 1024,
        'headers' => array('Accept' => 'text/html', 'X-Strik-Wedding-Page' => $route['page']),
        'cookies' => array(),
    ));
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) return null;
    $html = wp_remote_retrieve_body($response);
    $type = wp_remote_retrieve_header($response, 'content-type');
    if (stripos($type, 'text/html') === false || strpos($html, 'data-strik-wedding-site="' . $route['page'] . '"') === false) return null;
    $html = strik_wedding_website_html($html);
    set_transient($key, $html, 30);
    return $html;
}

add_action('init', function () {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) return;
    $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    $route = strik_wedding_website_route($uri);
    $asset = strik_wedding_website_asset($uri);
    if (!$route && !$asset) return;
    $preview = isset($_GET['strik-wedding-preview']) && $_GET['strik-wedding-preview'] === '1' && current_user_can('manage_options');
    if (!STRIK_WEDDING_WEBSITE_LIVE && !$preview && !$asset) return;
    $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        status_header(405); header('Allow: GET, HEAD'); exit;
    }
    if ($asset) {
        header('Cache-Control: public, max-age=86400');
        wp_redirect($asset, 302, 'Strik public wedding assets'); exit;
    }
    if (isset($route['redirect'])) {
        wp_safe_redirect(home_url($route['redirect']), 301, 'Strik bruidstaarten'); exit;
    }
    $html = strik_wedding_website_document($route);
    nocache_headers();
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    if ($html === null) {
        status_header(503); header('Retry-After: 60');
        if ($method !== 'HEAD') echo '<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bruidstaarten · Strik Patisserie</title><body style="margin:0;background:#faf8f5;color:#30392f;font-family:Georgia,serif"><main style="max-width:620px;margin:15vh auto;padding:24px"><h1>Bruidstaarten bij Strik</h1><p>Deze pagina kan even niet geladen worden. Jullie kunnen hieronder verder.</p><p><a href="' . esc_url('https://app.strik-patisserie.nl' . $route['source']) . '">Ga verder naar onze bruidstaartpagina →</a></p><p>Vragen? <a href="mailto:info@strik-patisserie.nl">Mail de bakkerij</a>.</p></main></body></html>';
        exit;
    }
    status_header(200);
    if ($preview) header('X-Robots-Tag: noindex, nofollow');
    if ($method !== 'HEAD') echo $html;
    exit;
}, -100);
