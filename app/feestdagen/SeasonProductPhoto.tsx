'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from 'react';
import {productMoney,productPhotoUrl,type SeasonProduct} from './assortment';
import styles from './Feestdagen.module.css';

export default function SeasonProductPhoto({product,onClose}:{product:SeasonProduct;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const element=dialog.current,previous=document.activeElement as HTMLElement|null;
  element?.showModal();
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{element?.close();document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 return <dialog ref={dialog} className={styles.productPhotoDialog} aria-label={`Foto van ${product.name}`} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className={styles.productPhotoContent}>
   <button type="button" className={styles.photoClose} aria-label="Foto sluiten" autoFocus onClick={onClose}>×</button>
   {product.photo_id&&!failed?<img src={productPhotoUrl(product.photo_id)} alt={product.name} onError={()=>setFailed(true)}/>:<p className={styles.photoUnavailable}>De foto is niet beschikbaar.</p>}
   <footer><h2>{product.name}</h2><p>{/^Vanafprijs\b/.test(product.variant)?'Vanaf ':''}{productMoney(product.price_cents)} <small>{product.price_includes_vat?'incl.':'excl.'} btw</small></p></footer>
  </div>
 </dialog>;
}
