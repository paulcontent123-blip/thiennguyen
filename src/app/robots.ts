import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/wallet", "/organization", "/personal-campaigns", "/campaign-management", "/campaign-closure", "/rescue/operations", "/rescue/accept", "/login", "/register", "/reset-password", "/forbidden"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
