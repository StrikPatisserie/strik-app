import type {RecepturenData} from '../bakkerij/recepturen/recepturenApi';
import type {Recipe,RecipeUnit} from '../bakkerij/recepturen/types';
import {validProductionSteps, type PreviewState} from './planning';
export type QuickRecipeInput={productionSteps?:string[];itemId:string;yield:number;instructions:string;ingredients:{ingredientId:string;quantity:number;unit:string;label?:string;sortOrder?:number}[]};
export function quickRecipe(state:PreviewState,data:RecepturenData,input:QuickRecipeInput,id:string,now:string){
 const item=state.items.find(i=>i.id===input.itemId);
 if(!item||item.kind==='activity')throw Error('Kies een bestaand product of halffabricaat.');
 if(item.recipeId)throw Error('Er is al een recept gekoppeld. Ververs de planning.');
 if(!['stuks','gram','kg','ml','liter'].includes(item.unit))throw Error('Dit onderdeel gebruikt een eenheid die eerst in het receptenbeheer moet worden ingesteld.');
 if(!Number.isFinite(input.yield)||input.yield<=0||input.yield>1000000||typeof input.instructions!=='string'||!input.instructions.trim()||input.instructions.length>10000)throw Error('Vul de basisopbrengst en werkwijze in.');
 if(!Array.isArray(input.ingredients)||!input.ingredients.length||input.ingredients.length>50)throw Error('Voeg minimaal één en maximaal vijftig grondstoffen toe.');
 if(input.productionSteps!==undefined && !validProductionSteps(input.productionSteps))throw Error("Kies minimaal één geldige productiestap.");
 const ingredients=input.ingredients.map((line,index)=>{
  const source=data.ingredients.find(i=>i.id===line.ingredientId);
  if(!source||!Number.isFinite(line.quantity)||line.quantity<=0||line.quantity>1000000||!['gram','kg','ml','liter','stuk'].includes(line.unit))throw Error('Kies bestaande grondstoffen met een geldige hoeveelheid en eenheid.');
  if(line.label!==undefined && (typeof line.label!=="string" || line.label.length>160))throw Error("Gebruik een regelnaam van maximaal 160 tekens.");
  if(line.sortOrder!==undefined && (!Number.isSafeInteger(line.sortOrder) || line.sortOrder<0 || line.sortOrder>1000000))throw Error("Controleer de volgorde van de receptregels.");
  return {ingredientId:source.id,quantity:line.quantity,unit:line.unit as RecipeUnit,costContribution:0,sortOrder:line.sortOrder??index,label:line.label?.trim()||undefined};
 });
 const recipe:Recipe={id,...(input.productionSteps?{productionSteps:[...input.productionSteps]}:{}),name:item.name,type:item.kind==='component'?'semiFinished':'finalProduct',productGroup:item.departmentId==='ijs'?'IJs':item.departmentId==='chocolade'?'Chocolade':'Gebak',standardBatchQuantity:input.yield,standardBatchUnit:(item.unit==='stuks'?'stuk':item.unit) as RecipeUnit,status:'draft',ingredients,semiFinishedItems:[],preparationSteps:input.instructions.trim().split('\n').map(s=>s.trim()).filter(Boolean),allergens:[],salesPrice:0,costPrice:0,previousCostPrice:0,targetMargin:0,currentMargin:0,version:'1',createdAt:now.slice(0,10),lastUpdated:now.slice(0,10),portionLabel:'',batchSize:`${input.yield} ${item.unit}`,photoHint:'',notes:'Snel ingevoerd vanuit de productieplanning. Concept: controleer grondstoffen, kostprijs en allergenen in receptenbeheer.',isWorkModeVisible:true};
 return {recipes:{...data,recipes:[...data.recipes,recipe],updatedAt:now},planner:{...state,items:state.items.map(i=>i.id===item.id?{...i,recipeId:id}:i)}};
}
