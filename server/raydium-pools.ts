// raydium-pools.ts
// Raydium pools data service for Genilana
import { z } from "zod";
import fetch from "node-fetch";

// Schema for Raydium pool (matches Raydium API fields, adapted for Genilana frontend)
export const raydiumPoolSchema = z.object({
  id: z.string(),
  name: z.string(),
  poolType: z.string(),
  tvl: z.number(),
  volume24h: z.number(),
  fee: z.number(),
  token1: z.string(),
  token1Symbol: z.string(),
  token1Logo: z.string(),
  token2: z.string(),
  token2Symbol: z.string(),
  token2Logo: z.string(),
  apr: z.number(),
  feeTier: z.string().optional(),
});

export type RaydiumPool = z.infer<typeof raydiumPoolSchema>;

// Fetch Raydium mint list
export async function fetchRaydiumMintList() {
  const res = await fetch('https://api-v3.raydium.io/mint/list');
  const json = await res.json();
  return json.data.mintList;
}


export async function fetchRaydiumPools({
  pageSize = 50,
  page = 1
}: {
  pageSize?: number;
  page?: number;
} = {}): Promise<RaydiumPool[]> {
  const url = `https://api-v3.raydium.io/pools/info/list?poolType=standard&poolSortField=default&sortType=desc&pageSize=${pageSize}&page=${page}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success || !json.data || !Array.isArray(json.data.data)) {
      console.error("Raydium API error or unexpected response structure:", json);
      return [];
    }
    return json.data.data.map((pool: any) => ({
      id: pool.id || pool.pool_id || pool.lpMint || '',
      name: `${pool.mintA?.symbol || ''}/${pool.mintB?.symbol || ''}`,
      poolType: pool.type || pool.poolType || '',
      tvl: Number(pool.tvl) || 0,
      volume24h: Number(pool.day?.volume || 0),
      fee: Number(pool.feeRate || 0),
      token1: pool.mintA?.address || '',
      token1Symbol: pool.mintA?.symbol || '',
      token1Logo: pool.mintA?.logoURI || '',
      token2: pool.mintB?.address || '',
      token2Symbol: pool.mintB?.symbol || '',
      token2Logo: pool.mintB?.logoURI || '',
      apr: Number(pool.day?.apr || 0),
      feeTier: pool.feeTier ? String(pool.feeTier) : (pool.feeRate ? String(pool.feeRate) : undefined)
    }));
  } catch (error) {
    console.error("Failed to fetch Raydium pools:", error);
    return [];
  }
}


// Function to get recommended Raydium pools for Genilana, abstracting riskLevel etc.
// Abstract all filtering from the user. Just return the top pools.
export async function getRecommendedRaydiumPools({ limit = 3, offset = 0 }: { limit?: number; offset?: number }) {
  // Always fetch the default sorted pool list and slice for recommendations
  const pools = await fetchRaydiumPools({ pageSize: 50, page: 1 });
  // Optionally, you can sort/filter here if you want to recommend by APR, TVL, etc.
  // For now, just return the top pools
  return pools.slice(offset, offset + limit);
}


// Fetch a single pool by ID
export async function getRaydiumPoolById(id: string): Promise<RaydiumPool | undefined> {
  const pools = await fetchRaydiumPools();
  return pools.find(pool => pool.id === id);
}
