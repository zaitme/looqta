'use client';
import { useState, useRef, useEffect } from 'react';
import SearchBox from '../components/SearchBox';
import ResultCard from '../components/ResultCard';
import Spinner from '../components/Spinner';

export default function Page(){
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState(null);
  const [scraperStatuses, setScraperStatuses] = useState({});
  const [currentQuery, setCurrentQuery] = useState('');
  const searchBoxRef = useRef(null);

  const handleIncrementalResults = (incremental) => {
    // Update results with incremental data
    setResults({
      fromCache: false,
      data: incremental.allResults || [],
      streaming: true,
      scraperStatus: incremental.scraperStatus,
      query: incremental.query || currentQuery // Preserve query
    });
    
    // Update scraper statuses
    if (incremental.scraperStatus) {
      setScraperStatuses(incremental.scraperStatus);
    }
    
    // Show which scraper just returned results
    if (incremental.scraper) {
      setStreamingStatus({
        scraper: incremental.scraper,
        count: incremental.results?.length || 0,
        total: incremental.totalResults || 0
      });
      
      // Clear status after 3 seconds
      setTimeout(() => setStreamingStatus(null), 3000);
    }
  };

  const handleStatusUpdate = (statuses) => {
    if (statuses) {
      setScraperStatuses(statuses);
    }
  };

  // Initialize default scraper statuses when loading starts
  useEffect(() => {
    if (loading && Object.keys(scraperStatuses).length === 0) {
      setScraperStatuses({
        amazon: { status: 'pending', results: 0 },
        noon: { status: 'pending', results: 0 }
      });
    }
  }, [loading, scraperStatuses]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-12 px-4 sm:px-6 pt-16 sm:pt-20 pb-16 sm:pb-24 rounded-b-[2rem] sm:rounded-b-[3rem] shadow-2xl overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-90" style={{
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 8s ease infinite'
        }}></div>
        
        {/* Modern Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          }}></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto text-center z-10">
          <div className="inline-block mb-6 px-5 py-2.5 glass-effect rounded-full border border-white/30 shadow-lg animate-scaleIn">
            <span className="text-white text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">🇸🇦</span>
              <span>Price Comparison Made Easy</span>
            </span>
          </div>
          <h1 className="text-7xl md:text-8xl lg:text-9xl font-black mb-6 text-white drop-shadow-2xl animate-fadeInUp">
            <span className="block bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
              Looqta
            </span>
            <span className="block text-5xl md:text-6xl lg:text-7xl mt-3 font-bold opacity-95">لقطة</span>
          </h1>
          <p className="text-2xl md:text-3xl text-white/95 mb-4 font-bold drop-shadow-lg animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
            Smart choices for smart shoppers
          </p>
          <p className="text-lg md:text-xl text-white/80 font-medium animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            Compare prices from Amazon, Noon, and more in real-time
          </p>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 z-10">
        {/* Search Box */}
        <div className="animate-fadeInUp -mt-8 sm:-mt-12 mb-8 sm:mb-10">
          <div className="glass-effect rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 lg:p-8 border border-white/30 glow-effect">
            <SearchBox 
              ref={searchBoxRef}
              onResults={(newResults) => {
                setResults(newResults);
                // Store query from results if available
                if (newResults.query) {
                  setCurrentQuery(newResults.query);
                }
              }} 
              onLoadingChange={setLoading}
              onIncrementalResults={handleIncrementalResults}
              onStatusUpdate={handleStatusUpdate}
            />
          </div>
        </div>

        {/* Loading State - Always show when loading */}
        {loading && (
          <div className="mt-8 flex flex-col items-center justify-center py-16 animate-fadeInUp">
            {/* Main Spinner */}
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
              </div>
            </div>
            
            <p className="text-2xl font-bold text-gray-800 mb-2">Searching for the best prices...</p>
            <p className="text-gray-500 mb-8">This may take a few seconds</p>
            
            {/* Scraper Status Indicators - Always show default if none received */}
            <div className="w-full max-w-2xl space-y-4">
              {(Object.keys(scraperStatuses).length > 0 ? Object.entries(scraperStatuses) : [
                ['amazon', { status: 'pending', results: 0 }],
                ['noon', { status: 'pending', results: 0 }]
              ]).map(([scraperName, status], index) => (
                <div 
                  key={scraperName} 
                  className="flex items-center justify-between p-6 glass-effect rounded-2xl border border-white/30 shadow-xl animate-slideIn hover:shadow-2xl transition-all duration-300"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 relative">
                      {status.status === 'running' && (
                        <>
                          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 animate-ping opacity-20">
                            <div className="w-10 h-10 rounded-full bg-blue-400"></div>
                          </div>
                        </>
                      )}
                      {status.status === 'completed' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {status.status === 'error' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {(status.status === 'pending' || !status.status) && (
                        <div className="w-10 h-10 border-3 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-gray-800 capitalize text-lg sm:text-xl">{scraperName === 'amazon' ? 'Amazon' : scraperName === 'noon' ? 'Noon' : scraperName}</span>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        {status.status === 'running' && 'Scraping products...'}
                        {status.status === 'completed' && 'Search completed'}
                        {status.status === 'error' && 'Error occurred'}
                        {(status.status === 'pending' || !status.status) && 'Waiting to start...'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {status.status === 'running' && <span className="text-blue-600 animate-pulse">Searching...</span>}
                      {status.status === 'completed' && (
                        <span className="text-green-600">{status.results || 0} found</span>
                      )}
                      {status.status === 'error' && <span className="text-red-600">Error</span>}
                      {(status.status === 'pending' || !status.status) && <span className="text-gray-400">Waiting...</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Streaming Status Notification */}
            {streamingStatus && (
              <div className="mt-8 px-8 py-5 glass-effect border-2 border-green-300/50 rounded-2xl shadow-2xl animate-fadeInUp max-w-md glow-effect-green">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-xl animate-badge-pulse">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-black text-green-800 text-lg">
                      {streamingStatus.scraper === 'amazon' ? 'Amazon' : streamingStatus.scraper === 'noon' ? 'Noon' : streamingStatus.scraper} returned {streamingStatus.count} {streamingStatus.count === 1 ? 'result' : 'results'}
                    </p>
                    {streamingStatus.total > 0 && (
                      <p className="text-sm text-green-700 mt-1 font-bold">{streamingStatus.total} total products found so far</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Display */}
        {!loading && results && (
          <div className="mt-8 animate-fadeInUp">
            {/* Results Header */}
            <div className="mb-8 flex flex-wrap items-center gap-4">
              <span className={`px-6 py-3 rounded-full font-bold text-sm shadow-xl backdrop-blur-sm flex items-center gap-2 ${
                results.fromCache 
                  ? 'bg-gradient-to-r from-green-100/90 to-emerald-100/90 text-green-700 border-2 border-green-300/50 glass-effect' 
                  : 'bg-gradient-to-r from-indigo-100/90 to-purple-100/90 text-indigo-700 border-2 border-indigo-300/50 glass-effect'
              }`}>
                {results.fromCache ? (
                  <>
                    <span>✓</span>
                    <span>Cached Results</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Fresh Results</span>
                  </>
                )}
              </span>
              
              {/* Refreshing Indicator */}
              {results.refreshing && (
                <span className="px-6 py-3 rounded-full font-bold text-sm shadow-xl backdrop-blur-sm bg-gradient-to-r from-blue-100/90 to-cyan-100/90 text-blue-700 border-2 border-blue-300/50 glass-effect flex items-center gap-2 animate-pulse">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Updating in background...</span>
                </span>
              )}
              
              {/* Cache Updated Notification */}
              {results.cacheUpdated && (results.newItems > 0 || results.updatedItems > 0) && (
                <span className="px-6 py-3 rounded-full font-bold text-sm shadow-xl backdrop-blur-sm bg-gradient-to-r from-purple-100/90 to-pink-100/90 text-purple-700 border-2 border-purple-300/50 glass-effect flex items-center gap-2 animate-fadeInUp">
                  <span>✨</span>
                  <span>
                    {results.newItems > 0 && `${results.newItems} new`}
                    {results.newItems > 0 && results.updatedItems > 0 && ' • '}
                    {results.updatedItems > 0 && `${results.updatedItems} updated`}
                  </span>
                </span>
              )}
              
              <span className="text-slate-700 font-bold text-xl gradient-text-purple">
                {results.data.length} {results.data.length === 1 ? 'product' : 'products'} found
              </span>
              
              {/* Fresh Search Button */}
              {results.fromCache && results.query && (
                <button
                  onClick={() => {
                    if (results.query && searchBoxRef.current) {
                      searchBoxRef.current.search(results.query, true); // forceFresh = true
                    }
                  }}
                  className="px-6 py-3 rounded-full font-bold text-sm shadow-xl backdrop-blur-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-2 border-indigo-300/50 glass-effect flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !results.query}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Fresh Search</span>
                </button>
              )}
              
              {/* Status Message */}
              {results.message && (
                <span className="text-sm text-slate-600 font-medium italic">
                  {results.message}
                </span>
              )}
            </div>

            {results.data.length === 0 ? (
              <div className="card text-center py-20 animate-fadeInUp">
                <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-gray-800 mb-3">No results found</h3>
                <p className="text-gray-500 text-lg">Try a different search term or check your spelling</p>
              </div>
            ) : (
              <>
                {(() => {
                  // Calculate best deals once for both summary and grid
                  const validPriceProducts = results.data.filter(item => item.price && item.price > 0);
                  const uniquePrices = [...new Set(validPriceProducts.map(item => item.price))].sort((a, b) => a - b);
                  const bestPrice = uniquePrices.length > 0 ? uniquePrices[0] : null;
                  const secondPrice = uniquePrices.length > 1 ? uniquePrices[1] : null;
                  const thirdPrice = uniquePrices.length > 2 ? uniquePrices[2] : null;
                  
                  const bestDealsCount = bestPrice !== null ? validPriceProducts.filter(item => Math.abs(item.price - bestPrice) < 0.01).length : 0;
                  const secondDealsCount = secondPrice !== null ? validPriceProducts.filter(item => Math.abs(item.price - secondPrice) < 0.01).length : 0;
                  const thirdDealsCount = thirdPrice !== null ? validPriceProducts.filter(item => Math.abs(item.price - thirdPrice) < 0.01).length : 0;
                  
                  return (
                    <>
                      {/* Best Deals Summary Banner */}
                      {bestDealsCount > 0 && (
                        <div className="mb-8 p-6 glass-effect border-2 border-green-200/50 rounded-3xl shadow-2xl animate-fadeInUp glow-effect-green">
                          <div className="flex flex-wrap items-center gap-4 justify-center">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl animate-badge-float">🥇</span>
                              <span className="font-black text-green-700 text-lg">
                                {bestDealsCount} {bestDealsCount === 1 ? 'Best Deal' : 'Best Deals'} Found
                              </span>
                            </div>
                            {secondDealsCount > 0 && (
                              <>
                                <span className="text-slate-300 text-xl">•</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">🥈</span>
                                  <span className="font-bold text-blue-600 text-lg">
                                    {secondDealsCount} {secondDealsCount === 1 ? '2nd Best' : '2nd Best'}
                                  </span>
                                </div>
                              </>
                            )}
                            {thirdDealsCount > 0 && (
                              <>
                                <span className="text-slate-300 text-xl">•</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">🥉</span>
                                  <span className="font-bold text-purple-600 text-lg">
                                    {thirdDealsCount} {thirdDealsCount === 1 ? '3rd Best' : '3rd Best'}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Results Grid */}
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {results.data.map((r,i)=> {
                          // Compare prices to identify deals (handle floating point precision)
                          const rPrice = r.price && r.price > 0 ? r.price : null;
                          let dealRank = null;
                          
                          if (rPrice !== null && bestPrice !== null && Math.abs(rPrice - bestPrice) < 0.01) {
                            dealRank = 1;
                          } else if (rPrice !== null && secondPrice !== null && Math.abs(rPrice - secondPrice) < 0.01) {
                            dealRank = 2;
                          } else if (rPrice !== null && thirdPrice !== null && Math.abs(rPrice - thirdPrice) < 0.01) {
                            dealRank = 3;
                          }
                          
                          return (
                            <div key={`${r.site}-${i}`} className="animate-fadeInUp" style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
                              <ResultCard 
                                r={r} 
                                index={i} 
                                isBestDeal={dealRank === 1}
                                isSecondDeal={dealRank === 2}
                                isThirdDeal={dealRank === 3}
                                dealRank={dealRank}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Benefits & Demo Section - Show when not loading and (no results or empty results) */}
        {!loading && (!results || (results && results.data && results.data.length === 0)) && (
          <>
            {/* Benefits Section */}
            <div className="mt-20 mb-20 animate-fadeInUp">
              <div className="text-center mb-16">
                <h2 className="text-5xl md:text-6xl font-black gradient-text-purple mb-6">Why Choose Looqta?</h2>
                <p className="text-slate-600 text-xl font-semibold">Everything you need to make smart shopping decisions</p>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    icon: '💰',
                    title: 'Save Money',
                    description: 'Compare prices from multiple retailers instantly and find the best deals',
                    color: 'from-indigo-500 to-purple-500',
                  },
                  {
                    icon: '⚡',
                    title: 'Fast Results',
                    description: 'Get real-time price comparisons in seconds, not minutes',
                    color: 'from-green-500 to-emerald-500',
                  },
                  {
                    icon: '🛡️',
                    title: 'Trusted Sources',
                    description: 'Compare prices from Amazon and Noon - the region\'s leading e-commerce platforms',
                    color: 'from-pink-500 to-rose-500',
                  }
                ].map((benefit, index) => (
                  <div 
                    key={benefit.title}
                    className="card group hover:scale-105 transition-all duration-500 cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className={`w-24 h-24 mx-auto mb-8 bg-gradient-to-br ${benefit.color} rounded-3xl flex items-center justify-center shadow-2xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-500 animate-float`} style={{ animationDelay: `${index * 0.2}s` }}>
                      <span className="text-5xl">{benefit.icon}</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 mb-4 text-center gradient-text-purple">{benefit.title}</h3>
                    <p className="text-slate-600 text-center leading-relaxed text-lg font-medium">{benefit.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Demo Search Examples */}
            <div className="mt-20 mb-20 animate-fadeInUp">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-black gradient-text-purple mb-4">Try These Popular Searches</h2>
                <p className="text-slate-600 text-lg font-semibold">Click any term to start comparing prices instantly</p>
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
                {['iPhone', 'Laptop', 'Headphones', 'Smart Watch', 'Camera', 'Tablet'].map((term, index) => (
                  <button
                    key={term}
                    onClick={() => {
                      if (searchBoxRef.current) {
                        searchBoxRef.current.search(term);
                      }
                    }}
                    className="group px-8 py-4 glass-effect border-2 border-white/30 rounded-2xl hover:border-purple-400/50 hover:bg-gradient-to-r hover:from-indigo-50/90 hover:to-purple-50/90 text-slate-700 font-bold transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-110 hover:-translate-y-1 transform text-lg"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <span className="flex items-center gap-3">
                      {term}
                      <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Empty State */}
            <div className="mt-20 mb-20 text-center py-24 animate-fadeInUp">
              <div className="inline-block p-8 glass-effect border-2 border-purple-200/50 rounded-3xl mb-8 shadow-2xl glow-effect">
                <svg className="w-32 h-32 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-4xl font-black gradient-text-purple mb-4">Start searching to compare prices</h3>
              <p className="text-slate-600 text-xl font-semibold">Enter a product name above or try one of the popular searches</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
