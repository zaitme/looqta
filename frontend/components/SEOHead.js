'use client';
import Head from 'next/head';

/**
 * SEO Head Component
 * Provides comprehensive SEO meta tags including Open Graph and Twitter Cards
 */
export default function SEOHead({
  title = 'Looqta (لقطة) — Smart Price Comparison Platform',
  description = 'Compare prices from Amazon and Noon in real-time. Find the best deals on products in Saudi Arabia. Smart choices for smart shoppers.',
  image = '/og-image.jpg',
  url = '',
  type = 'website',
  product = null, // For product pages
  price = null,
  currency = 'SAR'
}) {
  const siteUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://looqta.com';
  
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl;
  const fullImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
  
  // Product-specific meta tags
  const productTitle = product 
    ? `${product.product_name || product.name} - ${title}`
    : title;
  
  const productDescription = product
    ? `Best price: ${price || product.price} ${currency || product.currency || 'SAR'} on ${product.site || 'Looqta'}. Compare prices from Amazon and Noon.`
    : description;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{productTitle}</title>
      <meta name="description" content={productDescription} />
      <meta name="keywords" content="price comparison, Amazon, Noon, Saudi Arabia, online shopping, best deals, compare prices, لقطة" />
      <meta name="author" content="Looqta" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="language" content="English, Arabic" />
      <meta name="geo.region" content="SA" />
      <meta name="geo.placename" content="Saudi Arabia" />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={productTitle} />
      <meta property="og:description" content={productDescription} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Looqta" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:locale:alternate" content="ar_SA" />
      
      {/* Product-specific Open Graph tags */}
      {product && (
        <>
          <meta property="product:price:amount" content={price || product.price || '0'} />
          <meta property="product:price:currency" content={currency || product.currency || 'SAR'} />
          <meta property="product:availability" content="in stock" />
          <meta property="product:condition" content="new" />
          <meta property="product:retailer" content={product.site || 'Looqta'} />
        </>
      )}
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content={product ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={productTitle} />
      <meta name="twitter:description" content={productDescription} />
      <meta name="twitter:image" content={fullImage} />
      <meta name="twitter:site" content="@looqta" />
      <meta name="twitter:creator" content="@looqta" />
      
      {/* WhatsApp Meta Tags */}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content="image/jpeg" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />
      
      {/* Favicon */}
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <meta name="googlebot" content="index, follow" />
      <meta name="bingbot" content="index, follow" />
      
      {/* Structured Data */}
      {product && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              "name": product.product_name || product.name,
              "image": product.image || product.image_url || fullImage,
              "description": productDescription,
              "brand": {
                "@type": "Brand",
                "name": product.site || "Looqta"
              },
              "offers": {
                "@type": "Offer",
                "url": product.url || fullUrl,
                "priceCurrency": currency || product.currency || "SAR",
                "price": price || product.price || "0",
                "priceValidUntil": new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                "availability": "https://schema.org/InStock",
                "seller": {
                  "@type": "Organization",
                  "name": product.site || "Looqta"
                }
              },
              "aggregateRating": product.seller_rating ? {
                "@type": "AggregateRating",
                "ratingValue": product.seller_rating,
                "reviewCount": product.seller_rating_count || 0
              } : undefined
            })
          }}
        />
      )}
      
      {/* Website Structured Data */}
      {!product && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Looqta",
              "alternateName": "لقطة",
              "url": siteUrl,
              "description": description,
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": `${siteUrl}/?q={search_term_string}`
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      )}
    </Head>
  );
}
