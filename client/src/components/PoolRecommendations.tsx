import React, { useEffect, useState } from "react";

interface PoolRecommendationsProps {
  riskLevel: number;
  sortField?: 'apr' | 'tvl' | 'volume24h';
  sortOrder?: 'asc' | 'desc';
  tokenSymbols?: string[];
  onSelect?: (poolId: string) => void;
}

// RaydiumPool type should match backend exactly
interface RaydiumPool {
  id: string;
  name: string;
  poolType: string;
  tvl: number;
  volume24h: number;
  fee: number;
  token1: string;
  token1Symbol: string;
  token1Logo: string;
  token2: string;
  token2Symbol: string;
  token2Logo: string;
  apr: number;
  feeTier?: string;
}

interface MintToken {
  address: string;
  symbol: string;
  name: string;
  logoURI: string;
  decimals: number;
}

// DisplayPool is for UI-specific fields (derived from RaydiumPool but with formatted fields)
type DisplayPool = Omit<RaydiumPool, "volume24h" | "apr" | "feeTier"> & {
  feeTier: string; // always string for display
  priceRange: string;
  volume24h: string; // formatted for display
  apr: string; // formatted for display
  isRecommended: boolean;
};

const POOLS_PER_PAGE = 3;

const PoolRecommendations: React.FC<PoolRecommendationsProps> = ({ riskLevel, sortField, sortOrder, tokenSymbols, onSelect }: PoolRecommendationsProps) => {
  const [displayPools, setDisplayPools] = useState<DisplayPool[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  // Map riskLevel to TVL threshold for backend
  function riskLevelToTVL(riskLevel: number): number | undefined {
    if (riskLevel <= 3) return 100000;
    if (riskLevel <= 6) return 50000;
    if (riskLevel <= 10) return 10000;
    return undefined;
  }

  const hideLowTvl = riskLevelToTVL(riskLevel);

  // Fetch recommended pools from Genilana backend (Raydium)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    const fetchPools = async () => {
      try {
        const url = `/api/raydium/pools/recommended?limit=${POOLS_PER_PAGE}&offset=${offset}`;
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
        });
        const contentType = res.headers.get('content-type');
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`[GenilanaFetch] ${res.status}: ${text}`);
        }
        if (contentType && contentType.includes('application/json')) {
          const json = await res.json();
          console.log('[Genilana] Raw pool API response:', json);
          if (!isMounted) return;
          const filteredPools = filterAndSortPools(json.pools);
          setDisplayPools(prev => offset === 0 ? filteredPools : [...prev, ...filteredPools]);
          setHasMore(json.pools.length === POOLS_PER_PAGE);
        } else {
          const text = await res.text();
          console.error('[Genilana] Unexpected response type:', contentType, 'Body:', text);
          throw new Error(`[GenilanaFetch] Unexpected response type: ${contentType}. Body: ${text}`);
        }
      } catch (e: any) {
        console.error('[Genilana] Pool fetch error:', e);
        if (isMounted) {
          setHasMore(false);
          setError(e?.message || 'Failed to load pools');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchPools();
    return () => { isMounted = false; };
  }, [offset, hideLowTvl, sortField, sortOrder, tokenSymbols]);

  // Helper to filter and sort pools for display
  function filterAndSortPools(pools: RaydiumPool[]): DisplayPool[] {
    let filtered = pools;
    if (tokenSymbols && tokenSymbols.length > 0) {
      filtered = filtered.filter(
        (p) =>
          tokenSymbols.some(
            (sym) =>
              sym.toLowerCase() === p.token1Symbol.toLowerCase() ||
              sym.toLowerCase() === p.token2Symbol.toLowerCase()
          )
      );
    }
    if (sortField) {
      filtered = filtered.sort((a, b) => {
        const aVal = a[sortField] ?? 0;
        const bVal = b[sortField] ?? 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return filtered.map((p) => ({
      ...p,
      feeTier: p.feeTier || `${(p.fee * 100).toFixed(2)}%`,
      priceRange: getPriceRangeDescription(riskLevel, p.poolType),
      volume24h: formatVolume(p.volume24h),
      apr: p.apr.toFixed(1),
      isRecommended: false
    }));
  }

  // Reset pools when riskLevel changes
  useEffect(() => {
    setOffset(0);
  }, [riskLevel, hideLowTvl]);

  // Show More handler
  const handleShowMore = () => {
    setOffset(prev => prev + POOLS_PER_PAGE);
  };
  
  
  // Function to calculate price range description based on risk level
  const getPriceRangeDescription = (risk: number, poolType: string): string => {
    // Stablecoin or concentrated pools get tighter ranges
    if (poolType === "LST" || (poolType === "concentrated" && risk <= 3)) {
      const rangePercentage = 0.5 + (risk * 0.1);
      return `Ultra-narrow range (±${rangePercentage.toFixed(1)}%)`;
    }
    let rangePercentage: number;
    if (risk <= 3) {
      rangePercentage = risk * 0.8;
      return `Ultra-narrow range (±${rangePercentage.toFixed(1)}%)`;
    } else if (risk <= 5) {
      rangePercentage = risk * 1.0;
      return `Narrow range (±${rangePercentage.toFixed(1)}%)`;
    } else if (risk <= 8) {
      rangePercentage = risk * 1.2;
      return `Moderate range (±${rangePercentage.toFixed(1)}%)`;
    } else if (risk <= 12) {
      rangePercentage = risk * 1.5;
      return `Wide range (±${rangePercentage.toFixed(1)}%)`;
    } else {
      rangePercentage = risk * 2.0;
      return `Extra wide range (±${rangePercentage.toFixed(1)}%)`;
    }
  };
  
  // Format volume with proper notation
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`;
    } else {
      return `$${volume.toFixed(0)}`;
    }
  };
  

  
  return (
    <div className="mt-4 space-y-3">
      <div className="text-lg font-medium text-white mb-1 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Genilana Recommended Pools
      </div>


      
      {loading && (
        <div className="p-4 text-center text-gray-400">
          <div className="animate-pulse flex justify-center mb-2">
            <div className="h-8 w-8 bg-blue-400 bg-opacity-20 rounded-full"></div>
          </div>
          Loading pools based on your risk profile...
        </div>
      )}
      {error && (
        <div className="p-4 text-center text-red-400">
          {error}
        </div>
      )}
      
      {displayPools.map((pool: DisplayPool) => (
        <div 
          key={pool.id}
          className="bg-gray-800 rounded-xl p-4 border border-gray-700 cursor-pointer hover:border-blue-500 hover:bg-gray-800/70 transition relative"
          onClick={() => onSelect?.(pool.id)}
        >
          {pool.isRecommended && (
            <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full bg-green-500 bg-opacity-20 text-green-400 font-medium">
              Recommended
            </div>
          )}
          
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <div className="flex -space-x-1">
                  <img src={pool.token1Logo} alt={pool.token1} className="h-6 w-6 rounded-full ring-2 ring-gray-900" />
                  <img src={pool.token2Logo} alt={pool.token2} className="h-6 w-6 rounded-full ring-2 ring-gray-900" />
                </div>
                <h4 className="font-medium text-white">{pool.name}</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500 bg-opacity-20 text-blue-400 font-medium">{pool.feeTier} Fee</span>
              </div>
              <button
                className="mt-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow"
                onClick={() => onSelect?.(pool.id)}
              >
                Select Pool
              </button>
              
              <div className="mt-2 space-y-1">
                <div className="flex items-center text-xs text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{pool.priceRange}</span>
                </div>
                
                <div className="flex items-center text-xs text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>24h Volume: {pool.volume24h}</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="bg-gradient-to-r from-blue-600/20 to-blue-400/20 px-3 py-2 rounded-lg">
                <p className="text-blue-400 font-medium text-lg">{pool.apr}%</p>
                <p className="text-xs text-gray-400">Est. Annual Yield</p>
              </div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-700 flex justify-end">
            <button 
              className="text-sm text-blue-400 font-medium hover:text-blue-300 transition flex items-center"
              onClick={(e) => { e.stopPropagation(); onSelect?.(pool.id); }}
            >
              Select Pool
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600 transition"
            onClick={handleShowMore}
          >
            Show More
          </button>
        </div>
      )}
    </div>
  );
};

export default PoolRecommendations;
