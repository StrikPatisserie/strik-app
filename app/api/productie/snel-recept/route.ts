import {getCurrentProfile} from '@/app/lib/auth/session';
import {productionDepartments} from '@/app/productie/access';
import {readDocument,saveQuickRecipeDocument,ProductionStoreError} from '@/app/productie/documents.server';
import {quickRecipe,type QuickRecipeInput} from '@/app/productie/quickRecipe';
import {syncRecipeCatalog,validWorkspace,recipeViews} from '@/app/productie/workspaceData';
import type {PreviewState} from '@/app/productie/planning';
import type {RecepturenData} from '@/app/bakkerij/recepturen/recepturenApi';
export const dynamic='force-dynamic';const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const profile=await getCurrentProfile(),allowed=productionDepartments(profile);
 if(!profile?.active||!allowed.length)return Response.json({message:'Geen toegang tot recepten snel invoeren.'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({message:'Ongeldige herkomst.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>64000)throw new ProductionStoreError('Het werkrecept is te groot.',413);
  const input=JSON.parse(raw),command=input.command as QuickRecipeInput;
  const [planner,recipes]=await Promise.all([readDocument<PreviewState>('planner'),readDocument<RecepturenData>('recipes')]);
  if(!planner||!recipes)throw new ProductionStoreError('De productieopslag is nog niet ingericht.');
  if(input.revision!==planner.revision||input.recipeRevision!==recipes.revision)throw new ProductionStoreError('Planning of recepten zijn intussen gewijzigd. Ververs eerst; er is niets opgeslagen.',409);
  const current=syncRecipeCatalog(planner.data,recipes.data),item=current.items.find(i=>i.id===command?.itemId);
  if(!item||!allowed.includes(item.departmentId))throw new ProductionStoreError('Je kunt alleen recepten van je eigen afdelingen aanvullen.',403);
  const now=new Date().toISOString(),next=quickRecipe(current,recipes.data,command,`recipe-quick-${crypto.randomUUID()}`,now);
  if(!validWorkspace(next.planner,recipeViews(next.recipes)))throw new ProductionStoreError('Controleer het onderdeel en de recepteenheden; er is niets opgeslagen.',400);
  await saveQuickRecipeDocument(planner.revision,recipes.revision,next.planner,next.recipes,profile.id);
  return Response.json({saved:true},{headers});
 }catch(e){return Response.json({message:e instanceof Error?e.message:'Opslaan mislukt.'},{status:e instanceof ProductionStoreError?e.status:400,headers});}
}
