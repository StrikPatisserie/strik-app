import type { ReactNode } from "react";
export type IconName = "grid" | "book" | "box" | "leaf" | "stock" | "settings" | "arrow" | "plus" | "chevron" | "check" | "clock" | "screen" | "close" | "search" | "warning" | "link" | "back" | "move" | "play";

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18M9 10v11M15 10v11M8 2v4M16 2v4" /></>,
    book: <><path d="M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v16" /></>,
    box: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5" /></>,
    leaf: <><path d="M20 3C5 1 1 9 7 16c7 6 15 2 13-13ZM4 21 16 8" /></>,
    stock: <><path d="M3 3v18h18M7 17v-4h3v4M13 17V8h3v9M19 17V4h2v13" /></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M12 17v4M7 21h10" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    warning: <><path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01" /></>,
    link: <><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(0 1) scale(.9)" /></>,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    move: <><path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" /></>,
    play: <path d="m8 4 12 8-12 8V4Z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
