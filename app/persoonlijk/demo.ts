import type { PersonalNote } from "./model";
export const personalDemo:PersonalNote[]=[
 {id:"00000000-0000-4000-8000-000000000001",title:"Mijn to-do’s",notebook:"TO DO",body:"Deze week\n\n[ ] Nieuwe verpakkingen bekijken\n[ ] Voorstel voor de feestdagen bespreken\n[x] Weekplanning controleren\n\nIdee: een klein cadeautje bij de eerste bestelling.",tags:["Deze week"],pinned:true},
 {id:"00000000-0000-4000-8000-000000000002",title:"Ideeën voor later",notebook:"Vergaderingen",body:"Een plek om gedachten te bewaren.\n\n[ ] Fotolijst voor het voorjaar maken\n\nDit zijn fictieve voorbeeldgegevens. Je echte Evernote-notities staan hier nog niet.",tags:[],pinned:false},
 {id:"00000000-0000-4000-8000-000000000003",title:"Handige gegevens",notebook:"Belangrijke gegevens",body:"Leveranciers, links, gespreksnotities en afspraken komen hier bij elkaar.\n\nDeze preview bewaart wijzigingen alleen zolang dit venster openstaat.",tags:[],pinned:false},
].map(note=>({...note,archived:false,attachments:[],source_hash:null,source_created_at:null,source_updated_at:null,revision:1,created_at:"2026-10-28T08:00:00Z",updated_at:"2026-10-28T08:00:00Z"}));
