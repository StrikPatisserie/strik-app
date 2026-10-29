import type {PersonalNote,PersonalNoteInput} from './model';
export type NoteTimeline={past:PersonalNoteInput[];present:PersonalNoteInput;future:PersonalNoteInput[];revision:number;group:string|null;at:number};
export function noteSnapshot(note:PersonalNoteInput):PersonalNoteInput{
 const {id,title,notebook,body,tags,pinned,archived,attachments,source_hash,source_created_at,source_updated_at}=note;
 return{id,title,notebook,body,tags:[...tags],pinned,archived,attachments:attachments.map(file=>({...file})),source_hash,source_created_at,source_updated_at};
}
const same=(a:PersonalNoteInput,b:PersonalNoteInput)=>JSON.stringify(a)===JSON.stringify(b);
function bounded(entries:PersonalNoteInput[]){let size=0;return entries.slice(-30).reverse().filter(note=>{size+=JSON.stringify(note).length;return size<=4000000;}).reverse();}
export function startTimeline(note:PersonalNote):NoteTimeline{return{past:[],present:noteSnapshot(note),future:[],revision:note.revision,group:null,at:0};}
export function recordTimeline(state:NoteTimeline,next:PersonalNoteInput,group:string|null=null,now=Date.now()):NoteTimeline{
 if(next.id!==state.present.id)throw Error('De wijziging hoort bij een andere notitie.');
 const snapshot=noteSnapshot(next);if(same(state.present,snapshot))return state;
 const coalesce=group!==null&&state.group===group&&now-state.at<750&&now>=state.at&&state.future.length===0;
 return{...state,past:coalesce?state.past:bounded([...state.past,state.present]),present:snapshot,future:[],group,at:now};
}
export function stepTimeline(state:NoteTimeline,direction:'undo'|'redo'):NoteTimeline|null{
 const entries=direction==='undo'?state.past:state.future;if(!entries.length)return null;
 return{...state,present:entries[entries.length-1],past:direction==='undo'?state.past.slice(0,-1):bounded([...state.past,state.present]),future:direction==='undo'?bounded([...state.future,state.present]):state.future.slice(0,-1),group:null,at:0};
}
export function acceptTimeline(state:NoteTimeline,note:PersonalNote):NoteTimeline{return{...recordTimeline(state,note),revision:note.revision,group:null,at:0};}
export function reopenTimeline(state:NoteTimeline|undefined,note:PersonalNote):NoteTimeline{
 return state&&state.revision===note.revision&&same(state.present,noteSnapshot(note))?state:startTimeline(note);
}
