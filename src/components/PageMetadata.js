import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pageMetadata, SITE_URL } from "../pageMetadata";

export function PageMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = pageMetadata[pathname] || pageMetadata["/"];
    document.title = page.title;
    const canonical = SITE_URL + page.path;
    const values = { 'meta[name="description"]': page.description, 'meta[property="og:title"]': page.title, 'meta[property="og:description"]': page.description, 'meta[property="og:url"]': canonical, 'meta[name="twitter:title"]': page.title, 'meta[name="twitter:description"]': page.description, 'meta[name="twitter:url"]': canonical };
    Object.entries(values).forEach(([selector, value]) => document.querySelector(selector)?.setAttribute("content", value));
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
    const structured = document.querySelector('script[type="application/ld+json"]');
    if (structured) structured.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "JSONEditor", url: canonical, description: page.description, applicationCategory: "DeveloperApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } });
  }, [pathname]);
  return null;
}
