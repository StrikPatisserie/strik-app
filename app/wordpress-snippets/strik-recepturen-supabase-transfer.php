<?php
/**
 * Strik recepturen — beveiligde overdracht naar Supabase.
 * Install alongside the existing recipe API + recipe access guard. No secrets.
 * WordPress keeps its original data and revisions as a frozen recovery copy.
 */
if (!function_exists('strik_recipe_transfer_lock')) {
function strik_recipe_transfer_lock() {
    $lock = get_option('strik_recipe_supabase_transfer', array());
    return is_array($lock) && !empty($lock['id']) ? $lock : null;
}
function strik_recipe_transfer_permission($request) {
    if (!function_exists('strik_recipe_guard_identity')) return new WP_Error('guard_missing', 'Recepturenbeveiliging ontbreekt.', array('status'=>503));
    $identity = strik_recipe_guard_identity($request);
    if (is_wp_error($identity)) return $identity;
    return !empty($identity['manager']) ? true : new WP_Error('manager_required', 'Alleen bevoegde managers.', array('status'=>403));
}
function strik_recipe_transfer_snapshot() {
    $data = get_option('strik_recepturen_data', array());
    $lists = get_option('strik_recepturen_allergen_lists', array());
    return array('data'=>$data, 'allergenLists'=>is_array($lists)?$lists:array(), 'locked'=>!!strik_recipe_transfer_lock(), 'retired'=>!empty(strik_recipe_transfer_lock()['retired']));
}
function strik_recipe_transfer_action($request) {
    $body = $request->get_json_params();
    $action = is_array($body) ? ($body['action'] ?? '') : '';
    $id = is_array($body) ? (string)($body['lockId'] ?? '') : '';
    if (!in_array($action,array('inspect','lock','snapshot','retire','unlock'),true)) return new WP_Error('invalid_action','Ongeldige actie.',array('status'=>400));
    if ($action !== 'inspect' && !preg_match('/^[a-f0-9-]{36}$/i',$id)) return new WP_Error('invalid_lock','Ongeldige vergrendeling.',array('status'=>400));
    $lock = strik_recipe_transfer_lock();
    if ($action === 'lock') {
        if ($lock && $lock['id'] !== $id) return new WP_Error('source_locked','De bron is vergrendeld.',array('status'=>423));
        if (!$lock && !add_option('strik_recipe_supabase_transfer',array('id'=>$id,'retired'=>false,'createdAt'=>gmdate('c')),'','no')) return new WP_Error('source_locked','Vergrendelen is niet gelukt.',array('status'=>423));
    } elseif ($action !== 'inspect') {
        if (!$lock || $lock['id'] !== $id) return new WP_Error('source_locked','De vergrendeling hoort bij een andere overdracht.',array('status'=>423));
        if ($action === 'retire') { $lock['retired']=true; update_option('strik_recipe_supabase_transfer',$lock,false); }
        if ($action === 'unlock') {
            if (!empty($lock['retired'])) return new WP_Error('source_retired','De recepten zijn overgezet; herstel via Supabase.',array('status'=>409));
            delete_option('strik_recipe_supabase_transfer');
        }
    }
    $response = new WP_REST_Response(strik_recipe_transfer_snapshot(),200);
    $response->header('Cache-Control','private, no-store');
    return $response;
}
add_action('rest_api_init',function(){ register_rest_route('strik/v1','/recepturen-storage-transfer',array('methods'=>'POST','callback'=>'strik_recipe_transfer_action','permission_callback'=>'strik_recipe_transfer_permission')); });
add_filter('rest_pre_dispatch',function($result,$server,$request){
    if ($request->get_route() === '/strik/v1/recepturen-storage-transfer') return $result;
    if (preg_match('#^/strik/v1/recepturen(?:$|/|-)#',$request->get_route()) && !in_array($request->get_method(),array('GET','HEAD','OPTIONS'),true) && strik_recipe_transfer_lock()) return new WP_Error('strik_recipe_source_locked','Recepturen zijn verplaatst naar Supabase. Ververs de Strik-app.',array('status'=>423));
    return $result;
},0,3);
// Also stop legacy admin actions from changing the frozen source options.
foreach (array('strik_recepturen_data','strik_recepturen_allergen_lists') as $option) add_filter('pre_update_option_'.$option,function($new,$old){return strik_recipe_transfer_lock()?$old:$new;},0,2);
}
