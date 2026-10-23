<?php
/**
 * Strik Zakelijk — publish the approved app design at the existing website URL.
 * Install as a PHP Code Snippet, run everywhere. Deactivate to restore the
 * original WordPress page, which remains available as an upstream fallback.
 * No visitor cookies, authorization, query strings or contact data are sent.
 */
if (!defined('ABSPATH')) exit;

function strik_business_website_route($uri) {
    $path = parse_url($uri, PHP_URL_PATH);
    return is_string($path) && rtrim($path, '/') === '/zakelijk';
}

function strik_business_website_asset($uri) {
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path) || strpos($path, '..') !== false || strpos($path, '%') !== false) return null;
    if (!preg_match('~^/_next/static/[a-zA-Z0-9_./\[\]()-]+\.(?:js|css|woff2?|ttf|otf)$~D', $path)) return null;
    return 'https://app.strik-patisserie.nl' . $path;
}

function strik_business_website_document() {
    $key = 'strik_business_website_v1';
    $cached = get_transient($key);
    if (is_string($cached) && $cached !== '') return $cached;
    $response = wp_remote_get('https://app.strik-patisserie.nl/zakelijk', array(
        'timeout' => 15,
        'redirection' => 0,
        'sslverify' => true,
        'limit_response_size' => 2 * 1024 * 1024,
        'headers' => array('Accept' => 'text/html', 'X-Strik-Business-Page' => 'business'),
        'cookies' => array(),
    ));
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) return null;
    $html = wp_remote_retrieve_body($response);
    $type = wp_remote_retrieve_header($response, 'content-type');
    if (stripos($type, 'text/html') === false || strpos($html, 'data-strik-business-site="business"') === false) return null;
    $html = str_replace(
        array('src="/_next/', 'href="/_next/'),
        array('src="https://app.strik-patisserie.nl/_next/', 'href="https://app.strik-patisserie.nl/_next/'),
        $html
    );
    set_transient($key, $html, 30);
    return $html;
}

add_action('init', function () {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) return;
    $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    $route = strik_business_website_route($uri);
    $asset = strik_business_website_asset($uri);
    if (!$route && !$asset) return;
    $method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        status_header(405); header('Allow: GET, HEAD'); exit;
    }
    if ($asset) {
        header('Cache-Control: public, max-age=86400');
        wp_redirect($asset, 302, 'Strik public website assets'); exit;
    }
    $html = strik_business_website_document();
    // A failed deployment must not make the business page unavailable.
    if ($html === null) return;
    nocache_headers();
    status_header(200);
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    if ($method !== 'HEAD') echo $html;
    exit;
}, -99);
