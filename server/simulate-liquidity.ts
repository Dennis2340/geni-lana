// Raydium SDK V2 liquidity simulation backend handler
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { Connection, PublicKey } from "@solana/web3.js";
import type { Request, Response } from "express";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function simulateLiquidityHandler(req: Request, res: Response) {
  console.log("[simulate-liquidity] Using RPC URL:", RPC_URL);

  try {
    const { wallet, poolId, amount, riskLevel } = req.body;
    if (!wallet || !poolId) {
      return res.status(400).json({ success: false, error: "Missing wallet or poolId" });
    }
    const connection = new Connection(RPC_URL);
    const raydium = await Raydium.load({ connection });
    // Fetch pool info
    const poolInfoArr = await raydium.api.fetchPoolById({ ids: poolId });
    type PoolInfo = {
      priceLower?: string;
      priceUpper?: string;
      feeRate?: string | number;
      feeTier?: string | number;
      apr7d?: string | number;
      apr?: string | number;
    };
    const poolInfo: PoolInfo | undefined = Array.isArray(poolInfoArr) ? poolInfoArr[0] : poolInfoArr;
    if (!poolInfo) {
      return res.status(404).json({ success: false, error: "Pool not found" });
    }
    
    
    const simulation: {
      wallet: string;
      riskLevel: number;
      priceRange: {
        minPrice: string;
        maxPrice: string;
        rangePct: number;
      };
      feeTier: string;
      estimatedAPR: string;
      networkFee: number;
      impactUSD: string;
    } = {
      wallet,
      riskLevel,
      priceRange: {
        minPrice: poolInfo.priceLower || "0.00",
        maxPrice: poolInfo.priceUpper || "0.00",
        rangePct: 10,
      },
      feeTier: (poolInfo.feeRate !== undefined ? String(poolInfo.feeRate) : (poolInfo.feeTier !== undefined ? String(poolInfo.feeTier) : "0.0%")),
      estimatedAPR: (poolInfo.apr7d !== undefined ? String(poolInfo.apr7d) : (poolInfo.apr !== undefined ? String(poolInfo.apr) : "0.0")),
      networkFee: 0.000005,
      impactUSD: "$0.20"
    };
    return res.json({ success: true, simulation });
  } catch (error: any) {
    console.error("Simulation error:", error);
    return res.status(500).json({ success: false, error: error.message || "Simulation failed" });
  }
}
