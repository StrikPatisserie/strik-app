export type Supplier={id:string;name:string;url:string;username:string;password:string;note:string;archived?:boolean;updatedAt?:string;updatedBy?:string};
export type SupplierView=Omit<Supplier,"password">&{hasPassword:boolean};
export type SupplierDocument={revision:number;suppliers:Supplier[]};
export const SUPPLIER_KEY="production_suppliers_v1";
export const defaultSuppliers:Supplier[]=[
 {id:"beko",name:"Beko",url:"https://www.beko-groothandel.nl/",username:"",password:"",note:""},
 {id:"hefe",name:"Hefe",url:"https://restaurant.chefslist.de/",username:"",password:"",note:""},
 {id:"zeelandia",name:"Zeelandia",url:"https://mijn.zeelandia.nl/",username:"",password:"",note:""},
 {id:"vipam",name:"Vipam",url:"https://www.vipam.nl/customer/account/login/",username:"",password:"",note:""},
];
export function supplierViews(doc:SupplierDocument):SupplierView[]{return doc.suppliers.map(({password,...supplier})=>({...supplier,hasPassword:!!password}));}
export function supplierUrl(value:string){const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password||[...url.searchParams.keys()].some(key=>/^(password|wachtwoord|token|secret)$/i.test(key)))throw Error("Gebruik een https-link zonder inloggegevens in de link.");return url.toString();}
export function changeSupplier(doc:SupplierDocument,input:{id:string;name:string;url:string;username:string;password?:string;clearPassword?:boolean;note:string;archived?:boolean},actor:string,at:string):SupplierDocument{
 if(!input||typeof input.id!=="string"||!/^[a-zA-Z0-9-]{1,100}$/.test(input.id))throw Error("Ongeldige leverancier.");
 for(const [value,max] of [[input.name,120],[input.url,2000],[input.username,240],[input.note,1500],[input.password??"",500]] as const)if(typeof value!=="string"||value.length>max)throw Error("Controleer de leveranciersgegevens.");
 if(!input.name.trim())throw Error("Vul de leveranciersnaam in.");
 const previous=doc.suppliers.find(s=>s.id===input.id);
 if(!previous&&doc.suppliers.length>=100)throw Error("Er zijn maximaal 100 leveranciers mogelijk.");
 const supplier:Supplier={id:input.id,name:input.name.trim(),url:supplierUrl(input.url),username:input.username.trim(),password:input.clearPassword?"":input.password||previous?.password||"",note:input.note.trim(),archived:input.archived===true,updatedAt:at,updatedBy:actor};
 return{revision:doc.revision+1,suppliers:previous?doc.suppliers.map(s=>s.id===supplier.id?supplier:s):[...doc.suppliers,supplier]};
}
