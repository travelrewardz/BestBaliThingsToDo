import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/supplier", "/account", "/checkout", "/api/", "/voucher/"],
      },
      {
        userAgent: ["GPTBot", "CCBot", "Google-Extended"],
        disallow: "/",
      },
    ],
    sitemap: "https://www.balithingstodo.net/sitemap.xml",
    host: "https://www.balithingstodo.net",
  };
}
