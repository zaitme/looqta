'use client';

/**
 * SellerBadge Component
 * Displays seller trust badges based on rating and type
 */
export default function SellerBadge({ sellerRating, sellerRatingCount, sellerType, site }) {
  if (!sellerRating && !sellerType) {
    return null;
  }

  // Determine badge type based on rating and seller type
  const getBadgeInfo = () => {
    // Verified Retailer
    if (sellerType === 'verified' || sellerType === 'amazon' || sellerType === 'noon') {
      return {
        label: 'Verified Retailer',
        icon: '✓',
        bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
        text: 'text-white',
        border: 'border-green-400'
      };
    }

    // Top Seller (high rating with many reviews)
    if (sellerRating >= 4.5 && sellerRatingCount >= 100) {
      return {
        label: 'Top Seller',
        icon: '⭐',
        bg: 'bg-gradient-to-r from-yellow-400 to-orange-500',
        text: 'text-white',
        border: 'border-yellow-400'
      };
    }

    // Highly Rated (good rating)
    if (sellerRating >= 4.0) {
      return {
        label: 'Highly Rated',
        icon: '👍',
        bg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
        text: 'text-white',
        border: 'border-blue-400'
      };
    }

    // New Seller (low review count)
    if (sellerRatingCount < 10) {
      return {
        label: 'New Seller',
        icon: '🆕',
        bg: 'bg-gradient-to-r from-gray-400 to-gray-500',
        text: 'text-white',
        border: 'border-gray-400'
      };
    }

    // Default
    return {
      label: 'Seller',
      icon: '🏪',
      bg: 'bg-gradient-to-r from-gray-500 to-gray-600',
      text: 'text-white',
      border: 'border-gray-400'
    };
  };

  const badgeInfo = getBadgeInfo();

  return (
    <div className="inline-flex items-center gap-2">
      <div className={`${badgeInfo.bg} ${badgeInfo.text} px-3 py-1.5 rounded-lg shadow-lg border-2 ${badgeInfo.border} flex items-center gap-2`}>
        <span className="text-sm font-bold">{badgeInfo.icon}</span>
        <span className="text-xs font-bold">{badgeInfo.label}</span>
      </div>
      
      {sellerRating && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
          <svg className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-xs font-bold text-gray-700">{sellerRating.toFixed(1)}</span>
          {sellerRatingCount && (
            <span className="text-xs text-gray-500">({sellerRatingCount})</span>
          )}
        </div>
      )}
    </div>
  );
}
