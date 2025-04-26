// Meteora pools data service
import { z } from "zod";
import fetch from "node-fetch";

// Schema for Meteora pool
export const poolSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["DLMM", "DynamicAMM", "Stake2Earn", "FarmPool", "LST", "MultiToken", "Launch"]),
  tvl: z.number(),
  volume24h: z.number(),
  fee: z.number(),
  binStep: z.number().optional(),
  token1: z.string(),
  token1Symbol: z.string(),
  token1Logo: z.string(),
  token2: z.string(),
  token2Symbol: z.string(),
  token2Logo: z.string(),
  apr: z.number(),
  feeTier: z.string().optional(),
});

export type MeteoraPool = z.infer<typeof poolSchema>;

// Fetch pools dynamically from Meteora API and map to MeteoraPool type
export async function fetchMeteoraPools({
  page = 0,
  limit = 50,
  sort_key = "Volume",
  order_by = "Descending",
  include_unknown = true,
  hide_low_tvl,
  hide_low_apr,
  search_term,
  tags
}: {
  page?: number;
  limit?: number;
  sort_key?: string;
  order_by?: string;
  include_unknown?: boolean;
  hide_low_tvl?: number;
  hide_low_apr?: boolean;
  search_term?: string;
  tags?: string[];
} = {}): Promise<MeteoraPool[]> {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(limit));
  // Fix for API: sort_key must be one of the allowed values (lowercase)
  // Allowed: tvl, volume, feetvlratio, lm, feetvlratio30m, feetvlratio1h, feetvlratio2h, feetvlratio4h, feetvlratio12h, volume30m, volume1h, volume2h, volume4h, volume12h
  let fixedSortKey = sort_key.toLowerCase();
  if (fixedSortKey === 'apr') fixedSortKey = 'feetvlratio'; // map apr to a valid metric if needed
  if (fixedSortKey === 'volume') fixedSortKey = 'volume';
  if (fixedSortKey === 'tvl') fixedSortKey = 'tvl';
  // fallback to 'volume' if not recognized
  const allowedSortKeys = ['tvl','volume','feetvlratio','lm','feetvlratio30m','feetvlratio1h','feetvlratio2h','feetvlratio4h','feetvlratio12h','volume30m','volume1h','volume2h','volume4h','volume12h'];
  if (!allowedSortKeys.includes(fixedSortKey)) fixedSortKey = 'volume';
  params.append("sort_key", fixedSortKey);
  // Fix for API: order_by must be 'asc' or 'desc', not 'Ascending'/'Descending'
  let fixedOrderBy = order_by;
  if (order_by.toLowerCase() === 'ascending') fixedOrderBy = 'asc';
  else if (order_by.toLowerCase() === 'descending') fixedOrderBy = 'desc';
  params.append("order_by", fixedOrderBy);
  if (include_unknown !== undefined) params.append("include_unknown", String(include_unknown));
  if (hide_low_tvl !== undefined) params.append("hide_low_tvl", String(hide_low_tvl));
  if (hide_low_apr !== undefined) params.append("hide_low_apr", String(hide_low_apr));
  if (search_term) params.append("search_term", search_term);
  if (tags && tags.length) tags.forEach(tag => params.append("tags", tag));

  const url = `https://dlmm-api.meteora.ag/pair/all_with_pagination?${params.toString()}`;
  console.log('[fetchMeteoraPools] Request URL:', url);
  const response = await fetch(url);
if (!response.ok) {
  const errorText = await response.text();
  console.error(`[fetchMeteoraPools] Failed to fetch pools. Status: ${response.status}, Body: ${errorText}`);
  throw new Error(`Failed to fetch pools: ${response.status} ${response.statusText}`);
}
  const apiPools = await response.json();
  console.log('[fetchMeteoraPools] Raw API pools:', apiPools);

  // The API now returns { pairs: [...] }, so map from apiPools.pairs
  const pairs = Array.isArray(apiPools.pairs) ? apiPools.pairs : [];
  const mapped = pairs.map((apiPool: any) => ({
    id: apiPool.address || apiPool.id || "",
    name: apiPool.name || "",
    category: apiPool.category || "DLMM",
    tvl: Number(apiPool.liquidity) || 0,
    volume24h: Number(apiPool.trade_volume_24h) || 0,
    fee: Number(apiPool.base_fee_percentage) || 0,
    binStep: apiPool.bin_step,
    token1: apiPool.mint_x || "",
    token1Symbol: apiPool.token1Symbol || "",
    token1Logo: apiPool.token1Logo || "",
    token2: apiPool.mint_y || "",
    token2Symbol: apiPool.token2Symbol || "",
    token2Logo: apiPool.token2Logo || "",
    apr: Number(apiPool.apr) || 0,
    feeTier: apiPool.base_fee_percentage ? String(apiPool.base_fee_percentage) : undefined,
  }));
  console.log('[fetchMeteoraPools] Mapped pools:', mapped);
  return mapped;
}

// Function to get all pools (legacy, now dynamic)
export async function getAllPools(options = {}) {
  return await fetchMeteoraPools(options);
}

// Function to get pools by category
export async function getPoolsByCategory(category: MeteoraPool["category"]): Promise<MeteoraPool[]> {
  const pools = await getAllPools();
  return pools.filter((pool: MeteoraPool) => pool.category === category);
}

// Function to get a pool by ID
export async function getPoolById(id: string): Promise<MeteoraPool | undefined> {
  const pools = await getAllPools();
  return pools.find((pool: MeteoraPool) => pool.id === id);
}

// Function to get recommended pools based on risk level, limit, and offset
export async function getRecommendedPools(riskLevel: number, limit: number = 3, hideLowTvl?: number, offset: number = 0): Promise<MeteoraPool[]> {
  const pools = await fetchMeteoraPools({ limit: 50, hide_low_tvl: hideLowTvl });
  // Just sort by APR desc and paginate, do not force any pool to the top
  const sorted = pools.sort((a, b) => b.apr - a.apr);
  return sorted.slice(offset, offset + limit);
}

// Calculate estimated APR based on pool data and risk level
export async function calculateEstimatedAPR(pool: MeteoraPool, riskLevel: number): Promise<number> {
  // Base APR from pool data
  let baseAPR = pool.apr;
  
  // Adjust based on position size and risk level
  // Higher risk = potentially higher returns due to more aggressive positioning
  const riskMultiplier = 1 + (riskLevel - 5) / 20; // 0.75x at risk=0, 1.5x at risk=15
  
  // Calculate final estimated APR
  const estimatedAPR = baseAPR * riskMultiplier;
  
  // Add some small random variation to simulate different market conditions
  return Math.round(estimatedAPR * (1 + (Math.random() * 0.1 - 0.05)) * 10) / 10;
}