import {LETTERSHOP_SHOPS} from "../lettershop/shops";
export const BUSINESS_PICKUP_LOCATIONS=[
 ...LETTERSHOP_SHOPS.map(shop=>({id:shop.id,label:`${shop.name} · ${shop.address}`})),
 {id:"malden",label:"Bakkerij Malden · Ambachtsweg 4"},
];
export function businessPickupLabel(id:string) {
 const location=BUSINESS_PICKUP_LOCATIONS.find(item=>item.id===id);
 return location?`Afhalen bij ${location.label}`:"Afhalen bij Strik";
}
