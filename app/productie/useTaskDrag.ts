"use client";

import {useCallback,useEffect,useLayoutEffect,useRef,type MouseEvent as ReactMouseEvent,type PointerEvent as ReactPointerEvent,type RefObject} from "react";
import type {DepartmentId} from "./planning";

type TaskDragOptions={
  frameRef:RefObject<HTMLElement|null>;
  enabled:boolean;
  onMove:(id:string,date:string,departmentId:DepartmentId)=>void|Promise<unknown>;
  onDragChange?:(id:string|null)=>void;
};
type DragSession={
  id:string;pointerId:number;handle:HTMLElement;card:HTMLElement;
  startX:number;startY:number;x:number;y:number;offsetX:number;offsetY:number;
  scale:number;active:boolean;ghost:HTMLElement|null;target:HTMLElement|null;
  frame:number;removeListeners:()=>void;
};
const targetSelector="[data-task-date]";

function makeGhost(card:HTMLElement){
  const ghost=card.cloneNode(true) as HTMLElement;
  // Preserve the fitted card even though its copy lives outside the worksheet.
  const sourceNodes=[card,...card.querySelectorAll<HTMLElement>("*")];
  const copiedNodes=[ghost,...ghost.querySelectorAll<HTMLElement>("*")];
  sourceNodes.forEach((source,index)=>{
    const copy=copiedNodes[index],computed=getComputedStyle(source);
    for(let property=0;property<computed.length;property++){
      const name=computed[property];
      copy.style.setProperty(name,computed.getPropertyValue(name));
    }
    copy.style.pointerEvents="none";
    copy.removeAttribute("id");
    copy.removeAttribute("draggable");
  });
  ghost.setAttribute("aria-hidden","true");
  ghost.setAttribute("inert","");
  ghost.dataset.taskDragGhost="";
  Object.assign(ghost.style,{
    position:"fixed",left:"0",top:"0",margin:"0",width:`${card.offsetWidth}px`,
    height:`${card.offsetHeight}px`,minWidth:"0",maxWidth:"none",pointerEvents:"none",
    transformOrigin:"top left",willChange:"transform",zIndex:"2147483000",opacity:"0.94",
  });
  document.body.appendChild(ghost);
  return ghost;
}

function scrollNearEdge(element:HTMLElement|null,x:number,y:number){
  const scrolling=document.scrollingElement as HTMLElement|null;
  let node=element,scrolledX=false,scrolledY=false;
  while(node){
    const documentScroll=node===scrolling;
    const style=getComputedStyle(node);
    const rect=documentScroll?{left:0,top:0,right:window.innerWidth,bottom:window.innerHeight}:node.getBoundingClientRect();
    const speed=(position:number,start:number,end:number)=>position<start+36?-Math.ceil((start+36-position)/3):position>end-36?Math.ceil((position-end+36)/3):0;
    if(x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom){
      if(!scrolledY&&node.scrollHeight>node.clientHeight+1&&(documentScroll||/auto|scroll/.test(style.overflowY))){
        const before=node.scrollTop;
        node.scrollTop+=Math.max(-16,Math.min(16,speed(y,Math.max(0,rect.top),Math.min(window.innerHeight,rect.bottom))));
        scrolledY=node.scrollTop!==before;
      }
      if(!scrolledX&&node.scrollWidth>node.clientWidth+1&&(documentScroll||/auto|scroll/.test(style.overflowX))){
        const before=node.scrollLeft;
        node.scrollLeft+=Math.max(-16,Math.min(16,speed(x,Math.max(0,rect.left),Math.min(window.innerWidth,rect.right))));
        scrolledX=node.scrollLeft!==before;
      }
    }
    node=node.parentElement;
  }
  return scrolledX||scrolledY;
}

/** Touch/pen dragging starts from a dedicated touch-action:none handle. Desktop
 * mouse dragging and ordinary taps/scrolling elsewhere on the card stay native.
 */
export default function useTaskDrag(options:TaskDragOptions){
  const latest=useRef(options),session=useRef<DragSession|null>(null);
  const clickCleanup=useRef<{pointerId:number;remove:()=>void}|null>(null);
  useLayoutEffect(()=>{latest.current=options;});

  const cancelDrag=useCallback(()=>{
    const drag=session.current;
    if(!drag)return;
    session.current=null;
    cancelAnimationFrame(drag.frame);
    drag.removeListeners();
    drag.ghost?.remove();
    delete drag.handle.dataset.taskDragPressed;
    delete drag.card.dataset.taskDragging;
    if(drag.target)delete drag.target.dataset.taskDragOver;
    if(drag.handle.hasPointerCapture?.(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
    if(drag.active)latest.current.onDragChange?.(null);
  },[]);

  useEffect(()=>{
    if(!options.enabled)cancelDrag();
    return cancelDrag;
  },[options.enabled,cancelDrag]);
  useEffect(()=>()=>clickCleanup.current?.remove(),[]);

  const getHandleProps=useCallback((id:string)=>({
    onClick:(event:ReactMouseEvent<HTMLElement>)=>{
      const pending=clickCleanup.current;
      const pointerId="pointerId" in event.nativeEvent?event.nativeEvent.pointerId:undefined;
      if(!pending||event.detail===0||pointerId!==undefined&&pointerId!==pending.pointerId)return;
      event.preventDefault();event.stopPropagation();pending.remove();
    },
    onPointerDown:(event:ReactPointerEvent<HTMLElement>)=>{
      if(!latest.current.enabled||event.pointerType==="mouse"||event.button!==0||!event.isPrimary)return;
      if(session.current){cancelDrag();return;}
      const handle=event.currentTarget,card=handle.closest<HTMLElement>("[data-task-id]"),frame=latest.current.frameRef.current;
      if(!card||!frame?.contains(card))return;
      const origin=card.closest<HTMLElement>(targetSelector);
      event.stopPropagation();
      const rect=card.getBoundingClientRect();
      const drag:DragSession={id,pointerId:event.pointerId,handle,card,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,scale:rect.width/(card.offsetWidth||rect.width||1),active:false,ghost:null,target:null,frame:0,removeListeners:()=>{}};
      session.current=drag;
      handle.dataset.taskDragPressed="true";
      handle.setPointerCapture?.(event.pointerId);

      function findTarget(){
        const target=document.elementFromPoint(drag.x,drag.y)?.closest<HTMLElement>(targetSelector);
        if(!target||!latest.current.frameRef.current?.contains(target))return null;
        const sourceKind=drag.card.dataset.taskDragKind||"production",targetKind=target.dataset.taskDragKind;
        return !targetKind||targetKind===sourceKind?target:null;
      }
      function updateTarget(){
        const target=findTarget();
        if(target===drag.target)return;
        if(drag.target)delete drag.target.dataset.taskDragOver;
        drag.target=target;
        if(target)target.dataset.taskDragOver="true";
      }
      function draw(){
        drag.frame=0;
        if(session.current!==drag||!drag.active)return;
        if(!latest.current.frameRef.current?.contains(drag.card)){cancelDrag();return;}
        if(drag.ghost)drag.ghost.style.transform=`translate3d(${drag.x-drag.offsetX}px,${drag.y-drag.offsetY}px,0) scale(${drag.scale})`;
        updateTarget();
        if(scrollNearEdge(drag.target||latest.current.frameRef.current,drag.x,drag.y)){
          updateTarget();
          drag.frame=requestAnimationFrame(draw);
        }
      }
      function move(event:PointerEvent){
        if(event.pointerId!==drag.pointerId||session.current!==drag)return;
        drag.x=event.clientX;drag.y=event.clientY;
        if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=5){
          drag.active=true;drag.card.dataset.taskDragging="true";
          drag.ghost=makeGhost(drag.card);
          latest.current.onDragChange?.(drag.id);
        }
        if(drag.active)event.preventDefault();
        if(drag.active&&!drag.frame)drag.frame=requestAnimationFrame(draw);
      }
      function finish(event:PointerEvent){
        if(event.pointerId!==drag.pointerId||session.current!==drag)return;
        if(!latest.current.frameRef.current?.contains(drag.card)){cancelDrag();return;}
        drag.x=event.clientX;drag.y=event.clientY;
        const target=drag.active?findTarget():null;
        const date=target?.dataset.taskDate,department=target?.dataset.taskDepartment||drag.card.dataset.taskDepartment||origin?.dataset.taskDepartment;
        if(drag.active){
          event.preventDefault();
          clickCleanup.current?.remove();
          const blockClick=(click:MouseEvent)=>{
            if(click.detail===0)return;
            if("pointerId" in click&&click.pointerId!==drag.pointerId)return;
            click.preventDefault();click.stopPropagation();removeClick();
          };
          const timer=window.setTimeout(removeClick,400);
          function removeClick(){
            window.clearTimeout(timer);
            window.removeEventListener("click",blockClick,true);
            window.removeEventListener("pointerdown",removeClick,true);
            clickCleanup.current=null;
          }
          clickCleanup.current={pointerId:drag.pointerId,remove:removeClick};
          window.addEventListener("click",blockClick,true);
          window.addEventListener("pointerdown",removeClick,true);
        }
        cancelDrag();
        const changed=date!==origin?.dataset.taskDate||department!==origin?.dataset.taskDepartment;
        if(changed&&date&&department&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&latest.current.enabled)void latest.current.onMove(drag.id,date,department as DepartmentId);
      }
      const cancelPointer=(event:PointerEvent)=>{if(event.pointerId===drag.pointerId)cancelDrag();};
      const otherPointer=(event:PointerEvent)=>{if(event.pointerId!==drag.pointerId)cancelDrag();};
      const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();cancelDrag();}};
      const blur=()=>cancelDrag();
      window.addEventListener("pointermove",move,{passive:false});
      window.addEventListener("pointerup",finish);
      window.addEventListener("pointercancel",cancelPointer);
      window.addEventListener("pointerdown",otherPointer,true);
      window.addEventListener("keydown",key);
      window.addEventListener("blur",blur);
      handle.addEventListener("lostpointercapture",cancelPointer);
      drag.removeListeners=()=>{
        window.removeEventListener("pointermove",move);
        window.removeEventListener("pointerup",finish);
        window.removeEventListener("pointercancel",cancelPointer);
        window.removeEventListener("pointerdown",otherPointer,true);
        window.removeEventListener("keydown",key);
        window.removeEventListener("blur",blur);
        handle.removeEventListener("lostpointercapture",cancelPointer);
      };
    },
  }),[cancelDrag]);
  return {getHandleProps,cancelDrag};
}
