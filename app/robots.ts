import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/login", "/reset-password", "/update-password"] },
    sitemap: "https://strik-patisserie.nl/bruidstaarten-sitemap.xml",
  };
}
