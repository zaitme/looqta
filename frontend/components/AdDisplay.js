'use client';
import { useState, useEffect, useRef } from 'react';

/**
 * AdDisplay Component
 * Displays active ad placements on the frontend
 * Supports Google AdSense and custom HTML/JavaScript ad codes
 * 
 * @param {string} position - Filter ads by position (header, footer, sidebar, inline)
 * @param {string} className - Additional CSS classes
 */
export default function AdDisplay({ position, className = '' }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAds = async () => {
      try {
        setLoading(true);
        setError(null);
        const url = position 
          ? `/api/proxy/ads?position=${encodeURIComponent(position)}`
          : '/api/proxy/ads';
        
        console.log('[AdDisplay] Loading ads from:', url);
        const response = await fetch(url);
        
        // Check content type first
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        
        if (!isJson) {
          // If not JSON, read as text to see what we got
          const text = await response.text();
          console.warn('[AdDisplay] Non-JSON response received:', {
            status: response.status,
            contentType: contentType,
            preview: text.substring(0, 200)
          });
          setAds([]);
          return;
        }
        
        // Parse JSON response
        let data;
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('[AdDisplay] Failed to parse JSON:', parseError);
          setAds([]);
          return;
        }
        
        if (!response.ok) {
          console.warn('[AdDisplay] HTTP error:', response.status, response.statusText, data);
          // Set empty ads array - don't show error to user
          setAds([]);
          return;
        }
        
        console.log('[AdDisplay] Received data:', data);
        
        if (data.success && Array.isArray(data.ads)) {
          console.log('[AdDisplay] Setting ads:', data.ads.length, 'ads for position:', position);
          setAds(data.ads);
        } else {
          console.warn('[AdDisplay] Invalid response format:', data);
          setAds([]);
        }
      } catch (err) {
        console.error('[AdDisplay] Failed to load ads:', err);
        // Don't show error to user - just show no ads
        setAds([]);
        setError(err.message);
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
 * Supports Google AdSense and custom HTML/JavaScript ad codes
 */
function AdItem({ ad }) {
  const adRef = useRef(null);

  useEffect(() => {
    // Execute scripts in ad content (for Google AdSense)
    if (adRef.current && ad.content) {
      const scripts = adRef.current.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    }
  }, [ad.content]);

  const handleClick = () => {
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  const isClickable = ad.link_url && ad.link_url.trim() !== '';
  const isGoogleAdSense = ad.content && (
    ad.content.includes('googlesyndication.com') || 
    ad.content.includes('adsbygoogle') ||
    ad.content.includes('google_ad')
  );
  
  // Check if content is a URL (starts with http:// or https://)
  const contentIsUrl = ad.content && (
    ad.content.trim().startsWith('http://') || 
    ad.content.trim().startsWith('https://')
  );

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
        <div className="ad-image-container" style={{ maxWidth: '100%', overflow: 'hidden' }}>
          <img 
            src={ad.image_url} 
            alt={ad.name || 'Advertisement'}
            className="rounded-lg"
            style={{
              maxWidth: '100%',
              height: 'auto',
              maxHeight: ad.position === 'header' || ad.position === 'footer' ? '120px' : '200px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto'
            }}
            loading="lazy"
            onError={(e) => {
              console.error('[AdDisplay] Failed to load ad image:', ad.image_url);
              e.target.style.display = 'none';
            }}
          />
          {ad.content && !contentIsUrl && (
            <div className="ad-content mt-2 text-sm text-gray-600">
              {ad.content}
            </div>
          )}
        </div>
      ) : contentIsUrl && !isGoogleAdSense ? (
        // If content is a URL and no image_url, treat it as an image URL
        <div className="ad-image-container" style={{ maxWidth: '100%', overflow: 'hidden' }}>
          <img 
            src={ad.content.trim()} 
            alt={ad.name || 'Advertisement'}
            className="rounded-lg"
            style={{
              maxWidth: '100%',
              height: 'auto',
              maxHeight: ad.position === 'header' || ad.position === 'footer' ? '120px' : '200px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto'
            }}
            loading="lazy"
            onError={(e) => {
              console.error('[AdDisplay] Failed to load ad image from content URL:', ad.content);
              e.target.style.display = 'none';
            }}
          />
        </div>
      ) : ad.content ? (
        <div 
          ref={adRef}
          className={`ad-content ${
            isGoogleAdSense 
              ? 'google-adsense-container' 
              : 'p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200'
          }`}
          style={{
            minHeight: isGoogleAdSense ? '100px' : 'auto',
            maxWidth: '100%',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            // Google AdSense responsive dimensions based on position
            ...(isGoogleAdSense && {
              maxWidth: ad.position === 'header' || ad.position === 'footer' 
                ? '728px'  // Standard banner width
                : ad.position === 'sidebar'
                ? '300px'  // Standard sidebar width
                : '100%',  // Full width for inline
              margin: '0 auto',
              minHeight: ad.position === 'header' || ad.position === 'footer' ? '90px' : '250px'
            })
          }}
        >
          <div 
            className={isGoogleAdSense ? 'w-full' : 'text-gray-800'}
            style={isGoogleAdSense ? { width: '100%', display: 'block' } : {}}
            dangerouslySetInnerHTML={{ __html: ad.content }}
          />
        </div>
      ) : null}
    </div>
  );
}
