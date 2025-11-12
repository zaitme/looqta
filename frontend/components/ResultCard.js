'use client';
import SellerBadge from './SellerBadge';
import { generateProductId, getAffiliateUrl } from '../utils/productUtils';
import { useState, useEffect } from 'react';

// Helper function to extract image URL from product URL
function getImageFromUrl(url) {
  if (!url) return null;
  
  try {
    // For Amazon URLs, extract ASIN and construct image URL
    // Amazon ASINs are 10 characters (alphanumeric)
    const amazonDpMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (amazonDpMatch) {
      const asin = amazonDpMatch[1];
      // Use modern Amazon CDN format
      return `https://m.media-amazon.com/images/I/${asin}._AC_SL1500_.jpg`;
    }
    
    // For Amazon gp/product URLs
    const amazonGpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/);
    if (amazonGpMatch) {
      const asin = amazonGpMatch[1];
      return `https://m.media-amazon.com/images/I/${asin}._AC_SL1500_.jpg`;
    }
    
    // For Noon URLs, extract product ID
    const noonMatch = url.match(/\/p\/([^\/\?]+)/);
    if (noonMatch) {
      const productId = noonMatch[1];
      // Noon CDN image URL format
      return `https://f.nooncdn.com/products/${productId}/image`;
    }
    
    // For Noon saudi-en URLs
    const noonSaudiMatch = url.match(/\/saudi-en\/p\/([^\/\?]+)/);
    if (noonSaudiMatch) {
      const productId = noonSaudiMatch[1];
      return `https://f.nooncdn.com/products/${productId}/image`;
    }
    
    // For Noon sa-en URLs
    const noonSaMatch = url.match(/\/sa-en\/p\/([^\/\?]+)/);
    if (noonSaMatch) {
      const productId = noonSaMatch[1];
      return `https://f.nooncdn.com/products/${productId}/image`;
    }
  } catch (e) {
    console.error('Error extracting image from URL:', e);
  }
  
  return null;
}

export default function ResultCard({ r, index, isBestDeal, isSecondDeal, isThirdDeal, dealRank }){
  const [affiliateUrl, setAffiliateUrl] = useState(r.url);
  const productId = generateProductId(r.url, r.site);

  useEffect(() => {
    // Generate affiliate URL if available
    if (r.url && r.site) {
      getAffiliateUrl({
        url: r.url,
        site: r.site,
        productId: productId,
        productName: r.product_name,
        affiliateUrl: r.affiliate_url || r.url
      }).then(url => setAffiliateUrl(url));
    }
  }, [r.url, r.site, productId]);
  const siteConfig = {
    'amazon.sa': {
      name: 'Amazon SA',
      bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
      text: 'text-orange-700',
      border: 'border-orange-300',
      badge: 'bg-gradient-to-r from-orange-500 to-amber-500',
      icon: '🛒'
    },
    'amazon.ae': {
      name: 'Amazon AE',
      bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
      text: 'text-orange-700',
      border: 'border-orange-300',
      badge: 'bg-gradient-to-r from-orange-500 to-amber-500',
      icon: '🛒'
    },
    'noon.com': {
      name: 'Noon',
      bg: 'bg-gradient-to-br from-yellow-50 to-amber-50',
      text: 'text-yellow-700',
      border: 'border-yellow-300',
      badge: 'bg-gradient-to-r from-yellow-500 to-amber-500',
      icon: '🌙'
    },
    'jarir.com': {
      name: 'Jarir',
      bg: 'bg-gradient-to-br from-blue-50 to-cyan-50',
      text: 'text-blue-700',
      border: 'border-blue-300',
      badge: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      icon: '📚'
    },
    'extra.com.sa': {
      name: 'Extra',
      bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
      text: 'text-green-700',
      border: 'border-green-300',
      badge: 'bg-gradient-to-r from-green-500 to-emerald-500',
      icon: '🛍️'
    },
    'panda.com.sa': {
      name: 'Panda',
      bg: 'bg-gradient-to-br from-red-50 to-pink-50',
      text: 'text-red-700',
      border: 'border-red-300',
      badge: 'bg-gradient-to-r from-red-500 to-pink-500',
      icon: '🐼'
    }
  };

  // Normalize site value for matching
  const normalizedSite = r.site ? r.site.toLowerCase().trim() : '';
  const site = siteConfig[normalizedSite] || siteConfig[r.site] || {
    name: r.site || 'Unknown Source',
    bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    badge: 'bg-gradient-to-r from-gray-500 to-gray-600',
    icon: '🛍️'
  };

  // Determine deal badge configuration
  const getDealBadgeConfig = () => {
    if (isBestDeal && dealRank === 1) {
      return {
        text: '🥇 Best Deal',
        className: 'best-deal-1',
        animation: 'animate-badge-glow animate-badge-pulse animate-badge-float',
        icon: '🥇'
      };
    }
    if (isSecondDeal && dealRank === 2) {
      return {
        text: '🥈 2nd Best',
        className: 'best-deal-2',
        animation: 'animate-badge-pulse',
        icon: '🥈'
      };
    }
    if (isThirdDeal && dealRank === 3) {
      return {
        text: '🥉 3rd Best',
        className: 'best-deal-3',
        animation: 'animate-badge-pulse',
        icon: '🥉'
      };
    }
    return null;
  };

  const dealBadge = getDealBadgeConfig();

  return (
    <div className={`group relative glass-effect rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border ${
      isBestDeal ? 'border-green-400/60 border-2 glow-effect-green' : isSecondDeal ? 'border-blue-400/60 border-2 glow-effect-blue' : isThirdDeal ? 'border-purple-400/60 border-2 glow-effect-purple' : 'border-white/30'
    } hover:border-purple-300/50 hover:-translate-y-3 ${isBestDeal ? 'ring-4 ring-green-200/50' : ''} transform hover:scale-[1.02]`}>
      {/* Best Deal Badge - Top Left (if applicable) */}
      {dealBadge && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20">
          <div className={`best-deal-badge ${dealBadge.className} ${dealBadge.animation} px-2 py-1 sm:px-4 sm:py-2 rounded-full shadow-2xl flex items-center gap-1 sm:gap-2`}>
            <span className="text-white text-xs sm:text-sm font-extrabold">{dealBadge.icon}</span>
            <span className="text-white text-xs sm:text-sm font-extrabold hidden sm:inline">{dealBadge.text}</span>
            <span className="text-white text-xs font-extrabold sm:hidden">{dealRank}</span>
          </div>
        </div>
      )}
      
      {/* Site Badge - Top Right */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
        <div className={`${site.badge} px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg flex items-center gap-1 sm:gap-2`}>
          <span className="text-white text-xs font-bold">{site.icon}</span>
          <span className="text-white text-xs font-bold hidden sm:inline">{site.name}</span>
        </div>
      </div>

      {/* Product Image - Always visible with fallback */}
      <div className="relative w-full h-56 sm:h-64 md:h-72 bg-gradient-to-br from-slate-100 via-blue-50/50 to-purple-50/50 overflow-hidden rounded-t-3xl">
        {(r.image || r.url) ? (
          <img 
            src={r.image || getImageFromUrl(r.url)} 
            alt={r.product_name || 'Product image'}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            onError={(e) => {
              // Try to extract image from URL if direct image failed
              if (!r.image && r.url) {
                const fallbackImage = getImageFromUrl(r.url);
                if (fallbackImage && e.target.src !== fallbackImage) {
                  e.target.src = fallbackImage;
                  return;
                }
              }
              // Show fallback on error
              e.target.style.display = 'none';
              const fallback = e.target.parentElement.querySelector('.image-fallback');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        {/* Fallback when no image or image fails */}
        <div className={`image-fallback ${(r.image || r.url) ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50`}>
          <div className="text-center">
            <svg className="w-24 h-24 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-slate-400 font-semibold">No Image Available</p>
          </div>
        </div>
        {/* Modern Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
      
      {/* Card Content */}
      <div className="p-6">
        {/* Product Name */}
        <h3 className="font-bold text-xl text-slate-900 mb-4 line-clamp-2 min-h-[3.5rem] group-hover:text-purple-600 transition-colors duration-300">
          {r.product_name || 'Product Name Not Available'}
        </h3>
        
        {/* Site Name Badge & Seller Badge - Below title */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${site.bg} ${site.text} border-2 ${site.border} shadow-md backdrop-blur-sm`}>
            <span className="text-lg">{site.icon}</span>
            <span>{site.name || r.site || 'Unknown Source'}</span>
          </span>
          <SellerBadge
            sellerRating={r.seller_rating}
            sellerRatingCount={r.seller_rating_count}
            sellerType={r.seller_type}
            site={r.site}
          />
        </div>
        
        {/* Price Section */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-2">
            <span className={`text-4xl font-black ${
              isBestDeal ? 'text-green-600' : isSecondDeal ? 'text-blue-600' : isThirdDeal ? 'text-purple-600' : 'text-slate-900'
            }`}>
              {r.currency || 'SAR'} {r.price?.toFixed(2) || 'N/A'}
            </span>
            {r.price && r.price > 0 && (
              <span className="text-base text-slate-400 line-through font-semibold">
                {r.currency || 'SAR'} {(r.price * 1.15).toFixed(2)}
              </span>
            )}
          </div>
          {r.price && r.price > 0 && (
            <div className="flex items-center gap-1">
              {dealBadge ? (
                <>
                  <svg className={`w-4 h-4 ${
                    isBestDeal ? 'text-green-500' : isSecondDeal ? 'text-blue-500' : 'text-purple-500'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className={`text-xs font-semibold ${
                    isBestDeal ? 'text-green-600' : isSecondDeal ? 'text-blue-600' : 'text-purple-600'
                  }`}>
                    {dealRank === 1 ? 'Best price available!' : dealRank === 2 ? 'Great price!' : 'Good deal!'}
                  </p>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-green-600 font-semibold">Best price available</p>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Action Button - Use affiliate URL */}
        <a 
          href={affiliateUrl || r.url || '#'} 
          target="_blank" 
          rel="noreferrer"
          className={`w-full inline-flex items-center justify-center gap-3 px-6 py-4 ${affiliateUrl || r.url ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 cursor-pointer glow-effect' : 'bg-slate-400 cursor-not-allowed'} text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 active:scale-95 relative overflow-hidden group`}
          onClick={(e) => {
            if (!affiliateUrl && !r.url) {
              e.preventDefault();
            }
          }}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
          <span className="relative z-10">{affiliateUrl || r.url ? 'View Product' : 'URL Not Available'}</span>
          {(affiliateUrl || r.url) && (
            <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          )}
        </a>
      </div>
    </div>
  );
}
