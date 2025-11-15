'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import PriceHistoryChart from '../../components/PriceHistoryChart';
import PriceAlertForm from '../../components/PriceAlertForm';
import SellerBadge from '../../components/SellerBadge';
import WhatsAppShare from '../../components/WhatsAppShare';
import { generateProductId, getAffiliateUrl } from '../../utils/productUtils';

/**
 * Product Detail Page
 * Shows product information, price history, alerts, and seller badges
 */
export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [affiliateUrl, setAffiliateUrl] = useState(null);

  useEffect(() => {
    if (!id) return;

    // In a real app, you'd fetch product by ID from API
    // For now, we'll extract from URL or use localStorage
    const storedProduct = localStorage.getItem(`product_${id}`);
    if (storedProduct) {
      try {
        const productData = JSON.parse(storedProduct);
        setProduct(productData);
        
        // Generate product ID if not present
        if (!productData.productId && productData.url && productData.site) {
          productData.productId = generateProductId(productData.url, productData.site);
        }

        // Get affiliate URL
        if (productData.url && productData.site) {
          getAffiliateUrl({
            url: productData.url,
            site: productData.site,
            productId: productData.productId || generateProductId(productData.url, productData.site),
            productName: productData.product_name,
            affiliateUrl: productData.affiliate_url || productData.url
          }).then(url => setAffiliateUrl(url));
        }
      } catch (e) {
        console.error('Failed to parse product data:', e);
        setError('Failed to load product');
      }
    } else {
      setError('Product not found');
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 flex items-center justify-center">
        <div className="text-center p-8 glass-effect rounded-3xl border border-white/30 shadow-xl max-w-md">
          <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The product you\'re looking for doesn\'t exist'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  const productId = product.productId || generateProductId(product.url, product.site);
  const siteUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://looqta.com';
  const productUrl = `${siteUrl}/product/${id}`;
  const productImage = product.image || product.image_url || getImageFromUrl(product.url) || `${siteUrl}/og-image.jpg`;

  return (
    <>
      <Head>
        {/* SEO Meta Tags */}
        <title>{product.product_name} - Looqta Price Comparison</title>
        <meta name="description" content={`Best price: ${product.price || 'N/A'} ${product.currency || 'SAR'} on ${product.site || 'Looqta'}. Compare prices from Amazon and Noon.`} />
        
        {/* Open Graph Meta Tags */}
        <meta property="og:title" content={`${product.product_name} - Looqta`} />
        <meta property="og:description" content={`Best price: ${product.price || 'N/A'} ${product.currency || 'SAR'} on ${product.site || 'Looqta'}`} />
        <meta property="og:image" content={productImage} />
        <meta property="og:url" content={productUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="Looqta" />
        
        {/* Product-specific Open Graph tags */}
        <meta property="product:price:amount" content={product.price || '0'} />
        <meta property="product:price:currency" content={product.currency || 'SAR'} />
        <meta property="product:availability" content="in stock" />
        <meta property="product:condition" content="new" />
        <meta property="product:retailer" content={product.site || 'Looqta'} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${product.product_name} - Looqta`} />
        <meta name="twitter:description" content={`Best price: ${product.price || 'N/A'} ${product.currency || 'SAR'}`} />
        <meta name="twitter:image" content={productImage} />
        
        {/* WhatsApp Meta Tags */}
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              "name": product.product_name,
              "image": productImage,
              "description": `Best price: ${product.price || 'N/A'} ${product.currency || 'SAR'} on ${product.site || 'Looqta'}`,
              "brand": {
                "@type": "Brand",
                "name": product.site || "Looqta"
              },
              "offers": {
                "@type": "Offer",
                "url": product.url || productUrl,
                "priceCurrency": product.currency || "SAR",
                "price": product.price || "0",
                "priceValidUntil": new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                "availability": "https://schema.org/InStock",
                "seller": {
                  "@type": "Organization",
                  "name": product.site || "Looqta"
                }
              }
            })
          }}
        />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Product Info */}
          <div className="space-y-6">
            {/* Product Image */}
            <div className="glass-effect rounded-3xl border border-white/30 shadow-xl overflow-hidden">
              <img
                src={product.image || getImageFromUrl(product.url)}
                alt={product.product_name}
                className="w-full h-96 object-cover"
                onError={(e) => {
                  e.target.src = '/placeholder-product.png';
                }}
              />
            </div>

            {/* Product Details */}
            <div className="glass-effect rounded-3xl border border-white/30 shadow-xl p-6">
              <h1 className="text-3xl font-black text-gray-900 mb-4">{product.product_name}</h1>
              
              {/* Seller Badge */}
              <div className="mb-4">
                <SellerBadge
                  sellerRating={product.seller_rating}
                  sellerRatingCount={product.seller_rating_count}
                  sellerType={product.seller_type}
                  site={product.site}
                />
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-indigo-600">
                    {product.currency || 'SAR'} {product.price?.toFixed(2) || 'N/A'}
                  </span>
                </div>
                {product.price && (
                  <p className="text-sm text-gray-500 mt-2">Including VAT</p>
                )}
              </div>

              {/* Site Badge */}
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold">
                  <span>{product.site === 'amazon.sa' ? '🛒' : '🌙'}</span>
                  <span>{product.site === 'amazon.sa' ? 'Amazon SA' : product.site === 'noon.com' ? 'Noon' : product.site}</span>
                </span>
              </div>

              {/* WhatsApp Share */}
              <div className="mb-4">
                <WhatsAppShare product={product} />
              </div>

              {/* Buy Button */}
              <a
                href={affiliateUrl || product.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
              >
                <span>Buy on {product.site === 'amazon.sa' ? 'Amazon' : product.site === 'noon.com' ? 'Noon' : product.site}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              <p className="text-xs text-gray-500 text-center mt-3">
                Affiliate link • We may earn a commission
              </p>
            </div>
          </div>

          {/* Right Column - Price History & Alerts */}
          <div className="space-y-6">
            {/* Price History Chart */}
            {productId && (
              <PriceHistoryChart
                productId={productId}
                productName={product.product_name}
                site={product.site}
              />
            )}

            {/* Price Alert Form */}
            {productId && (
              <PriceAlertForm
                productId={productId}
                productName={product.product_name}
                site={product.site}
                url={product.url}
                currentPrice={product.price}
                currency={product.currency || 'SAR'}
                userId="guest" // In production, get from auth context
              />
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// Helper function to extract image URL
function getImageFromUrl(url) {
  if (!url) return null;
  try {
    const amazonDpMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (amazonDpMatch) {
      return `https://m.media-amazon.com/images/I/${amazonDpMatch[1]}._AC_SL1500_.jpg`;
    }
    const noonMatch = url.match(/\/p\/([^\/\?]+)/);
    if (noonMatch) {
      return `https://f.nooncdn.com/products/${noonMatch[1]}/image`;
    }
  } catch (e) {
    return null;
  }
  return null;
}
