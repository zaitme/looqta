'use client';
import { useState, useEffect } from 'react';

/**
 * AdDisplay Component
 * Displays active ad placements on the frontend
 * 
 * @param {string} position - Filter ads by position (header, footer, sidebar, inline)
 * @param {string} className - Additional CSS classes
 */
export default function AdDisplay({ position, className = '' }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAds = async () => {
      try {
        setLoading(true);
        const url = position 
          ? `/api/proxy/ads?position=${encodeURIComponent(position)}`
          : '/api/proxy/ads';
        
        console.log('[AdDisplay] Loading ads from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('[AdDisplay] HTTP error:', response.status, response.statusText);
          return;
        }
        
        const data = await response.json();
        console.log('[AdDisplay] Received data:', data);
        
        if (data.success && Array.isArray(data.ads)) {
          console.log('[AdDisplay] Setting ads:', data.ads.length, 'ads for position:', position);
          setAds(data.ads);
        } else {
          console.warn('[AdDisplay] Invalid response format:', data);
        }
      } catch (err) {
        console.error('[AdDisplay] Failed to load ads:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAds();
  }, [position]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (ads.length === 0) {
    return null; // Don't render if no ads
  }

  return (
    <div className={`ad-container ${className}`}>
      {ads.map((ad) => (
        <AdItem key={ad.id} ad={ad} />
      ))}
    </div>
  );
}

/**
 * Individual Ad Item Component
 */
function AdItem({ ad }) {
  const handleClick = () => {
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  const isClickable = ad.link_url && ad.link_url.trim() !== '';

  return (
    <div 
      className={`ad-item ad-${ad.ad_type} ad-position-${ad.position} ${
        isClickable ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      }`}
      onClick={isClickable ? handleClick : undefined}
      style={{ 
        marginBottom: '1rem',
        ...(ad.position === 'header' && { marginBottom: '2rem' }),
        ...(ad.position === 'footer' && { marginTop: '2rem' })
      }}
    >
      {ad.image_url ? (
        <div className="ad-image-container">
          <img 
            src={ad.image_url} 
            alt={ad.name || 'Advertisement'}
            className="w-full h-auto rounded-lg"
            loading="lazy"
          />
          {ad.content && (
            <div className="ad-content mt-2 text-sm text-gray-600">
              {ad.content}
            </div>
          )}
        </div>
      ) : ad.content ? (
        <div className="ad-content p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
          <div 
            className="text-gray-800"
            dangerouslySetInnerHTML={{ __html: ad.content }}
          />
        </div>
      ) : null}
    </div>
  );
}
