<?php
define('ABSPATH', __DIR__);
$cache = array(); $remote = array(); $calls = array();
function add_action() {}
function get_transient($key) { global $cache; return isset($cache[$key]) ? $cache[$key] : false; }
function set_transient($key, $value, $ttl) { global $cache; same(30, $ttl); $cache[$key] = $value; }
function wp_remote_get($url, $args) { global $calls, $remote; $calls[] = array($url, $args); return $remote; }
function is_wp_error($result) { return false; }
function wp_remote_retrieve_response_code($result) { return $result['status']; }
function wp_remote_retrieve_body($result) { return $result['body']; }
function wp_remote_retrieve_header($result, $name) { return $result['type']; }
function same($a, $b) { if ($a !== $b) throw new Exception('Mismatch: ' . var_export(array($a, $b), true)); }
require __DIR__ . '/../app/wordpress-snippets/strik-business-website.php';

foreach (array('/zakelijk', '/zakelijk/', '/zakelijk/?private=never-forward') as $path) same(true, strik_business_website_route($path));
foreach (array('/zakelijk/voorbeeld', '/zakelijk/api', '/api/business-folder-quote', '/wp-admin/', '/zakelijk/../management', '/zakelijk%2f') as $path) same(false, strik_business_website_route($path));
same('https://app.strik-patisserie.nl/_next/static/chunks/app/zakelijk/page-abc123.js', strik_business_website_asset('/_next/static/chunks/app/zakelijk/page-abc123.js?ignored=1'));
foreach (array('/_next/server/app.js', '/_next/static/../server/app.js', '/_next/static/chunks/a.js.map', '/_next/static/%2e%2e/server.js', '/api/app-version') as $path) same(null, strik_business_website_asset($path));

$html = '<html><head><link href="/_next/static/styles.css"></head><body data-strik-business-site="business"><script src="/_next/static/page.js"></script><a href="#contact">Contact</a></body></html>';
$remote = array('status'=>200,'type'=>'text/html; charset=utf-8','body'=>$html);
$output = strik_business_website_document();
same(true, strpos($output, 'href="https://app.strik-patisserie.nl/_next/static/styles.css"') !== false);
same(true, strpos($output, 'src="https://app.strik-patisserie.nl/_next/static/page.js"') !== false);
same(true, strpos($output, 'href="#contact"') !== false);
same('https://app.strik-patisserie.nl/zakelijk', $calls[0][0]);
same(array(), $calls[0][1]['cookies']);
same(array('Accept'=>'text/html','X-Strik-Business-Page'=>'business'), $calls[0][1]['headers']);
same(true, $calls[0][1]['sslverify']);
same(0, $calls[0][1]['redirection']);
same($output, strik_business_website_document());
same(1, count($calls));
foreach (array(array('status'=>302,'type'=>'text/html','body'=>$html),array('status'=>200,'type'=>'application/json','body'=>$html),array('status'=>200,'type'=>'text/html','body'=>'Login or old version')) as $response) {
    $cache=array(); $remote=$response;
    same(null, strik_business_website_document());
}
echo "Business route, public assets, anonymous HTML, cache and upstream fallback checks passed.\n";
