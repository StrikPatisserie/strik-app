"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function getBaseFontSize(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const longestWordLength = Math.max(0, ...words.map((word) => word.length));

  if (longestWordLength >= 15) return 2.75;
  if (longestWordLength >= 13) return 3.25;
  if (longestWordLength >= 10) return 3.85;
  if (title.length > 22) return 2.85;
  if (title.length > 14) return 3.35;

  return 4.35;
}

export default function StrikPageTitle({ title }: Readonly<{ title: string }>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const baseFontSize = useMemo(() => getBaseFontSize(title), [title]);
  const [fontSize, setFontSize] = useState(baseFontSize);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const heading = titleRef.current;
    if (!wrapper || !heading) return;

    function fitTitle() {
      const currentWrapper = wrapperRef.current;
      const currentHeading = titleRef.current;
      if (!currentWrapper || !currentHeading) return;

      const wrapperWidth = currentWrapper.clientWidth;
      if (!wrapperWidth) return;

      currentHeading.style.fontSize = `${baseFontSize}rem`;

      const scale = Math.min(
        1,
        wrapperWidth / Math.max(currentHeading.scrollWidth, 1)
      );
      const nextFontSize = Math.max(2.35, baseFontSize * scale);

      setFontSize(Number(nextFontSize.toFixed(3)));
    }

    fitTitle();

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(fitTitle);
    });
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [baseFontSize, title]);

  return (
    <div ref={wrapperRef} className="w-full">
      <h1
        ref={titleRef}
        className="inline-block max-w-full whitespace-normal break-normal leading-tight font-bold text-[#1a1815]"
        style={{
          fontSize: `${fontSize}rem`,
          hyphens: "none",
          letterSpacing: "-0.02em",
          overflowWrap: "normal",
          wordBreak: "normal",
        }}
      >
        {title}
      </h1>
    </div>
  );
}
