'use client';
import { useState, useEffect } from 'react';
import { createPriceAlert, getUserAlerts, deletePriceAlert } from '../utils/productUtils';

/**
 * PriceAlertForm Component
 * Create and manage price alerts for a product
 */
export default function PriceAlertForm({ productId, productName, site, url, currentPrice, currency = 'SAR', userId = 'guest' }) {
  const [targetPrice, setTargetPrice] = useState('');
  const [notificationType, setNotificationType] = useState('email');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [existingAlert, setExistingAlert] = useState(null);

  useEffect(() => {
    if (productId && userId) {
      // Check for existing alert
      getUserAlerts(userId).then(data => {
        const alert = data.alerts?.find(a => 
          a.product_id === productId && a.is_active
        );
        if (alert) {
          setExistingAlert(alert);
          setTargetPrice(alert.target_price.toString());
          setNotificationType(alert.notification_type || 'email');
        }
      });
    }
  }, [productId, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !targetPrice || !userId) {
      setError('Product ID, target price, and user ID are required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createPriceAlert(productId, {
        targetPrice: parseFloat(targetPrice),
        currency,
        userId,
        productName,
        site,
        url,
        notificationType
      });

      setSuccess(result.message || 'Alert created successfully!');
      setExistingAlert({ ...existingAlert, id: result.alertId });
    } catch (err) {
      setError(err.message || 'Failed to create alert');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingAlert || !existingAlert.id) return;

    setLoading(true);
    setError(null);

    try {
      await deletePriceAlert(productId, existingAlert.id);
      setExistingAlert(null);
      setTargetPrice('');
      setSuccess('Alert deleted successfully');
    } catch (err) {
      setError(err.message || 'Failed to delete alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 glass-effect rounded-2xl border border-white/30 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Price Alert</h3>
          <p className="text-sm text-gray-500">Get notified when price drops</p>
        </div>
      </div>

      {existingAlert && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800">Active Alert</p>
              <p className="text-xs text-green-600">
                Notify me when price drops to {currency} {existingAlert.target_price}
              </p>
            </div>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Target Price ({currency})
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={currentPrice ? `Current: ${currency} ${currentPrice.toFixed(2)}` : 'Enter target price'}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              required
            />
            {currentPrice && targetPrice && (
              <div className="mt-2 text-sm">
                {parseFloat(targetPrice) < currentPrice ? (
                  <span className="text-green-600 font-semibold">
                    ✓ {((currentPrice - parseFloat(targetPrice)) / currentPrice * 100).toFixed(1)}% savings
                  </span>
                ) : (
                  <span className="text-orange-600 font-semibold">
                    ⚠ Target price is higher than current price
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Notification Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'email', label: 'Email', icon: '📧' },
              { value: 'push', label: 'Push', icon: '🔔' },
              { value: 'both', label: 'Both', icon: '📬' }
            ].map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setNotificationType(option.value)}
                className={`p-3 rounded-xl border-2 transition-all font-semibold ${
                  notificationType === option.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-lg'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-xl mb-1 block">{option.icon}</span>
                <span className="text-xs">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !targetPrice}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>{existingAlert ? 'Update Alert' : 'Create Alert'}</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          You'll be notified when the price drops to your target or below
        </p>
      </div>
    </div>
  );
}
