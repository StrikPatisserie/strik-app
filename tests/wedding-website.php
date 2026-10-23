<?php
define('ABSPATH', __DIR__);
$cache = array(); $remote = array(); $calls = array();
$filters = array();
function add_action() {}
function add_filter($name, $callback) { global $filters; $filters[$name] = $callback; }
function get_transient($key) { global $cache; return isset($cache[$key]) ? $cache[$key] : false; }
function set_transient($key, $value, $ttl) { global $cache; assert_same(30, $ttl); $cache[$key] = $value; }
function wp_remote_get($url, $args) { global $calls, $remote; $calls[] = array($url, $args); return $remote; }
function is_wp_error($result) { return false; }
function wp_remote_retrieve_response_code($result) { return $result['status']; }
function wp_remote_retrieve_body($result) { return $result['body']; }
function wp_remote_retrieve_header($result, $name) { return $result['type']; }
function assert_same($a, $b) { if ($a !== $b) throw new Exception('Assertion failed: ' . var_export(array($a, $b), true)); }
require __DIR__ . '/../app/wordpress-snippets/strik-wedding-website.php';
foreach (array('/bruidstaarten', '/bruidstaarten/', '/bruidstaarten?strik-wedding-preview=1&ignored=value') as $path) {
    assert_same('/bruidstaart', strik_wedding_website_route($path)['source']);
}
assert_same('/bruidstaart/afspraak', strik_wedding_website_route('/bruidstaarten/afspraak/')['source']);
assert_same('/bruidstaarten', strik_wedding_website_route('/bruiloften/')['redirect']);
foreach (array('/bruidstaarten/agenda', '/api/wedding-appointments/manage', '/wp-admin/', '/bruidstaarten/../management', '/bruidstaarten%2fafspraak') as $path) assert_same(null, strik_wedding_website_route($path));
assert_same('https://app.strik-patisserie.nl/_next/static/chunks/app/bruidstaart/page-abc123.js', strik_wedding_website_asset('/_next/static/chunks/app/bruidstaart/page-abc123.js?ignored=1'));
foreach (array('/_next/server/app.js', '/_next/static/../server/app.js', '/_next/static/chunks/a.js.map', '/_next/static/%2e%2e/server.js', '/api/app-version', '/_next/static//attacker.example/file.php') as $path) assert_same(null, strik_wedding_website_asset($path));
echo "Public routes and asset allowlist passed.\n";
assert_same(true, strik_wedding_website_route('/bruidstaarten-sitemap.xml')['sitemap']);
assert_same(2, substr_count(strik_wedding_website_sitemap(), '<url>'));
assert_same(true, strpos($filters['wpseo_sitemap_index']('existing'), 'bruidstaarten-sitemap.xml') !== false);
assert_same(false, $filters['wpseo_sitemap_entry'](array('loc'=>'https://strik-patisserie.nl/bruiloften/')));
assert_same(array('loc'=>'https://strik-patisserie.nl/contact/'), $filters['wpseo_sitemap_entry'](array('loc'=>'https://strik-patisserie.nl/contact/')));
$robots = $filters['robots_txt']("User-agent: *\nDisallow: /wp-admin/\n", true);
assert_same(2, substr_count($robots, 'Sitemap:'));
assert_same($robots, $filters['robots_txt']($robots, true));
assert_same('unchanged', $filters['robots_txt']('unchanged', false));
echo "Sitemap entries, canonical destinations and robots discovery passed.\n";
$route = strik_wedding_website_route('/bruidstaarten?private=never-forward');
$html = '<html><head><link href="/_next/static/styles.css"></head><body data-strik-wedding-site="inspiration"><script src="/_next/static/page.js"></script><a href="#voorbeelden">Voorbeelden</a></body></html>';
$remote = array('status'=>200,'type'=>'text/html; charset=utf-8','body'=>$html);
$output = strik_wedding_website_document($route);
assert_same(true, strpos($output, 'href="https://app.strik-patisserie.nl/_next/static/styles.css"') !== false);
assert_same(true, strpos($output, 'src="https://app.strik-patisserie.nl/_next/static/page.js"') !== false);
assert_same(true, strpos($output, 'href="#voorbeelden"') !== false);
assert_same('https://app.strik-patisserie.nl/bruidstaart', $calls[0][0]);
assert_same(array(), $calls[0][1]['cookies']);
assert_same(array('Accept'=>'text/html','X-Strik-Wedding-Page'=>'inspiration'), $calls[0][1]['headers']);
assert_same(true, $calls[0][1]['sslverify']);
assert_same(0, $calls[0][1]['redirection']);
assert_same($output, strik_wedding_website_document($route));
assert_same(1, count($calls));
echo "Anonymous HTML, absolute assets and short cache passed.\n";
foreach (array(array('status'=>302,'type'=>'text/html','body'=>$html),array('status'=>200,'type'=>'application/json','body'=>$html),array('status'=>200,'type'=>'text/html','body'=>'Login or old version')) as $response) {
    $cache=array(); $remote=$response;
    assert_same(null, strik_wedding_website_document($route));
}
echo "Upstream redirect, wrong document and missing deployment marker rejected.\nAll wedding website tests passed.\n";
