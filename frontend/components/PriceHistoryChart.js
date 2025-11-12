'use client';
import { useState, useEffect } from 'react';
import { getPriceHistory } from '../utils/productUtils';

/**
 * PriceHistoryChart Component
 * Displays price trends over time with moving averages
 */
export default function PriceHistoryChart({ productId, productName, site }) {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    if (!productId) return;
    
    setLoading(true);
    setError(null);
    
    getPriceHistory(productId, range)
      .then(data => {
        if (data && data.data) {
          setHistoryData(data);
        } else {
          setError('No price history available');
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load price history');
        setLoading(false);
      });
  }, [productId, range]);

  if (!productId) {
    return (
      <div className="p-6 glass-effect rounded-2xl border border-white/30">
        <p className="text-gray-500 text-center">Product ID required to show price history</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 glass-effect rounded-2xl border border-white/30">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600">Loading price history...</span>
        </div>
      </div>
    );
  }

  if (error || !historyData || historyData.data.length === 0) {
    return (
      <div className="p-6 glass-effect rounded-2xl border border-white/30">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Price History</h3>
        <div className="text-center py-8">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 font-medium">
            {error || 'No price history available yet'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Price history will appear after the product is tracked for a few days
          </p>
        </div>
      </div>
    );
  }

  const { data, stats } = historyData;
  const prices = data.map(d => parseFloat(d.price)).filter(p => !isNaN(p));
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // Prepare chart data (last 30 points for readability)
  const chartData = data.slice(0, 30).reverse(); // Show oldest to newest
  const chartHeight = 200;
  const chartWidth = 100;
  const padding = 20;

  // Calculate points for price line
  const pricePoints = chartData.map((point, index) => {
    const x = padding + (index / (chartData.length - 1 || 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((parseFloat(point.price) - minPrice) / priceRange) * (chartHeight - padding * 2);
    return { x, y, price: parseFloat(point.price), date: point.scraped_at };
  });

  return (
    <div className="p-6 glass-effect rounded-2xl border border-white/30 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800">Price History</h3>
        <div className="flex gap-2">
          {['7d', '30d', '90d', 'all'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
                range === r
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r === 'all' ? 'All' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <p className="text-xs text-gray-600 mb-1">Latest Price</p>
            <p className="text-lg font-bold text-blue-700">
              {stats.latestPrice ? `${data[0].currency || 'SAR'} ${stats.latestPrice.toFixed(2)}` : 'N/A'}
            </p>
          </div>
          {stats.avg7d && (
            <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <p className="text-xs text-gray-600 mb-1">7-Day Avg</p>
              <p className="text-lg font-bold text-green-700">
                {data[0].currency || 'SAR'} {stats.avg7d.toFixed(2)}
              </p>
            </div>
          )}
          {stats.avg30d && (
            <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <p className="text-xs text-gray-600 mb-1">30-Day Avg</p>
              <p className="text-lg font-bold text-purple-700">
                {data[0].currency || 'SAR'} {stats.avg30d.toFixed(2)}
              </p>
            </div>
          )}
          {stats.percentChange && (
            <div className={`p-3 rounded-xl border ${
              stats.percentChange >= 0
                ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
                : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
            }`}>
              <p className="text-xs text-gray-600 mb-1">Change</p>
              <p className={`text-lg font-bold ${
                stats.percentChange >= 0 ? 'text-red-700' : 'text-green-700'
              }`}>
                {stats.percentChange >= 0 ? '+' : ''}{stats.percentChange.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Simple SVG Chart */}
      <div className="relative w-full" style={{ height: `${chartHeight}px` }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <line
              key={ratio}
              x1={padding}
              y1={padding + ratio * (chartHeight - padding * 2)}
              x2={chartWidth - padding}
              y2={padding + ratio * (chartHeight - padding * 2)}
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          ))}

          {/* Price line */}
          {pricePoints.length > 1 && (
            <polyline
              points={pricePoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="url(#priceGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="priceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* Data points */}
          {pricePoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill="#6366f1"
              className="hover:r-2 transition-all cursor-pointer"
            >
              <title>
                {new Date(point.date).toLocaleDateString()}: {point.price.toFixed(2)} {data[0].currency || 'SAR'}
              </title>
            </circle>
          ))}

          {/* Y-axis labels */}
          <text x="2" y={padding} fontSize="8" fill="#6b7280" textAnchor="start">
            {maxPrice.toFixed(0)}
          </text>
          <text x="2" y={chartHeight - padding} fontSize="8" fill="#6b7280" textAnchor="start">
            {minPrice.toFixed(0)}
          </text>
        </svg>
      </div>

      {/* Data count */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-500">
          {stats.count} data point{stats.count !== 1 ? 's' : ''} tracked
        </p>
      </div>
    </div>
  );
}
