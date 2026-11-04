import "server-only";
import {PDFDocument,type PDFImage,type PDFEmbeddedPage} from "pdf-lib";
import {logoPrintLayout,type PrintLogo} from "./model";
type FileLogo={id:string;content_type:string;bytes_base64:string};
const cm=72/2.54;
export async function createLogoPrint(items:PrintLogo[],files:FileLogo[]) {
 const layout=logoPrintLayout(items),pdf=await PDFDocument.create();
 const images=new Map<string,PDFImage|PDFEmbeddedPage>();
 for(const id of new Set(layout.map(cell=>cell.id))) {
  const file=files.find(file=>file.id===id);if(!file)throw Error("Een gekozen logo is niet meer beschikbaar. Vernieuw de lijst.");
  const bytes=Buffer.from(file.bytes_base64,"base64");
  try {
   if(file.content_type==="application/pdf") {
    const source=await PDFDocument.load(bytes);if(!source.getPageCount())throw Error("empty");
    const page=await pdf.embedPage(source.getPage(0));images.set(id,page);
   } else if(file.content_type==="image/jpeg")images.set(id,await pdf.embedJpg(bytes));
   else if(file.content_type==="image/png")images.set(id,await pdf.embedPng(bytes));
   else if(file.content_type==="image/webp") {
    const {createCanvas,loadImage}=await import("@napi-rs/canvas");const image=await loadImage(bytes);
    if(image.width*image.height>25000000)throw Error("large");
    const canvas=createCanvas(image.width,image.height);canvas.getContext("2d").drawImage(image,0,0);images.set(id,await pdf.embedPng(canvas.toBuffer("image/png")));
   } else throw Error("type");
  }catch {throw Error("Een logo kan niet worden verwerkt. Gebruik een geldige PNG, JPG, WebP of een onbeveiligde PDF.");}
 }
 for(const cell of layout) {
  while(pdf.getPageCount()<=cell.page){const page=pdf.addPage();page.setSize(21*cm,29.7*cm);}
  const page=pdf.getPage(cell.page),image=images.get(cell.id)!;
  const scale=Math.min(cell.width*cm/image.width,cell.height*cm/image.height);
  const width=image.width*scale,height=image.height*scale;
  const options={x:cell.x*cm+(cell.width*cm-width)/2,y:(29.7-cell.y-cell.height)*cm+(cell.height*cm-height)/2,width,height};
  if(files.find(file=>file.id===cell.id)?.content_type==="application/pdf")page.drawPage(image as PDFEmbeddedPage,options);
  else page.drawImage(image as PDFImage,options);
 }
 pdf.setTitle("B2B logo printvel");pdf.setCreator("Strik Team app");return pdf.save();
}
