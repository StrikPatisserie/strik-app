import { compactWorkRow, workOverviewHeading, type WorkOverviewOptions, type WorkOverviewRow } from "./workOverview";

type Line = {text:string;bold?:boolean};
type Block = {cells:Line[][];height:number};
type Page = Block[];
const mm=72/25.4, width=210*mm, height=297*mm, margin=7*mm;
const available=width-2*margin, columns=[available*.20,available*.66,available*.14];
const bodyTop=margin+57, bodyBottom=height-margin-17, bodyHeight=bodyBottom-bodyTop;

/** Measure and draw from the same layout. Never truncate an order or shrink below 8 pt. */
export async function createWorkOverviewPdf(rows:WorkOverviewRow[],options:WorkOverviewOptions) {
  const {PDFDocument,PDFName}=await import('pdf-lib');
  const pdf=await PDFDocument.create();
  const canvas=document.createElement('canvas');
  const scale=3;
  canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Het afdrukvoorbeeld kon niet worden gemaakt. Probeer het opnieuw.');
  ctx.scale(scale,scale);ctx.textBaseline='top';
  const data=rows.map(row=>compactWorkRow(row,options)),heading=workOverviewHeading(rows,options);
  function font(size:number,bold=false){ctx!.font=`${bold?700:400} ${size}px Arial, sans-serif`;}
  function wrap(text:string,maxWidth:number,size:number,bold=false):Line[]{
    font(size,bold);let line='';const result:Line[]=[];
    for(const word of text.split(/\s+/).filter(Boolean)){
      if(line&&ctx!.measureText(`${line} ${word}`).width>maxWidth){result.push({text:line,bold});line='';}
      if(ctx!.measureText(word).width>maxWidth){
        for(const char of Array.from(word)){
          if(line&&ctx!.measureText(line+char).width>maxWidth){result.push({text:line,bold});line='';}
          line+=char;
        }
      }else line+=`${line?' ':''}${word}`;
    }
    if(line)result.push({text:line,bold});return result;
  }
  function layout(size:number):Page[]{
    const sizes=[size-1,size,size-1],leading=sizes.map(value=>value*1.16),padding=2.5;
    const pages:Page[]=[[]];let used=0;
    const next=()=>{pages.push([]);used=0;};
    function add(cells:Line[][]){const block={cells,height:Math.max(...cells.map((cell,i)=>cell.length*leading[i]))+2*padding};if(used+block.height>bodyHeight&&pages.at(-1)!.length)next();pages.at(-1)!.push(block);used+=block.height;}
    for(const row of data){
      const cells=[
        [...wrap(row.customer,columns[0]-8,sizes[0],true),...wrap(row.delivery,columns[0]-8,sizes[0],true)],
        [...row.products.flatMap(product=>wrap(product,columns[1]-8,size,true)),...wrap(row.notes.join(' • '),columns[1]-8,size),...wrap(row.location,columns[1]-8,size)],
        [...row.states.flatMap(state=>wrap(`${state.done?'☑':'☐'} ${state.label}`,columns[2]-8,sizes[2])),...wrap(row.logo,columns[2]-8,sizes[2],true)],
      ];
      const maxLines=leading.map(value=>Math.floor((bodyHeight-2*padding)/value));
      const parts=Math.max(...cells.map((cell,i)=>Math.ceil(cell.length/maxLines[i])));
      if(parts<=1){add(cells);continue;}
      // An unusually long custom order continues safely, with its customer repeated.
      if(pages.at(-1)!.length)next();
      for(let part=0;part<parts;part++){
        const slice=cells.map((cell,i)=>cell.slice(part*maxLines[i],(part+1)*maxLines[i]));
        if(part&&!slice[0].length)slice[0]=wrap(`${row.customer} (vervolg)`,columns[0]-8,sizes[0],true).slice(0,maxLines[0]);
        add(slice);
      }
    }
    return pages;
  }
  let fontSize=9,pages=layout(fontSize);
  for(const size of [8.5,8]){if(pages.length<=2)break;const smaller=layout(size);if(smaller.length<pages.length){fontSize=size;pages=smaller;}}
  const previews:string[]=[];
  for(const [index,blocks] of pages.entries()){
    ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.fillStyle='#1b3343';
    font(13,true);ctx.fillText(heading.title,margin,margin);
    font(8.5);ctx.fillText(heading.period,margin,margin+18);
    font(7.5);ctx.fillText(heading.summary,margin,margin+30);
    ctx.fillStyle='#eaf0e5';ctx.fillRect(margin,margin+43,available,14);ctx.fillStyle='#1b3343';font(7.5,true);
    let x=margin;['Klant · levering','Bestelling · voorbereiden & inpakken','Status'].forEach((label,i)=>{ctx!.fillText(label,x+4,margin+46);x+=columns[i];});
    let y=bodyTop;
    for(const block of blocks){
      x=margin;
      block.cells.forEach((cell,i)=>{
        for(const [lineIndex,line] of cell.entries()){const size=i===1?fontSize:fontSize-1;font(size,line.bold);ctx!.fillStyle='#172b25';ctx!.fillText(line.text,x+4,y+2.5+lineIndex*size*1.16);}
        x+=columns[i];
      });
      y+=block.height;ctx.strokeStyle='#bac5bd';ctx.lineWidth=.4;ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(width-margin,y);ctx.stroke();
    }
    font(6.8);ctx.fillStyle='#526357';ctx.fillText(heading.footer,margin,height-margin-9);
    font(7,true);const count=`${index+1} / ${pages.length}`;ctx.fillText(count,width-margin-ctx.measureText(count).width,height-margin-9);
    const image=canvas.toDataURL('image/png');previews.push(image);
    const artwork=await pdf.embedPng(image);const page=pdf.addPage([width,height]);page.drawImage(artwork,{x:0,y:0,width,height});
  }
  pdf.setTitle(`${heading.title} ${options.from}${options.to?` t-m ${options.to}`:''}`);
  pdf.catalog.set(PDFName.of('ViewerPreferences'),pdf.context.obj({PrintScaling:PDFName.of('None')}));
  const bytes=await pdf.save();
  return {blob:new Blob([bytes as BlobPart],{type:'application/pdf'}),previews,pages:pages.length,fontSize};
}
