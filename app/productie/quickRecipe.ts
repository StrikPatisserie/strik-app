import type {RecepturenData} from '../bakkerij/recepturen/recepturenApi';
import type {Recipe,RecipeUnit} from '../bakkerij/recepturen/types';
import type {PreviewState} from './planning';
export type QuickRecipeInput={itemId:string;yield:number;instructions:string;ingredients:{ingredientId:string;quantity:number;unit:string}[]};
export function quickRecipe(state:PreviewState,data:RecepturenData,input:QuickRecipeInput,id:string,now:string){
 const item=state.items.find(i=>i.id===input.itemId);
 if(!item||item.kind==='activity')throw Error('Kies een bestaand product of halffabricaat.');
 if(item.recipeId)throw Error('Er is al een recept gekoppeld. Ververs de planning.');
 if(!['stuks','gram','kg','ml','liter'].includes(item.unit))throw Error('Dit onderdeel gebruikt een eenheid die eerst in het receptenbeheer moet worden ingesteld.');
 if(!Number.isFinite(input.yield)||input.yield<=0||input.yield>1000000||typeof input.instructions!=='string'||!input.instructions.trim()||input.instructions.length>10000)throw Error('Vul de basisopbrengst en werkwijze in.');
 if(!Array.isArray(input.ingredients)||!input.ingredients.length||input.ingredients.length>50)throw Error('Voeg minimaal één en maximaal vijftig grondstoffen toe.');
 const seen=new Set<string>();
 const ingredients=input.ingredients.map((line,index)=>{
  const source=data.ingredients.find(i=>i.id===line.ingredientId);
  if(!source||seen.has(source.id)||!Number.isFinite(line.quantity)||line.quantity<=0||line.quantity>1000000||!['gram','kg','ml','liter','stuk'].includes(line.unit))throw Error('Kies bestaande grondstoffen met een geldige hoeveelheid en eenheid, zonder dubbele regels.');
  seen.add(source.id);return {ingredientId:source.id,quantity:line.quantity,unit:line.unit as RecipeUnit,costContribution:0,sortOrder:index};
 });
 const recipe:Recipe={id,name:item.name,type:item.kind==='component'?'semiFinished':'finalProduct',productGroup:item.departmentId==='ijs'?'IJs':item.departmentId==='chocolade'?'Chocolade':'Gebak',standardBatchQuantity:input.yield,standardBatchUnit:(item.unit==='stuks'?'stuk':item.unit) as RecipeUnit,status:'draft',ingredients,semiFinishedItems:[],preparationSteps:input.instructions.trim().split('\n').map(s=>s.trim()).filter(Boolean),allergens:[],salesPrice:0,costPrice:0,previousCostPrice:0,targetMargin:0,currentMargin:0,version:'1',createdAt:now.slice(0,10),lastUpdated:now.slice(0,10),portionLabel:'',batchSize:`${input.yield} ${item.unit}`,photoHint:'',notes:'Snel ingevoerd vanuit de productieplanning. Concept: controleer grondstoffen, kostprijs en allergenen in receptenbeheer.',isWorkModeVisible:true};
 return {recipes:{...data,recipes:[...data.recipes,recipe],updatedAt:now},planner:{...state,items:state.items.map(i=>i.id===item.id?{...i,recipeId:id}:i)}};
}
