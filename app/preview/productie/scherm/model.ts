import {addDays} from "../../../productie/planning";
import type {ScreenState} from "../../../productie/productionWork";
import {demoRecipes,initialPreviewState} from "../sampleData";
export * from "../../../productie/productionWork";
export const SCREEN_STORAGE_KEY="strik-screen-preview-v1";
export const SCREEN_WEEK="2026-11-02";
export function initialScreenState():ScreenState {
  const planner=initialPreviewState();
  planner.tasks=planner.tasks.map(task=>({...task,date:addDays(task.date,7),...(task.dueDate?{dueDate:addDays(task.dueDate,7)}:{})}));
  planner.items.push({id:"wedding-demo",name:"Bruidstaart · voorbeeld",kind:"product",departmentId:"bruidstaarten",unit:"stuks",stock:0,note:"Fictieve taart voor deze schermpreview."});
  planner.tasks.push({id:"wedding-demo-task",itemId:"wedding-demo",departmentId:"bruidstaarten",date:"2026-11-07",quantity:1,operation:"Afwerken & klaarzetten",status:"planned",note:"",source:"order",batchId:"wedding-demo-batch",recordsOutput:true});
  return {version:1,planner,recipes:structuredClone(demoRecipes),overrides:{},preparation:{"demo-kapsel":2,"demo-creme":0,"demo-ganache":1},history:[],work:[]};
}
