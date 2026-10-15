<?php
/**
 * Strik recipe access guard — install alongside the existing recipes API snippet.
 * Uses the PUBLIC Supabase publishable key (not a secret/service-role key).
 * Validates each bearer session with Supabase and reads the current profile.
 * Shared legacy WordPress keys alone no longer authorize recipe access.
 */
if (function_exists('strik_recipe_guard_identity')) return;

function strik_recipe_guard_identity($request) {
    static $identities = array();
    $token = (string) $request->get_header('x-strik-user-token');
    if (!$token || strlen($token) > 8192) return new WP_Error('strik_login_required', 'Een geldige Strik-login is vereist.', array('status' => 401));
    $key = hash('sha256', $token);
    if (isset($identities[$key])) return $identities[$key];
    $url = 'https://ckzrajbflscdheaxhjbs.supabase.co';
    $headers = array('apikey' => 'sb_publishable_0PsyqzFFo3kLgD8kj1HHjg_e3H0Tqg1', 'Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json');
    $user_result = wp_remote_get($url . '/auth/v1/user', array('headers' => $headers, 'timeout' => 10, 'redirection' => 0));
    if (is_wp_error($user_result) || wp_remote_retrieve_response_code($user_result) !== 200) return new WP_Error('strik_invalid_login', 'De Strik-sessie is niet geldig.', array('status' => 401));
    $user = json_decode(wp_remote_retrieve_body($user_result), true);
    if (empty($user['id']) || !preg_match('/^[a-f0-9-]{36}$/i', $user['id'])) return new WP_Error('strik_invalid_login', 'De Strik-sessie is niet geldig.', array('status' => 401));
    $parts = explode('.', $token);
    $claims = count($parts) === 3 ? json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true) : null;
    if (!is_array($claims) || ($claims['sub'] ?? '') !== $user['id'] || ($claims['iss'] ?? '') !== $url . '/auth/v1') return new WP_Error('strik_invalid_login', 'De Strik-sessie is niet geldig.', array('status' => 401));
    $profile_result = wp_remote_get($url . '/rest/v1/profiles?id=eq.' . rawurlencode($user['id']) . '&select=role,active,permissions', array('headers' => $headers, 'timeout' => 10, 'redirection' => 0));
    if (is_wp_error($profile_result) || wp_remote_retrieve_response_code($profile_result) !== 200) return new WP_Error('strik_profile_unavailable', 'Toegangsrechten konden niet worden gecontroleerd.', array('status' => 403));
    $profiles = json_decode(wp_remote_retrieve_body($profile_result), true);
    $profile = is_array($profiles) && count($profiles) === 1 ? $profiles[0] : null;
    if (!$profile || empty($profile['active'])) return new WP_Error('strik_inactive', 'Geen actief Strik-account.', array('status' => 403));
    $manager = in_array($profile['role'], array('admin', 'manager', 'management'), true);
    if ($manager && ($claims['aal'] ?? '') !== 'aal2') return new WP_Error('strik_mfa_required', 'Tweestapsverificatie is vereist.', array('status' => 403));
    $permissions = is_array($profile['permissions'] ?? null) ? $profile['permissions'] : array();
    if (!$manager && $profile['role'] !== 'bakkerij' && empty($permissions['bakkerij.view'])) return new WP_Error('strik_recipe_forbidden', 'Geen toegang tot recepturen.', array('status' => 403));
    $identity = array('manager' => $manager);
    $identities[$key] = $identity;
    return $identity;
}

function strik_recipe_guard_pick($value, $keys) {
    return is_array($value) ? array_intersect_key($value, array_fill_keys($keys, true)) : array();
}
function strik_recipe_guard_production($data) {
    if (!is_array($data)) return array();
    $result = strik_recipe_guard_pick($data, array('bakeryHome', 'manualProductionPlanningItems', 'allergenLists', 'updatedAt'));
    $result['financialAccess'] = false;
    $result['invoiceImports'] = array();
    $result['hefeOrderHistory'] = array();
    $result['ingredients'] = array_map(function($item) {
        $clean = strik_recipe_guard_pick($item, array('id','name','supplier','supplierArticleNumber','packageSize','recipeUnit','allergens','lastUpdated','status','aliases'));
        $clean['lastPrice'] = 0; $clean['previousPrice'] = 0; $clean['pricePerBaseUnit'] = 0; $clean['lastInvoice'] = '';
        if (isset($item['specification'])) $clean['specification'] = strik_recipe_guard_pick($item['specification'], array('specsPlazaId','specificationVersion','ingredientsText','allergensConfirmed','nutritionPer100g','densityGramsPerMl','pieceWeightGrams','source','updatedAt'));
        return $clean;
    }, $data['ingredients'] ?? array());
    $result['recipes'] = array_map(function($item) {
        $clean = strik_recipe_guard_pick($item, array('id','name','strikArticleNumber','type','productGroup','createdAt','standardBatchQuantity','standardBatchUnit','status','workInstructions','preparationSteps','finishingSteps','equipment','allergens','isWorkModeVisible','workCategories','version','lastUpdated','portionLabel','batchSize','photoHint','photoPreviewDataUrl','photoFileName','photoUpdatedAt','notes','linkedFinalProductIds','canProduceAhead','desiredProductionFrequencyDays','desiredProductionBatchQuantity','lastProducedAt','lastProducedQuantity','productionLog','productionRequests'));
        if (isset($item['labeling'])) $clean['labeling'] = strik_recipe_guard_pick($item['labeling'], array('productName','ingredientsText','finalBatchWeightGrams','netQuantity','storageInstructions','shelfLifeText','operatorDetails','notes'));
        foreach (array('salesPrice','costPrice','previousCostPrice','targetMargin','currentMargin') as $field) $clean[$field] = 0;
        $clean['ingredients'] = array_map(function($line) { return array_merge(strik_recipe_guard_pick($line, array('ingredientId','quantity','unit','wastePercentage','sortOrder')), array('costContribution' => 0)); }, $item['ingredients'] ?? array());
        $clean['semiFinishedItems'] = array_map(function($line) { return array_merge(strik_recipe_guard_pick($line, array('semiFinishedRecipeId','quantity','unit','sortOrder')), array('costContribution' => 0)); }, $item['semiFinishedItems'] ?? array());
        $clean['packagingItems'] = array_map(function($line) { return array_merge(strik_recipe_guard_pick($line, array('id','packagingId','quantity','nameSnapshot')), array('costContribution' => 0, 'unitPrice' => 0)); }, $item['packagingItems'] ?? array());
        return $clean;
    }, $data['recipes'] ?? array());
    $result['packagingItems'] = array_map(function($item) { return array_merge(strik_recipe_guard_pick($item, array('id','name','supplier','articleNumber','packageSize','quantityPerPackage','status','lastUpdated')), array('packagePrice' => 0, 'unitPrice' => 0)); }, $data['packagingItems'] ?? array());
    return $result;
}

add_filter('rest_pre_dispatch', function($result, $server, $request) {
    $route = $request->get_route();
    if (!preg_match('#^/strik/v1/recepturen(?:$|/|-)#', $route)) return $result;
    $identity = strik_recipe_guard_identity($request);
    if (is_wp_error($identity)) return $identity;
    if ($identity['manager']) return $result;
    if ($route === '/strik/v1/recepturen-allergen-lists') return $result;
    if ($route !== '/strik/v1/recepturen') return new WP_Error('strik_manager_required', 'Alleen managers kunnen deze gegevens beheren.', array('status' => 403));
    if ($request->get_method() === 'GET') return $result;
    if (!in_array($request->get_method(), array('PUT', 'POST'), true)) return new WP_Error('strik_method_forbidden', 'Deze wijziging is niet toegestaan.', array('status' => 403));
    $incoming = $request->get_json_params();
    if (!is_array($incoming) || !isset($incoming['recipes']) || !is_array($incoming['recipes'])) return new WP_Error('strik_invalid_data', 'Ongeldige productieregistratie.', array('status' => 400));
    $current = function_exists('strik_recepturen_v1_get_data') ? strik_recepturen_v1_get_data() : null;
    if (!is_array($current)) return new WP_Error('strik_storage_unavailable', 'Bestaande gegevens konden niet veilig worden geladen.', array('status' => 503));
    $updates = array();
    foreach ($incoming['recipes'] as $recipe) if (is_array($recipe) && isset($recipe['id'])) $updates[$recipe['id']] = $recipe;
    $fields = array('productionLog','productionRequests','currentStock','stockQuantity','lastProducedAt','lastProducedQuantity','lastProductionDate','stockUpdatedAt');
    foreach ($current['recipes'] as &$recipe) if (isset($updates[$recipe['id']])) $recipe = array_merge($recipe, strik_recipe_guard_pick($updates[$recipe['id']], $fields));
    unset($recipe);
    foreach (array('manualProductionPlanningItems','bakeryHome') as $field) if (isset($incoming[$field]) && is_array($incoming[$field])) $current[$field] = $incoming[$field];
    $request->set_body(wp_json_encode($current));
    return $result;
}, 1, 3);

add_filter('rest_post_dispatch', function($response, $server, $request) {
    if ($request->get_route() !== '/strik/v1/recepturen' || is_wp_error($response) || !is_object($response) || !method_exists($response, 'get_data') || $response->get_status() >= 400) return $response;
    $identity = strik_recipe_guard_identity($request);
    if (is_wp_error($identity)) return $identity;
    if (!$identity['manager']) $response->set_data(strik_recipe_guard_production($response->get_data()));
    $response->header('Cache-Control', 'private, no-store');
    return $response;
}, 99, 3);
