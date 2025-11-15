'use client';
import { useState } from 'react';

/**
 * WhatsApp Share Component
 * Creates shareable links with product image and price preview
 */
export default function WhatsAppShare({ product, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (!product) return;

    const siteUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : 'https://looqta.com';

    // Create product share URL
    const productId = product.product_id || encodeURIComponent(product.url);
    const shareUrl = `${siteUrl}/product/${productId}`;

    // Create WhatsApp share message
    const productName = product.product_name || product.name || 'Product';
    const price = product.price || product.price_amount || 'N/A';
    const currency = product.currency || product.price_currency || 'SAR';
    const site = product.site || 'Looqta';
    
    const message = `🔍 Found a great deal on Looqta!\n\n` +
      `📦 ${productName}\n` +
      `💰 Price: ${price} ${currency}\n` +
      `🛒 Available on: ${site}\n\n` +
      `Check it out: ${shareUrl}`;

    // Encode message for WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

    // Open WhatsApp share dialog
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    if (!product) return;

    const siteUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : 'https://looqta.com';

    const productId = product.product_id || encodeURIComponent(product.url);
    const shareUrl = `${siteUrl}/product/${productId}`;

    try {
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } else {
            throw new Error('execCommand failed');
          }
        } catch (err) {
          console.error('Failed to copy link:', err);
          // Last resort: show URL in alert
          alert(`Copy this link: ${shareUrl}`);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: show URL in alert
      alert(`Copy this link: ${shareUrl}`);
    }
  };

  if (!product) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        aria-label="Share on WhatsApp"
        title="Share on WhatsApp"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        <span className="hidden sm:inline">Share</span>
      </button>
      
      <button
        onClick={handleCopyLink}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
          copied
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
            : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300'
        }`}
        aria-label="Copy link"
        title="Copy product link"
      >
        {copied ? (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Copied!</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Copy Link</span>
          </>
        )}
      </button>
    </div>
  );
}
