"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductionWordmark } from "../StrikUI";
import Icon, { type IconName } from "./ProductionIcon";
import { PRODUCTION_HOME, type ProductionView } from "./navigation";
import type { BoardId } from "./planning";
import s from "../preview/productie/production.module.css";

const sections: { id: string; label: string; icon: IconName; href: string; manager?: boolean }[] = [
  { id: "planning", label: "Weekplanning", icon: "grid", href: PRODUCTION_HOME },
  { id: "holidays", label: "Feestdagen", icon: "gift", href: `${PRODUCTION_HOME}/feestdagen/sint` },
  { id: "roster", label: "Personeelsrooster", icon: "users", href: `${PRODUCTION_HOME}/rooster` },
  { id: "recipes", label: "Recepten", icon: "book", href: `${PRODUCTION_HOME}?view=recipes` },
  { id: "ingredients", label: "Grondstoffen", icon: "leaf", href: `${PRODUCTION_HOME}?view=ingredients` },
  { id: "haccp", label: "HACCP & registraties", icon: "check", href: `${PRODUCTION_HOME}/haccp` },
  { id: "stock", label: "Productieregistraties", icon: "stock", href: `${PRODUCTION_HOME}?view=stock` },
  { id: "data", label: "Receptuurbeheer", icon: "settings", href: `${PRODUCTION_HOME}/beheer/recepten`, manager: true },
  { id: "weddings", label: "Bruidstaartproductie", icon: "book", href: `${PRODUCTION_HOME}?board=patisserie&department=bruidstaarten` },
  { id: "orders", label: "IJsgrondstoffen bestellen", icon: "box", href: `${PRODUCTION_HOME}/bestellen`, manager: true },
];
type Props = { active: string; canManage: boolean; canBakery?: boolean; demo?: boolean; onNavigate?: (view: ProductionView) => void };

function availableSections(canManage: boolean, demo: boolean, canBakery: boolean) {
  return sections.filter(section => (!section.manager || canManage) && (section.id !== "weddings" || canBakery) && (!demo || !["packaging", "haccp", "data", "weddings", "orders"].includes(section.id)));
}

export default function ProductionNavigation({ active, canManage, canBakery = true, demo = false, boards, activeBoard, onNavigate, onBoard }: Props & {
  boards: { id: BoardId; name: string }[]; activeBoard?: BoardId; onBoard?: (board: BoardId) => void;
}) {
  return <aside className={s.sidebar}>
    <Link href="/" className={s.returnToTeam}><Icon name="back" size={17}/><span>Strik-app · hoofdmenu</span></Link>
    <Link href={demo ? "/preview/productie" : PRODUCTION_HOME} className={s.brand} aria-label="STRAK gepland"><ProductionWordmark className={s.wordmark}/></Link>
    <span className={s.sidebarCaption}>WERKPLEK</span>
    <nav aria-label="Productiemenu">{availableSections(canManage, demo, canBakery).map(section => {
      const content = <><Icon name={section.icon} /><span>{section.label}</span></>;
      return onNavigate && ["planning", "catalog", "recipes", "ingredients", "stock"].includes(section.id)
        ? <button key={section.id} onClick={() => onNavigate(section.id as ProductionView)} aria-current={active === section.id ? "page" : undefined}>{content}</button>
        : <Link key={section.id} href={section.href} aria-current={active === section.id ? "page" : undefined}>{content}</Link>;
    })}</nav>
    <div className={s.sidebarBoards}><span className={s.sidebarCaption}>PLANNINGEN</span>{boards.map(board => {
      const content = <><span className={`${s.boardDot} ${s[`board_${board.id}`]}`} />{board.name}{active === "planning" && activeBoard === board.id && <Icon name="chevron" size={12} />}</>;
      return onBoard ? <button key={board.id} onClick={() => onBoard(board.id)} aria-current={active === "planning" && activeBoard === board.id ? "true" : undefined}>{content}</button> : <Link key={board.id} href={`${PRODUCTION_HOME}?board=${board.id}`}>{content}</Link>;
    })}</div>
    <div className={s.sidebarBottom}>{onNavigate ? <button onClick={() => onNavigate("settings")} aria-current={active === "settings" ? "page" : undefined}><Icon name="settings" />Instellingen</button> : <Link href={`${PRODUCTION_HOME}?view=settings`}><Icon name="settings" />Instellingen</Link>}<span>STRAK gepland · voor Strik</span></div>
  </aside>;
}

export function ProductionMobileNavigation({ active, canManage, canBakery = true, demo = false, onNavigate }: Props) {
  const router = useRouter();
  const options = [...availableSections(canManage, demo, canBakery), { id: "settings", label: "Instellingen", href: `${PRODUCTION_HOME}?view=settings` }];
  return <div className={s.mobileNav}><label><span className={s.srOnly}>Onderdeel van Productie</span><select value={active} onChange={event => {
    const selected = options.find(option => option.id === event.target.value)!;
    if (onNavigate && ["planning", "catalog", "recipes", "ingredients", "stock", "settings"].includes(selected.id)) onNavigate(selected.id as ProductionView);
    else router.push(selected.href);
  }}>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><Link href="/" aria-label="Strik-app · hoofdmenu"><Icon name="back" /></Link></div>;
}
