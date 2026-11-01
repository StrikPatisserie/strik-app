"use client";
import {useLayoutEffect,useRef} from 'react';
/** Fit the actual rendered board, including late-loaded wedding/request rows.
 * Never drops cards, truncates recipes or changes planning data. Native modal
 * dialogs remain in the top layer, outside the transformed board geometry.
 */
export default function usePlanningScreenFit(enabled:boolean){
 const viewportRef=useRef<HTMLElement>(null),canvasRef=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!enabled)return;
  const viewport=viewportRef.current,canvas=canvasRef.current;
  if(!viewport||!canvas)return;
  const root=viewport.parentElement;
  let frame=0,disposed=false;
  function reset(){
   viewport!.style.height='';canvas!.style.transform='';canvas!.style.width='';
   canvas!.style.removeProperty('--screen-fit-scale');delete canvas!.dataset.screenDensity;
   if(root)root.style.height='';
  }
  function fit(){
   if(disposed)return;
   if(window.innerWidth<=800){reset();return;}
   const screenBottom=window.visualViewport?window.visualViewport.offsetTop+window.visualViewport.height:window.innerHeight;
   const height=Math.max(1,screenBottom-viewport!.getBoundingClientRect().top-4);
   if(root)root.style.height=`${Math.max(1,screenBottom-root.getBoundingClientRect().top)}px`;
   viewport!.style.height=`${height}px`;
   canvas!.style.transform='none';canvas!.style.width='100%';canvas!.dataset.screenDensity='comfortable';
   // First spend less space on row padding and secondary labels; then scale
   // only as far as the real content requires, at the screen's real resolution.
   for(const density of ['compact','dense']){
    if(canvas!.scrollHeight<=height)break;
    canvas!.dataset.screenDensity=density;
   }
   const availableWidth=Math.max(1,viewport!.clientWidth-parseFloat(getComputedStyle(viewport!).paddingLeft||'0')-parseFloat(getComputedStyle(viewport!).paddingRight||'0'));
   let scale=Math.min(1,height/Math.max(1,canvas!.scrollHeight),availableWidth/Math.max(1,canvas!.scrollWidth));
   const apply=()=>{canvas!.style.width=`${100/scale}%`;canvas!.style.transform=`scale(${scale})`;canvas!.style.setProperty('--screen-fit-scale',String(scale));};
   apply();
   // Wider layout at a smaller scale can reflow text or the request pane.
   // Re-measure rather than relying on task counts or a fixed television size.
   for(let attempt=0;attempt<4;attempt++){
    const renderedHeight=canvas!.scrollHeight*scale,renderedWidth=canvas!.scrollWidth*scale;
    if(renderedHeight<=height&&renderedWidth<=availableWidth+1)break;
    scale*=Math.min(height/Math.max(1,renderedHeight),availableWidth/Math.max(1,renderedWidth))*.995;
    apply();
   }
  }
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(()=>{frame=0;fit();});};
  window.scrollTo({top:0,left:0,behavior:'instant'});fit();
  const observer=new MutationObserver(schedule);
  observer.observe(canvas,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['open','class']});
  const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);resize?.observe(viewport);
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
  canvas.addEventListener('load',schedule,true);canvas.addEventListener('toggle',schedule,true);
  document.fonts?.addEventListener('loadingdone',schedule);void document.fonts?.ready.then(schedule);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize?.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);canvas.removeEventListener('load',schedule,true);canvas.removeEventListener('toggle',schedule,true);document.fonts?.removeEventListener('loadingdone',schedule);reset();};
 },[enabled]);
 return {viewportRef,canvasRef};
}
