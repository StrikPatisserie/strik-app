<?php
require __DIR__.'/b2b-confirmation.php';
function entry_fixture($patch=array()) {
    return strik_sinterklaas_sanitize_b2b_order(array_merge(final_fixture('bakeit-example'), array(
        'status'=>'akkoord', 'deliveryDate'=>'2026-11-27', 'deliveryWindowType'=>'date', 'deliveryDateEnd'=>'',
        'customerName'=>'Voorbeeldbedrijf BV', 'contactName'=>'Sanne',
        'invoiceInfo'=>"Voorbeeldbedrijf BV\nFactuurstraat 12, 6511 AB Nijmegen\nFacturen: facturen@example.invalid\nInkoopnummer: PO-2026-184",
        'deliveryMethod'=>'Bezorgen · 10:00–14:00', 'deliveryAddress'=>"Receptie · Voorbeeldstraat 8\n6511 AA Nijmegen",
        'department'=>'bakkerij',
        'letterLines'=>array(array('id'=>'a','letter'=>'S','style'=>'spuit','size'=>'groot','chocolate'=>'melk','quantity'=>25,'withLogo'=>true,'exceptions'=>array())),
        'orderText'=>"PRODUCTEN EN PRIJS\n25 × Chocolade spuitletters · Groot · eigen logo · € 11,50 p.s. ex btw · € 287,50 · logo € 0,75 p.s. ex btw inbegrepen\n10 × Strik DUO · speculaas + borstplaat · € 8,00 p.s. ex btw · € 80,00\n25 × Inpakpapier · € 0,30 p.s. ex btw · € 7,50\n1 × Bezorgkosten · postcode 6511 AA · automatisch · € 9,95 incl. btw · € 9,13 p.s. ex btw · € 9,13\nOVERIGE ORDERAFSPRAKEN\nVerpakken per afdeling.",
        'logo'=>'Logo volgens aangeleverd bestand, op alle 25 letters.', 'packaging'=>'Alles apart in cadeaupapier verpakken.',
        'importantNotes'=>'Inkoopnummer vermelden op de factuur. Afleveren bij de receptie.',
        'priceAgreement'=>'', 'totalExVat'=>'384.13'
    ),$patch));
}
$o=entry_fixture(); $entry=strik_business_b2b_entry_rows($o); $rows=$entry['rows'];
check(count($rows)===4 && $rows[0]['article']==='70280' && $rows[0]['unit']===1150 && $rows[0]['quantity']===25 && has($rows[0]['description'],'inclusief logo'), 'Saved unit price includes the custom logo, without a separate charge.');
check($rows[1]['article']==='90222' && $rows[2]['unit']===30 && $rows[3]['article']==='310102' && $rows[3]['unit']===913, 'Products, wrapping and postcode delivery retain their separate saved prices.');
check(array_sum(array_column($rows,'total'))===38413, 'Split rows reconcile exactly to the agreed amount.');
$internal=strik_business_b2b_confirmation_html($o,true); $customer=strik_business_b2b_confirmation_html($o);
check(strpos($internal,'Klant en factuurgegevens')<strpos($internal,'LEVERMOMENT') && strpos($internal,'LEVERMOMENT')<strpos($internal,'Art.nr.'), 'Internal mail follows customer, billing, delivery, order sequence.');
foreach(array('facturen@example.invalid','sanne@example.invalid','PO-2026-184','WEEK 48 · vrijdag · 27 november 2026','70280','90222','310102','€ 11,50','inclusief logo','€ 0,30','€ 9,13','Bezorgadres','Verpakken per afdeling.') as $value) check(has($internal,$value), 'Internal entry includes '.$value);
check(!has($customer,'PO-2026-184')&&!has($customer,'facturen@example.invalid')&&!has($customer,'Inkoopnummer vermelden')&&!has($customer,'Art.nr.')&&!has($customer,'Bake-it'), 'Customer confirmation excludes accounting instructions and private notes.');
check(has($customer,'DEFINITIEVE BESTELBEVESTIGING') && has($customer,'Stuksprijs')&&!has($customer,'Dit is nog geen definitieve'), 'Formal customer table is clearly definitive.');
$stol=entry_fixture(array('letterLines'=>array(),'orderText'=>"PRODUCTEN EN PRIJS\n3 × Kerststol · eigen logo · € 14,00 p.s. ex btw · € 42,00 · logo € 1,00 p.s. ex btw inbegrepen"));
$r=strik_business_b2b_entry_rows($stol)['rows'];check(count($r)===1&&$r[0]['unit']===1400&&has($r[0]['description'],'inclusief logo'), 'Stol price includes its one euro logo surcharge.');
$edited=$o;$edited['letterLines'][0]['quantity']=30;$r=strik_business_b2b_entry_rows($edited)['rows'];
$letters=array_values(array_filter($r,function($r){return $r['article']==='70280';}));
check(count($letters)===1&&$letters[0]['quantity']===30&&$letters[0]['unit']===null,'Changed authoritative letters cannot inherit stale inquiry quantities or price.');
$pack=$o;$pack['letterLines'][0]['id']='package:included';$pack['orderText']="PRODUCTEN EN PRIJS\n25 × Sint pakket op maat · € 20,00 p.s. ex btw · € 500,00";
check(count(strik_business_b2b_entry_rows($pack)['rows'])===1,'Letters included in a package are not billed a second time.');
$legacy=entry_fixture(array('letterLines'=>array(),'orderText'=>"BEDRIJF EN CONTACT\nOUD CONTACT\nGEKOZEN SINTERKLAASPRODUCTEN\n2 × Chocolade spuitletters · spuitletter S groot · melk\n  € 10,00 p.s. excl. btw · € 20,00 totaal excl. btw · inclusief cadeaupapier (€ 0,30 incl. btw per letter)\nPRIJSINDICATIE\nOUD TOTAAL"));
$r=strik_business_b2b_entry_rows($legacy)['rows'];check(count($r)===2&&$r[0]['unit']===972&&$r[1]['unit']===28&&array_sum(array_column($r,'total'))===2000,'Legacy wrapping is converted to ex VAT and split without changing the agreed total.');
$legacy['orderText']="PRODUCTEN EN PRIJS\n2 × Strik DUO · eigen logo · € 8,00 p.s. ex btw · € 16,00";
$r=strik_business_b2b_entry_rows($legacy)['rows'];check(count($r)===1&&$r[0]['unit']===800&&has($r[0]['description'],'inclusief logo'),'Missing historic logo rate is not invented.');
$unknown=entry_fixture(array('letterLines'=>array(),'orderText'=>'Speciale bestelling volgens afspraak','packaging'=>'Alles apart in cadeaupapier verpakken.'));
$h=strik_business_b2b_confirmation_html($unknown,true);check(has($h,'Speciale bestelling volgens afspraak')&&has($h,'Inpakpapier: losse stuksprijs niet vastgelegd')&&has($h,'Bezorgkosten: losse prijs niet vastgelegd'),'Unstructured agreements and missing amounts remain visible.');
$discount=$o;$discount['totalExVat']='350.00';check(has(strik_business_b2b_confirmation_html($discount,true),'€ -34,13'),'Manual total agreement remains explicit.');
$pickup=$o;$pickup['deliveryMethod']='Afhalen · Lent';$pickup['deliveryAddress']='';check(has(strik_business_b2b_confirmation_html($pickup,true),'Afhalen · Lent'),'Pickup location remains visible.');
check(strik_business_b2b_full_date('2027-01-01')==='WEEK 53 · vrijdag · 1 januari 2027','ISO week and calendar year are correct at New Year.');
$week=$o;$week['deliveryWindowType']='week';$week['deliveryWeek']='2026-W48';check(strik_business_b2b_full_moment($week)==='WEEK 48 · 2026 · dag nog af te spreken','Week-only delivery is not presented as a confirmed day.');
foreach(array('Spuitletter klein'=>'70281','Vormletter groot'=>'70282','Stafwerk pakket'=>'90212','Staaf Stoomboot'=>'90224','Kerststaaf'=>'90303','Kerstkrans'=>'90304','Onbekende taart'=>'','Logo'=>'','Bezorgkosten · postcode 6511 AA · handmatig'=>'310199','Bezorgkosten · postcode 9999 AA · automatisch'=>'310100') as $name=>$code) check(strik_business_b2b_article($name)===$code,'Article mapping: '.$name);
$unsafe=$o;$unsafe['orderText']="PRODUCTEN EN PRIJS\n1 × <img src=x onerror=alert(1)> · € 2,00 p.s. ex btw · € 2,00";check(!has(strik_business_b2b_confirmation_html($unsafe,true),'<img src=x'),'Descriptions are HTML escaped.');
if(getenv('STRIK_MAIL_PREVIEW_DIR')) {
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR').'/intern.html',$internal);
    file_put_contents(getenv('STRIK_MAIL_PREVIEW_DIR').'/klant.html',$customer);
}
echo "PASS Bake-it mapping, saved unit prices, extras, totals, stale letters, privacy, dates and missing data\n";

// The layout upgrade must not resend existing confirmations. A later change
// to a saved unit price must invalidate the preview even if the total is fixed.
$options=array(); reset_mails(); $saved=b2b_save($o); $saved=mail_final($saved);
$oldversion=$saved['confirmationMail']['version'];
$saved['confirmationMail']['contentSchema']=2;
$saved['confirmationMail']['contentHash']='old';$saved['confirmationMail']['backupContentHash']='old';
$options[STRIK_SINTERKLAAS_B2B_OPTION_NAME][strik_sinterklaas_order_key($saved['id'])]=$saved;
reset_mails();$upgraded=b2b_save(array('id'=>$saved['id'],'entered'=>true));
check(count($mail_calls)===0&&$upgraded['confirmationMail']['version']===$oldversion,'Mail layout upgrade preserves already sent versions.');
$changed=b2b_save(array('id'=>$saved['id'],'orderText'=>str_replace(array('€ 11,50','€ 287,50'),array('€ 12,50','€ 312,50'),$saved['orderText'])));
check(count($mail_calls)===1&&$changed['confirmationMail']['version']!==$oldversion,'Unit-price split changes invalidate stale previews without resending customer mail.');
echo "PASS migration without resends and changed unit-price version tracking\n";

check(!empty($rows[2]['subtext'])&&has($internal,'Subtekst')&&!has($internal,'€ 0,75'),'Wrapping is an unnumbered subtext; logo has no separate price row.');

$converted=entry_fixture(array('letterLines'=>array(),'orderText'=>"PRODUCTEN EN PRIJS\n2 × Chocolade spuitletters · Groot · € 10,00 p.s. ex btw · € 20,00\nOVERIGE ORDERAFSPRAKEN\nBij 2 × Chocolade spuitletters · Groot: inclusief cadeaupapier (€ 0,30 incl. btw per letter)"));
$r=strik_business_b2b_entry_rows($converted)['rows'];check(count($r)===2&&$r[0]['unit']===972&&$r[1]['unit']===28,'Converted folder requests preserve their included wrapping price.');
$free=$o;$free['orderText'].="\n1 × Voorbeeld, niet bestellen · € 99,00 p.s. ex btw · € 99,00";
$e=strik_business_b2b_entry_rows($free);check(count($e['rows'])===4&&has($e['notes'],'niet bestellen'),'Free-text agreements are not converted to additional priced articles.');
