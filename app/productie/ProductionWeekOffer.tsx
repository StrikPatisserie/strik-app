"use client";

/* eslint-disable @next/next/no-img-element -- authenticated offer images use their existing source URLs. */

import { useEffect, useState } from "react";
import Icon from "./ProductionIcon";
import { addDays, weekNumber } from "./planning";
import type { LiveWorkspace } from "./workspaceData";
import s from "../preview/productie/production.module.css";

type Offer = NonNullable<LiveWorkspace["weeklyOffers"]>[number];
type Props = {
  offers?: LiveWorkspace["weeklyOffers"];
  week: string;
  paused: boolean;
  onOpen: (week: string, offer: Offer) => void;
  onManage?: (week: string) => void;
};

export default function ProductionWeekOffer({ offers, week, paused, onOpen, onManage }: Props) {
  const [nextWeek, setNextWeek] = useState(false);
  const followingWeek = addDays(week, 7);
  const currentImage = offers?.find(offer => offer.weekStart === week)?.imageUrl;
  const followingImage = offers?.find(offer => offer.weekStart === followingWeek)?.imageUrl;
  const selectedWeek = nextWeek ? followingWeek : week;
  const offer = offers?.find(item => item.weekStart === selectedWeek);
  const label = nextWeek ? "Volgende week" : "Deze week";

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setNextWeek(value => !value), 10_000);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    for (const src of new Set([currentImage, followingImage])) {
      if (src) {
        const image = new Image();
        image.src = src;
      }
    }
  }, [currentImage, followingImage]);

  return <section className={s.offerWrap} aria-label="Weekaanbiedingen">
    <div className={s.offerHeading}>
      <span>{label}</span>
      {onManage && <button type="button" className={s.offerEdit} title="Aanbieding beheren" aria-label="Aanbieding beheren" onClick={() => onManage(selectedWeek)}><Icon name="settings" size={16}/></button>}
    </div>
    <OfferImage key={`${selectedWeek}:${offer?.imageUrl || ""}`} offer={offer} label={label} week={selectedWeek} onOpen={() => { if (offer) onOpen(selectedWeek, offer); }}/>
  </section>;
}

function OfferImage({ offer, label, week, onOpen }: { offer?: Offer; label: string; week: string; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const available = !!offer?.imageUrl && !failed;
  return <button type="button" className={s.offerTile} disabled={!available} aria-label={available ? "Weekaanbieding vergroten" : "Nog geen aanbieding"} onClick={onOpen}>
    {available ? <>
      {!loaded && <span className={s.offerSpinner} role="status" aria-label="Aanbieding laden"/>}
      <img src={offer.imageUrl} alt={`${label} · week ${weekNumber(week)}`} style={{ visibility: loaded ? "visible" : "hidden" }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}/>
    </> : "Nog geen aanbieding"}
  </button>;
}
