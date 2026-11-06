"use client";

import {useLayoutEffect,useRef} from "react";

/** Fit the complete desktop workspace, including navigation and toolbars.
 * Measure actual content after fonts/data load; never hide tasks or shorten names.
 * Dialogs stay in the browser top layer and retain their normal readable size.
 */
export default function useScreenLayout(xl:boolean,enabled=true){
  const frameRef=useRef<HTMLDivElement>(null),workspaceRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!enabled)return;
    const frame=frameRef.current,workspace=workspaceRef.current;
    if(!frame||!workspace)return;
    let scheduled=0,disposed=false;

    function reset(){
      workspace!.style.transform="";workspace!.style.width="";
      workspace!.style.removeProperty("--screen-fit-scale");
      delete workspace!.dataset.screenDensity;
      workspace!.querySelectorAll<HTMLElement>("[data-fit-text]").forEach(el=>el.style.fontSize="");
    }
    function fitWords(){
      const labels=Array.from(workspace!.querySelectorAll<HTMLElement>("[data-fit-text]"));
      labels.forEach(el=>el.style.fontSize="");
      // Read all base widths before writing the smaller sizes.
      const sizes=labels.map(el=>{
        const available=el.clientWidth-1;
        const words=Array.from(el.querySelectorAll<HTMLElement>("[data-fit-word]"));
        const widest=Math.max(0,...words.map(word=>word.getBoundingClientRect().width));
        const base=parseFloat(getComputedStyle(el).fontSize);
        return available>0&&widest>available?base*available/widest:undefined;
      });
      labels.forEach((el,i)=>{if(sizes[i]!==undefined)el.style.fontSize=`${sizes[i]}px`;});
    }
    function fit(){
      if(disposed)return;
      if(window.innerWidth<=800){reset();fitWords();return;}
      const availableWidth=Math.max(1,frame!.clientWidth);
      const availableHeight=Math.max(1,window.visualViewport
        ?window.visualViewport.offsetTop+window.visualViewport.height-frame!.getBoundingClientRect().top-2
        :window.innerHeight-frame!.getBoundingClientRect().top-2);
      const minimumWidth=xl?1280:1440;
      // Retain the same physical reading size on a 4K television as Full HD.
      const maximum=Math.min(Math.max(1,availableWidth/1920),availableWidth/minimumWidth);
      const initialWidth=availableWidth/maximum;
      workspace!.style.transform="none";
      workspace!.style.width=`${initialWidth}px`;
      workspace!.dataset.screenDensity="comfortable";
      fitWords();
      for(const density of ["compact","dense"]){
        if(workspace!.scrollHeight*maximum<=availableHeight)break;
        workspace!.dataset.screenDensity=density;
        fitWords();
      }
      const fits=(scale:number)=>{
        workspace!.style.width=`${availableWidth/scale}px`;
        fitWords();
        return workspace!.scrollHeight*scale<=availableHeight&&workspace!.scrollWidth*scale<=availableWidth+.5;
      };
      // Find the largest readable scale, including reflow at the wider layout.
      // Whole words and the side menu are part of each real measurement.
      let scale=maximum;
      if(!fits(maximum)){
        let lower=0,upper=maximum;
        for(let attempt=0;attempt<12;attempt++){
          const candidate=(lower+upper)/2;
          if(fits(candidate))lower=candidate;else upper=candidate;
        }
        scale=lower||maximum/8192;
        fits(scale);
      }
      workspace!.style.transform=`scale(${scale})`;
      workspace!.style.setProperty("--screen-fit-scale",String(scale));
    }
    const schedule=()=>{if(!scheduled&&!disposed)scheduled=requestAnimationFrame(()=>{scheduled=0;fit();});};
    if(window.innerWidth>800)window.scrollTo({top:0,left:0,behavior:"instant"});
    fit();
    const mutations=new MutationObserver(records=>{
      // Tabular clock ticks of the same length do not change the layout.
      if(records.every(record=>record.type==="characterData"&&record.oldValue?.length===record.target.textContent?.length&&record.target.parentElement?.closest("[data-layout-clock]")))return;
      schedule();
    });
    mutations.observe(workspace,{subtree:true,childList:true,characterData:true,characterDataOldValue:true,attributes:true,attributeFilter:["class"]});
    const resize=new ResizeObserver(schedule);resize.observe(frame);resize.observe(workspace);
    window.addEventListener("resize",schedule);window.visualViewport?.addEventListener("resize",schedule);
    workspace.addEventListener("load",schedule,true);
    document.fonts?.addEventListener("loadingdone",schedule);void document.fonts?.ready.then(schedule);
    return()=>{disposed=true;cancelAnimationFrame(scheduled);mutations.disconnect();resize.disconnect();window.removeEventListener("resize",schedule);window.visualViewport?.removeEventListener("resize",schedule);workspace.removeEventListener("load",schedule,true);document.fonts?.removeEventListener("loadingdone",schedule);reset();};
  },[xl,enabled]);
  return {frameRef,workspaceRef};
}
