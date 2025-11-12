'use client';
import { useState, useImperativeHandle, forwardRef } from 'react';
import Spinner from './Spinner';

const SearchBox = forwardRef(function SearchBox({ onResults, onLoadingChange, onIncrementalResults, onStatusUpdate }, ref){
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useStreaming] = useState(true); // Enable streaming by default

  // Expose search function to parent
  useImperativeHandle(ref, () => ({
    search: (query, forceFresh = false) => {
      setQ(query);
      // Trigger search after state update
      setTimeout(() => {
        doSearch(null, query, forceFresh);
      }, 0);
    },
    getQuery: () => q
  }));

  async function doSearch(e, queryOverride = null, forceFresh = false){
    e && e.preventDefault();
    const searchQuery = queryOverride || q;
    if(!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    onLoadingChange && onLoadingChange(true);
    
    // Clear previous results and status
    onResults && onResults({ fromCache: false, data: [], query: searchQuery });
    if (onStatusUpdate) {
      onStatusUpdate({});
    }
    
    if (useStreaming) {
      // Use streaming search
      try {
        const freshParam = forceFresh ? '&forceFresh=true' : '';
        const eventSource = new EventSource(`/api/proxy/search-stream?query=${encodeURIComponent(searchQuery)}${freshParam}`);
        const allResults = [];
        const scraperStatus = {};
        
        eventSource.addEventListener('start', (e) => {
          const data = JSON.parse(e.data);
          console.log('Search started:', data);
        });
        
        eventSource.addEventListener('status', (e) => {
          const data = JSON.parse(e.data);
          if (data.scrapers) {
            Object.assign(scraperStatus, data.scrapers);
            console.log('Scraper status:', scraperStatus);
            // Notify parent component of status updates
            if (onStatusUpdate) {
              onStatusUpdate(data.scrapers);
            }
          }
        });
        
        // Handle cache-ready event - stop loading immediately when cache results are available
        eventSource.addEventListener('cache-ready', (e) => {
          const data = JSON.parse(e.data);
          console.log('Cache ready - stopping loading, showing cached results');
          
          // Stop loading immediately
          setLoading(false);
          onLoadingChange && onLoadingChange(false);
          
          // Show cached results immediately
          if (data.data && Array.isArray(data.data)) {
            allResults.length = 0; // Clear previous
            allResults.push(...data.data);
            
            onResults && onResults({ 
              fromCache: true, 
              data: [...data.data],
              streaming: true,
              refreshing: true, // Indicate background refresh is happening
              scraperStatus: scraperStatus,
              message: data.message || 'Results from cache. Updating in background...',
              query: searchQuery // Store query for fresh search button
            });
          }
        });
        
        eventSource.addEventListener('results', (e) => {
          const data = JSON.parse(e.data);
          
          // Handle cached results (fromCache: true)
          if (data.fromCache && data.data && Array.isArray(data.data)) {
            console.log(`Received ${data.data.length} cached results`);
            allResults.length = 0; // Clear previous
            allResults.push(...data.data);
            
            onResults && onResults({ 
              fromCache: true, 
              data: [...data.data],
              streaming: true,
              refreshing: true,
              scraperStatus: scraperStatus,
              message: data.message || 'Results from cache. Updating in background...',
              query: searchQuery // Store query for fresh search button
            });
            return;
          }
          
          // Handle incremental scraper results
          if (data.results && Array.isArray(data.results) && data.scraper) {
            console.log(`Received ${data.count} results from ${data.scraper}`);
            
            // Add new results
            allResults.push(...data.results);
            
            // Send incremental update
            if (onIncrementalResults) {
              onIncrementalResults({
                scraper: data.scraper,
                results: data.results,
                totalResults: allResults.length,
                allResults: [...allResults]
              });
            }
            
            // Also update main results
            onResults && onResults({ 
              fromCache: false, 
              data: [...allResults],
              streaming: true,
              refreshing: false, // Not refreshing if we're getting fresh results
              scraperStatus: scraperStatus,
              query: searchQuery // Store query for fresh search button
            });
          } else if (data.incremental && data.data && Array.isArray(data.data)) {
            // Handle incremental updates
            allResults.length = 0;
            allResults.push(...data.data);
            
            onResults && onResults({ 
              fromCache: false, 
              data: [...data.data],
              streaming: true,
              refreshing: false,
              scraperStatus: scraperStatus,
              query: searchQuery // Store query for fresh search button
            });
          }
        });
        
        eventSource.addEventListener('error', (e) => {
          const data = JSON.parse(e.data);
          console.error('Scraper error:', data);
          setError(`Error from ${data.scraper}: ${data.error || data.message}`);
        });
        
        // Handle cache-updated event when background refresh finds new items
        eventSource.addEventListener('cache-updated', (e) => {
          const data = JSON.parse(e.data);
          console.log('Cache updated:', data);
          
          // Update results with merged data from backend
          if (data.data && Array.isArray(data.data)) {
            allResults.length = 0;
            allResults.push(...data.data);
            
            onResults && onResults({
              fromCache: true,
              data: [...data.data],
              streaming: true,
              refreshing: false,
              cacheUpdated: true,
              newItems: data.newItems || 0,
              updatedItems: data.updatedItems || 0,
              message: data.message || 'Results updated!',
              scraperStatus: scraperStatus,
              query: searchQuery // Store query for fresh search button
            });
          }
        });
        
        eventSource.addEventListener('complete', (e) => {
          const data = JSON.parse(e.data);
          console.log('Search completed:', data);
          
          eventSource.close();
          setLoading(false);
          onLoadingChange && onLoadingChange(false);
          
          // Final results update
          onResults && onResults({
            fromCache: data.fromCache || false,
            data: data.data || allResults,
            streaming: false,
            refreshing: false,
            scraperStatus: data.scraperStatus || scraperStatus,
            totalResults: data.totalResults || allResults.length,
            query: searchQuery // Store query for fresh search button
          });
        });
        
        // Handle connection errors
        eventSource.onerror = (err) => {
          console.error('EventSource error:', err);
          
          // Ensure EventSource is closed
          try {
            eventSource.close();
          } catch (closeError) {
            console.warn('Error closing EventSource:', closeError);
          }
          
          // If we have some results, keep them
          if (allResults.length > 0) {
            setLoading(false);
            onLoadingChange && onLoadingChange(false);
            onResults && onResults({ fromCache: false, data: allResults, query: searchQuery });
            setError('Connection interrupted, but some results were received.');
          } else {
            // No results yet, fallback to regular search
            console.log('Streaming failed, falling back to regular search...');
            fallbackToRegularSearch();
          }
        };
        
        // Fallback function for regular search
        const fallbackToRegularSearch = async () => {
          try {
            const freshParam = forceFresh ? '&forceFresh=true' : '';
            const res = await fetch(`/api/proxy/search?query=${encodeURIComponent(searchQuery)}${freshParam}`);
            const json = await res.json();
            
            if (!res.ok || json.error) {
              setError(json.error || 'Search failed. Please try again.');
              onResults && onResults({ fromCache: false, data: [], query: searchQuery });
            } else {
              onResults && onResults({ ...json, query: searchQuery });
            }
          } catch (e) {
            console.error('Fallback search error:', e);
            setError('Network error. Please check your connection and try again.');
            onResults && onResults({ fromCache: false, data: [], query: searchQuery });
          } finally {
            setLoading(false);
            onLoadingChange && onLoadingChange(false);
          }
        };
        
      } catch (e) {
        console.error('Streaming search error:', e);
        setError('Network error. Please check your connection and try again.');
        setLoading(false);
        onLoadingChange && onLoadingChange(false);
        onResults && onResults({ fromCache: false, data: [], query: searchQuery });
      }
    } else {
      // Fallback to regular search
      try {
        const freshParam = forceFresh ? '&forceFresh=true' : '';
        const res = await fetch(`/api/proxy/search?query=${encodeURIComponent(searchQuery)}${freshParam}`);
        const json = await res.json();
        
        if (!res.ok || json.error) {
          setError(json.error || 'Search failed. Please try again.');
          onResults && onResults({ fromCache: false, data: [], query: searchQuery });
        } else {
          onResults && onResults({ ...json, query: searchQuery });
        }
      } catch (e) {
        console.error('Search error:', e);
        setError('Network error. Please check your connection and try again.');
        onResults && onResults({ fromCache: false, data: [], query: searchQuery });
      } finally { 
        setLoading(false);
        onLoadingChange && onLoadingChange(false);
      }
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={doSearch} className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="relative group">
            <div className="absolute left-4 sm:left-5 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors z-10">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              value={q} 
              onChange={e=>setQ(e.target.value)} 
              placeholder="Search for products (e.g., iPhone, GoPro, Samsung TV)..." 
              className="w-full pl-12 sm:pl-14 pr-12 sm:pr-14 py-4 sm:py-5 text-base sm:text-lg border-2 border-slate-200/50 rounded-xl sm:rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200/50 transition-all disabled:bg-slate-50/50 disabled:cursor-not-allowed text-slate-900 placeholder-slate-400 shadow-lg hover:shadow-xl bg-white/90 backdrop-blur-sm font-medium" 
              disabled={loading}
            />
            {loading && (
              <div className="absolute right-4 sm:right-5 top-1/2 transform -translate-y-1/2">
                <Spinner size="sm" />
              </div>
            )}
          </div>
        </div>
        <button 
          type="submit"
          className="w-full sm:w-auto px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold text-base sm:text-lg rounded-xl sm:rounded-2xl shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 sm:min-w-[160px] transform hover:scale-105 hover:-translate-y-0.5 active:scale-95 glow-effect relative overflow-hidden group" 
          disabled={loading}
        >
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
          {loading ? (
            <>
              <Spinner size="sm" className="text-white relative z-10" />
              <span className="relative z-10">Searching...</span>
            </>
          ) : (
            <>
              <span className="relative z-10">Search</span>
              <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </form>
      {error && (
        <div className="mt-4 sm:mt-5 p-4 sm:p-5 bg-gradient-to-r from-red-50/90 to-pink-50/90 backdrop-blur-sm border-2 border-red-200/50 text-red-700 rounded-xl sm:rounded-2xl shadow-xl animate-slideIn glass-effect">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base sm:text-lg">Error</p>
              <p className="text-xs sm:text-sm font-medium break-words">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SearchBox;
