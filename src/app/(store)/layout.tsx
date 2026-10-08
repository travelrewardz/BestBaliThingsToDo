import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSeoSettings } from "@/lib/seo";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const seo = await getSeoSettings();
  return (
    <>
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
      {seo.tagManagerId && (
        <Script
          id="gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.tagManagerId}');`,
          }}
        />
      )}
      {!seo.tagManagerId && seo.analyticsId && (
        <Script
          id="ga4"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${seo.analyticsId}`}
        />
      )}
      {!seo.tagManagerId && seo.analyticsId && (
        <Script
          id="ga4-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seo.analyticsId}');`,
          }}
        />
      )}
    </>
  );
}
