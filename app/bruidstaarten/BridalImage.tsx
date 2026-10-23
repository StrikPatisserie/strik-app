"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";
import { WEDDING_APP_ORIGIN } from "../lib/weddingPublicSite";

function websiteLoader({ src, width, quality }: ImageLoaderProps) {
  return `${WEDDING_APP_ORIGIN}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
}

export default function BridalImage({ website = false, alt, ...props }: ImageProps & { website?: boolean }) {
  if (!website) return <Image {...props} alt={alt} />;
  if (typeof props.src === "string" && props.src.endsWith(".svg")) {
    return <Image {...props} alt={alt} src={`${WEDDING_APP_ORIGIN}${props.src}`} unoptimized />;
  }
  return <Image {...props} alt={alt} loader={websiteLoader} />;
}
