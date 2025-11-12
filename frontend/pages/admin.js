'use client';
import { useState, useEffect } from 'react';
import Spinner from '../components/Spinner';

export default function AdminPage() {
  const [scrapers, setScrapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [systemStats, setSystemStats] = useState(null);

  useEffect(() => {
    loadScrapers();
    loadCacheStats();
    loadSystemStats();
  }, []);

  const loadScrapers = async () => {
    try {
      const res = await fetch('/api/proxy/admin/scrapers');
      const data = await res.json();
      if (data.success) {
        setScrapers(data.scrapers);
      }
    } catch (error) {
      console.error('Error loading scrapers:', error);
      setMessage({ type: 'error', text: 'Failed to load scrapers' });
    } finally {
      setLoading(false);
    }
  };

  const loadCacheStats = async () => {
    try {
      const res = await fetch('/api/proxy/admin/cache/stats');
      const data = await res.json();
      if (data.success) {
        setCacheStats(data.cache);
      }
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  };

  const loadSystemStats = async () => {
    try {
      const res = await fetch('/api/proxy/admin/stats');
      const data = await res.json();
      if (data.success) {
        setSystemStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  };

  const handleScraperToggle = (scraperName, enabled) => {
    setScrapers(prev => prev.map(s => 
      s.name === scraperName ? { ...s, enabled } : s
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const scraperData = {};
      scrapers.forEach(s => {
        scraperData[s.name] = s.enabled;
      });
      
      const res = await fetch('/api/proxy/admin/scrapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scrapers: scraperData })
      });
      
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Scraper settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving scrapers:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all search cache?')) {
      return;
    }
    
    try {
      const res = await fetch('/api/proxy/admin/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Cache cleared: ${data.message}` });
        setTimeout(() => setMessage(null), 3000);
        loadCacheStats();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to clear cache' });
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear cache' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black gradient-text-purple mb-2">Admin Panel</h1>
          <p className="text-slate-600">Manage scrapers and system settings</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-green-100 border-2 border-green-300 text-green-700' 
              : 'bg-red-100 border-2 border-red-300 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* System Stats */}
        {systemStats && (
          <div className="mb-8 glass-effect rounded-2xl p-6 border border-white/30 shadow-xl">
            <h2 className="text-2xl font-bold mb-4 gradient-text-purple">System Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-black text-indigo-600">{systemStats.totalScrapers}</div>
                <div className="text-sm text-slate-600">Total Scrapers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-green-600">{systemStats.enabledScrapers}</div>
                <div className="text-sm text-slate-600">Enabled</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-red-600">{systemStats.disabledScrapers}</div>
                <div className="text-sm text-slate-600">Disabled</div>
              </div>
            </div>
          </div>
        )}

        {/* Scraper Settings */}
        <div className="mb-8 glass-effect rounded-2xl p-6 border border-white/30 shadow-xl">
          <h2 className="text-2xl font-bold mb-6 gradient-text-purple">Scraper Management</h2>
          
          <div className="space-y-4">
            {scrapers.map(scraper => (
              <div key={scraper.name} className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-white/50">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    scraper.enabled ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <div>
                    <div className="font-bold text-lg text-slate-800">{scraper.displayName}</div>
                    <div className="text-sm text-slate-500">{scraper.name}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`scraper-${scraper.name}`}
                      checked={scraper.enabled}
                      onChange={() => handleScraperToggle(scraper.name, true)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm font-medium">Enabled</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`scraper-${scraper.name}`}
                      checked={!scraper.enabled}
                      onChange={() => handleScraperToggle(scraper.name, false)}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-sm font-medium">Disabled</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </div>

        {/* Cache Management */}
        <div className="glass-effect rounded-2xl p-6 border border-white/30 shadow-xl">
          <h2 className="text-2xl font-bold mb-4 gradient-text-purple">Cache Management</h2>
          
          {cacheStats && (
            <div className="mb-4 p-4 bg-white/50 rounded-xl">
              <div className="text-sm text-slate-600 mb-2">Cache Status:</div>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                cacheStats.connected 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {cacheStats.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          )}
          
          <button
            onClick={handleClearCache}
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Clear All Cache
          </button>
        </div>
      </div>
    </div>
  );
}
