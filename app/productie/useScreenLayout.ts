"use client";

import {useLayoutEffect,useRef} from "react";

type WordMeasurement={text:string;base:number;widest:number};

/** Fit the complete workspace once, then retain its layout until real overflow
 * or a viewport resize requires another fit. Browser zoom keeps native scrolling.
 */
export default function useScreenLayout(xl:boolean,enabled=true,layoutKey='week',fitNativeText=false){
  const frameRef=useRef<HTMLDivElement>(null),workspaceRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!enabled&&!fitNativeText)return;
    const frame=frameRef.current,workspace=workspaceRef.current;
    if(!frame||!workspace)return;
    const originalFrame={height:frame.style.height,overflow:frame.style.overflow};
    const dirtyWords=new Set<HTMLElement>();
    const words=new WeakMap<HTMLElement,WordMeasurement>();
    let scheduled=0,disposed=false,initialized=false,nativeLayout=false;
    let fullFit=false,newFonts=false,scale=1,lastWidth=0,lastHeight=0,lastTop=0;

    function reset(){
      workspace!.style.transform="";workspace!.style.width="";
      workspace!.style.removeProperty("--screen-fit-scale");
      workspace!.style.removeProperty("--screen-fit-height");
      delete workspace!.dataset.screenDensity;
      workspace!.querySelectorAll<HTMLElement>("[data-fit-text]").forEach(el=>el.style.fontSize="");
    }
    function restoreFrame(){
      frame!.style.height=originalFrame.height;frame!.style.overflow=originalFrame.overflow;
    }
    function fitWords(refresh=false,targets?:Set<HTMLElement>){
      const labels=targets?[...targets].filter(el=>el.isConnected!==false):[...workspace!.querySelectorAll<HTMLElement>("[data-fit-text]")];
      const fresh=new Set(labels.filter(el=>refresh||words.get(el)?.text!==el.textContent));
      fresh.forEach(el=>el.style.fontSize="");
      // All natural word widths are read before any fitted font size is written.
      // offsetWidth uses layout pixels, independent of the workspace transform.
      const sizes=labels.map(el=>{
        const computed=getComputedStyle(el);
        const available=el.clientWidth-(parseFloat(computed.paddingLeft)||0)-(parseFloat(computed.paddingRight)||0)-1;
        let measurement=words.get(el);
        if(fresh.has(el)){
          measurement={text:el.textContent||"",base:parseFloat(computed.fontSize),widest:Math.max(0,...[...el.querySelectorAll<HTMLElement>("[data-fit-word]")].map(word=>word.offsetWidth))};
          words.set(el,measurement);
        }
        return available>0&&measurement&&measurement.widest>available?`${measurement.base*available/measurement.widest}px`:"";
      });
      labels.forEach((el,index)=>{if(el.style.fontSize!==sizes[index])el.style.fontSize=sizes[index];});
    }
    function fit(resized=false,fontsChanged=false){
      if(disposed)return;
      if((window.visualViewport?.scale||1)!==1)return;
      if(!enabled){
        lastWidth=frame!.clientWidth;lastHeight=window.innerHeight;lastTop=frame!.getBoundingClientRect().top;
        if(resized||fontsChanged||!initialized)fitWords(true);
        else if(dirtyWords.size)fitWords(false,dirtyWords);
        dirtyWords.clear();initialized=true;
        return;
      }
      const outer=window.outerWidth||window.innerWidth;
      // A different display can change DPR without any browser zoom. Only the
      // difference between browser and layout width should enable native zoom.
      const zoomed=Math.abs(outer/window.innerWidth-1)>.08;
      if(zoomed||window.innerWidth<=800){
        if(!nativeLayout){reset();nativeLayout=true;initialized=false;}
        frame!.style.height=zoomed?"auto":originalFrame.height;
        frame!.style.overflow=zoomed?"visible":originalFrame.overflow;
        return;
      }
      if(nativeLayout){restoreFrame();nativeLayout=false;resized=true;}
      const width=Math.max(1,frame!.clientWidth),top=frame!.getBoundingClientRect().top;
      const height=Math.max(1,window.innerHeight-top-2);
      resized||=width!==lastWidth||window.innerHeight!==lastHeight||top!==lastTop;
      lastWidth=width;lastHeight=window.innerHeight;lastTop=top;
      const fits=()=>workspace!.scrollHeight*scale<=height+.5&&workspace!.scrollWidth*scale<=width+.5;
      const setWidth=()=>{
        const value=`${width/scale}px`;
        if(workspace!.style.width!==value)workspace!.style.width=value;
        workspace!.style.setProperty("--screen-fit-height",`${height/scale}px`);
        workspace!.style.setProperty("--screen-fit-scale",String(scale));
      };
      if(initialized&&!resized){
        if(fontsChanged)fitWords(true);else if(dirtyWords.size)fitWords(false,dirtyWords);
        dirtyWords.clear();
        if(fits())return;
      }else{
        scale=Math.min(Math.max(1,width/1920),width/(xl?1280:1440));
        workspace!.dataset.screenDensity="comfortable";setWidth();fitWords(true);
      }
      const densities=["comfortable","compact","dense"];
      for(let index=densities.indexOf(workspace!.dataset.screenDensity||"comfortable")+1;!fits()&&index<densities.length;index++){
        workspace!.dataset.screenDensity=densities[index];fitWords(true);
      }
      if(!fits()){
        const upper=scale,previousHeight=workspace!.scrollHeight;
        // Start with the measured overflow ratio, then account for text reflow.
        for(let attempt=0;attempt<4&&!fits();attempt++){
          scale*=Math.min(height/(workspace!.scrollHeight*scale),width/(workspace!.scrollWidth*scale));
          setWidth();fitWords();
        }
        // Only a fresh viewport fit may grow the layout. Ordinary edits retain
        // their current scale, including after cards are completed or removed.
        if((resized||!initialized)&&fits()&&Math.abs(workspace!.scrollHeight-previousHeight)>1){
          let lower=scale,higher=upper;
          for(let attempt=0;attempt<6;attempt++){
            scale=(lower+higher)/2;setWidth();fitWords();
            if(fits())lower=scale;else higher=scale;
          }
          scale=lower;setWidth();fitWords();
        }
      }
      const transform=`scale(${scale})`;
      if(workspace!.style.transform!==transform)workspace!.style.transform=transform;
      dirtyWords.clear();initialized=true;
    }
    function schedule(resized=false,fontsChanged=false){
      fullFit||=resized;newFonts||=fontsChanged;
      if(!scheduled&&!disposed)scheduled=requestAnimationFrame(()=>{
        scheduled=0;const viewportChanged=fullFit,fontsChanged=newFonts;fullFit=false;newFonts=false;
        fit(viewportChanged,fontsChanged);
      });
    }
    const onResize=()=>schedule(true,true),onContent=()=>schedule(),onFonts=()=>schedule(false,true);
    const onVisualResize=()=>{if((window.visualViewport?.scale||1)===1)schedule();};
    fit(true,true);
    const mutations=new MutationObserver(records=>{
      let changed=false,fontsChanged=false;
      for(const record of records){
        const target=record.target as HTMLElement|undefined;
        const element=typeof target?.closest==="function"?target:target?.parentElement;
        if(element?.closest("[data-layout-clock]"))continue;
        changed=true;
        if(record.type==="attributes"&&element===workspace)fontsChanged=true;
        const label=element?.closest<HTMLElement>("[data-fit-text]");
        if(label)dirtyWords.add(label);
        const container=element?.closest("article")||element;
        container?.querySelectorAll<HTMLElement>("[data-fit-text]").forEach(el=>dirtyWords.add(el));
      }
      if(changed)schedule(false,fontsChanged);
    });
    mutations.observe(workspace,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class","open","data-warning-only"]});
    // Observe the available frame, not the element whose width/fonts we change.
    const resize=typeof ResizeObserver==="undefined"?null:new ResizeObserver(()=>{
      if(frame.clientWidth!==lastWidth||window.innerHeight!==lastHeight||frame.getBoundingClientRect().top!==lastTop)onResize();
    });
    resize?.observe(frame);
    window.addEventListener("resize",onResize);window.visualViewport?.addEventListener("resize",onVisualResize);
    workspace.addEventListener("load",onContent,true);
    document.fonts?.addEventListener("loadingdone",onFonts);void document.fonts?.ready.then(()=>{if(!disposed)onFonts();});
    return()=>{
      disposed=true;cancelAnimationFrame(scheduled);mutations.disconnect();resize?.disconnect();
      window.removeEventListener("resize",onResize);window.visualViewport?.removeEventListener("resize",onVisualResize);
      workspace.removeEventListener("load",onContent,true);document.fonts?.removeEventListener("loadingdone",onFonts);
      reset();restoreFrame();
    };
  },[xl,enabled,layoutKey,fitNativeText]);
  return {frameRef,workspaceRef};
}
