"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChristmasStory } from "./christmasProducts";
import styles from "./ChristmasFolder.module.css";

function PlayIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6a1.57 1.57 0 0 1 0 2.72l-10 6A1 1 0 0 1 8 18.5Z" /></svg>;
}

function PauseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
}

export default function ProductMediaGallery({ name, image, story, eager = false, imageNote }: Readonly<{
  name: string;
  image: string;
  story?: ChristmasStory;
  eager?: boolean;
  imageNote?: string;
}>) {
  const viewport = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const navigationTarget = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(true);

  const showSlide = useCallback((next: number) => {
    if (!story || !viewport.current) return;
    setPlaying(next === 1);
    setFailed(false);
    if (next === 1 && !video.current) setPaused(true);
    if (next === 1 && video.current) {
      // Autoplay interruptions leave our play button available.
      void video.current.play().catch(() => {});
    }
    const left = next * viewport.current.clientWidth;
    navigationTarget.current = Math.abs(viewport.current.scrollLeft - left) > 1 ? next : null;
    if (navigationTarget.current === null) setIndex(next);
    viewport.current.scrollTo({
      left,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [story]);

  function togglePlayback() {
    const player = video.current;
    if (!player) return;
    if (paused) void player.play().catch(() => setPaused(true));
    else player.pause();
  }

  // Unplayed, paused and interrupted clips return to the product photo.
  useEffect(() => {
    if (index !== 1) return;
    let timer: number | undefined;
    const cancelReturn = () => { window.clearTimeout(timer); };
    const scheduleReturn = () => {
      cancelReturn();
      timer = window.setTimeout(() => showSlide(0), 15_000);
    };
    const player = video.current;
    if (!player || player.paused || player.readyState < 3) scheduleReturn();
    player?.addEventListener("playing", cancelReturn);
    player?.addEventListener("pause", scheduleReturn);
    player?.addEventListener("waiting", scheduleReturn);
    player?.addEventListener("ended", scheduleReturn);
    return () => {
      cancelReturn();
      player?.removeEventListener("playing", cancelReturn);
      player?.removeEventListener("pause", scheduleReturn);
      player?.removeEventListener("waiting", scheduleReturn);
      player?.removeEventListener("ended", scheduleReturn);
    };
  }, [index, playing, failed, showSlide]);

  // A clip also stops when the visitor scrolls past the card or switches tabs.
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) player.pause();
    });
    observer.observe(player);
    const pauseWhenHidden = () => { if (document.hidden) player.pause(); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      player.pause();
    };
  }, [index, playing, failed]);

  return <div className={`${styles.productImage} ${styles.mediaGallery}`} role={story ? "region" : undefined} aria-label={story ? `Foto en maakvideo van ${name}` : undefined} aria-roledescription={story ? "carrousel" : undefined}>
    <div
      ref={viewport}
      className={styles.mediaViewport}
      tabIndex={story ? 0 : undefined}
      aria-label={story ? `Blader door ${name}; gebruik de pijltjestoetsen of swipe` : undefined}
      onPointerDown={() => { navigationTarget.current = null; }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !story) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          showSlide(event.key === "ArrowRight" ? 1 : 0);
        }
      }}
      onScroll={(event) => {
        const width = event.currentTarget.clientWidth;
        if (!width) return;
        const next = Math.max(0, Math.min(story ? 1 : 0, Math.round(event.currentTarget.scrollLeft / width)));
        if (navigationTarget.current !== null && next !== navigationTarget.current) return;
        navigationTarget.current = null;
        if (next === index) return;
        setIndex(next);
        if (next === 0) setPlaying(false);
      }}
    >
      <div className={styles.mediaSlide} inert={index !== 0} aria-hidden={index !== 0}>
        <Image src={image} alt={name} fill sizes="(max-width: 760px) 40vw, 33vw" loading={eager ? "eager" : "lazy"} className={styles.cover} />
        {imageNote && <span className={styles.imageNote}>{imageNote}</span>}
      </div>
      {story && <div className={`${styles.mediaSlide} ${styles.storySlide}`} inert={index !== 1} aria-hidden={index !== 1}>
        {failed ? <div className={styles.mediaError} role="status"><p>De video kon niet worden geladen.</p><button type="button" onClick={() => showSlide(0)}>Terug naar de productfoto</button></div>
          : index === 1 && playing ? <>
            {/* Native mobile controls dim playing videos until the first tap. */}
            <video ref={video} src={story.src} poster={story.poster} aria-label={story.description} autoPlay muted playsInline preload="none" onPlaying={() => setPaused(false)} onPause={() => setPaused(true)} onEnded={() => setPaused(true)} onError={() => setFailed(true)} className={styles.storyVideo}>
              Je browser kan deze video niet afspelen.
            </video>
            <button type="button" className={styles.videoPlayback} aria-label={paused ? `Speel de maakvideo van ${name} af` : `Pauzeer de maakvideo van ${name}`} onClick={togglePlayback}><span>{paused ? <PlayIcon /> : <PauseIcon />}</span></button>
          </>
          : <>
            <Image src={story.poster} alt={story.description} fill sizes="(max-width: 760px) 40vw, 33vw" className={styles.storyPoster} />
            <button type="button" className={styles.storyPlay} aria-label={`Speel de maakvideo van ${name} af`} onClick={() => { setFailed(false); setPaused(true); setPlaying(true); }}><span><PlayIcon /></span></button>
            <span className={styles.silentBadge}>Zonder geluid</span>
          </>}
      </div>}
    </div>
    {story && <>
      <div className={styles.mediaTabs} role="group" aria-label={`Beeldkeuze ${name}`}>
        <button type="button" aria-pressed={index === 0} aria-label={`Bekijk de productfoto van ${name}`} onClick={() => showSlide(0)}>Foto</button>
        <button type="button" aria-pressed={index === 1} aria-label={`Bekijk hoe we ${name} maken`} onClick={() => showSlide(1)}><PlayIcon /> Zo maken we &apos;m</button>
      </div>
      <button type="button" className={`${styles.mediaArrow} ${index === 1 ? styles.mediaBack : styles.mediaNext}`} aria-label={index === 0 ? `Volgende: maakvideo van ${name}` : `Vorige: productfoto van ${name}`} onClick={() => showSlide(index === 0 ? 1 : 0)}>{index === 0 ? "›" : "‹"}</button>
      <span className={styles.mediaStatus} aria-live="polite">{index === 0 ? "Productfoto, 1 van 2" : "Zo maken we 'm, 2 van 2"}</span>
    </>}
  </div>;
}
