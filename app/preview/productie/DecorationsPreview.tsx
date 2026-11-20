"use client";
import { useState } from "react";
import DecorationChecks from "../../productie/DecorationChecks";
import DecorationsList from "../../bakkerij/recepturen/DecorationsList";
import { initialDecorations } from "../../productie/decorations";
import { applyDecorationCommand } from "../../productie/decorationPlanning";
import { recipeViews } from "../../productie/workspaceData";
import type { Recipe } from "../../bakkerij/recepturen/types";
import type { PreviewState } from "../../productie/planning";

export default function DecorationsPreview(){
  const [ingredients,setIngredients]=useState(initialDecorations);
  const recipe:Recipe={id:"demo-hazelino",name:"Hazelino",type:"finalProduct",productGroup:"Gebak",status:"active",salesPrice:0,costPrice:0,previousCostPrice:0,targetMargin:0,currentMargin:0,semiFinishedItems:[],preparationSteps:[],allergens:[],version:"1",lastUpdated:"",portionLabel:"per stuk",batchSize:"1 stuk",photoHint:"",notes:"",standardBatchQuantity:1,standardBatchUnit:"stuk",ingredients:[{ingredientId:"deco-03",quantity:1,unit:"stuk",costContribution:0}]};
  const views=recipeViews({recipes:[recipe],ingredients,invoiceImports:[]});
  const [state,setState]=useState<PreviewState>({version:1,items:[{id:"demo-cake",name:"Hazelino",recipeId:recipe.id,kind:"product",departmentId:"luxe",unit:"stuks",stock:0,note:""}],tasks:[{id:"demo-finish",itemId:"demo-cake",departmentId:"luxe",date:"2026-11-24",quantity:150,operation:"Afwerken",status:"planned",recordsOutput:true,source:"manual",batchId:"demo-batch",note:""}]});
  return <div><p style={{fontSize:12,marginBottom:10}}>Voorbeeld · wijzigingen blijven alleen op deze pagina.</p><DecorationChecks state={state} recipes={views} week="2026-11-23" end="2026-11-29" busy={false} canCheck onCommand={async command=>{try{setState(applyDecorationCommand(state,views,command,"preview",new Date().toISOString(),()=>crypto.randomUUID()));return undefined;}catch(e){return (e as Error).message;}}}/>
    {state.tasks.filter(t=>t.departmentId==="chocolade").map(t=><p key={t.id}>Chocolade: {t.operation} · {t.quantity} stuks · {t.date}</p>)}
    <DecorationsList ingredients={ingredients} recipes={[recipe]} onSave={async item=>setIngredients(current=>[...current.filter(i=>i.id!==item.id),item])}/>
  </div>;
}
