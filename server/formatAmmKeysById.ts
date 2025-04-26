import {
  ApiPoolInfoV4,
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  MARKET_STATE_LAYOUT_V3,
  Market,
  SPL_MINT_LAYOUT
} from '@raydium-io/raydium-sdk';
import {
  PublicKey
} from '@solana/web3.js';

import { connection } from './config';

// Raydium Concentrated Liquidity pool program ID
const CLMM_PROGRAM_ID = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';

export async function formatAmmKeysById(id: string): Promise<ApiPoolInfoV4> {
  try {
    console.log(`Fetching pool info for ID: ${id}`);
    
    // Validate the pool ID is a valid PublicKey
    let poolPublicKey: PublicKey;
    try {
      poolPublicKey = new PublicKey(id);
    } catch (err) {
      throw new Error(`Invalid pool ID format: ${id}`);
    }
    
    // Get account info
    const account = await connection.getAccountInfo(poolPublicKey);
    if (account === null) {
      throw new Error(`Pool account not found: ${id}`);
    }
    
    console.log(`Pool account data length: ${account.data.length} bytes`);
    console.log(`Pool owner: ${account.owner.toString()}`);
    
    // Check if this is a Concentrated Liquidity pool
    if (account.owner.toString() === CLMM_PROGRAM_ID) {
      throw new Error(`Pool ID ${id} is a Concentrated Liquidity pool (CLMM). The current implementation only supports Standard V4 pools. Please use a Standard V4 pool ID instead or change the poolType parameter to 'standard' in the API call.`);
    }
    
    // Safely decode the account data
    let info;
    try {
      info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);
    } catch (err) {
      console.error('Error decoding pool data:', err);
      throw new Error(`Invalid pool data format. This might not be a valid Raydium pool or the pool version is not supported.`);
    }
    
    // Get market account
    const marketId = info.marketId;
    const marketAccount = await connection.getAccountInfo(marketId);
    if (marketAccount === null) {
      throw new Error(`Market account not found: ${marketId}`);
    }
    
    // Safely decode market data
    let marketInfo;
    try {
      marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);
    } catch (err) {
      console.error('Error decoding market data:', err);
      throw new Error(`Invalid market data format for market: ${marketId}`);
    }
    
    // Get LP mint account
    const lpMint = info.lpMint;
    const lpMintAccount = await connection.getAccountInfo(lpMint);
    if (lpMintAccount === null) {
      throw new Error(`LP mint account not found: ${lpMint}`);
    }
    
    // Safely decode LP mint data
    let lpMintInfo;
    try {
      lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);
    } catch (err) {
      console.error('Error decoding LP mint data:', err);
      throw new Error(`Invalid LP mint data format for mint: ${lpMint}`);
    }
    
    return {
      id,
      baseMint: info.baseMint.toString(),
      quoteMint: info.quoteMint.toString(),
      lpMint: info.lpMint.toString(),
      baseDecimals: info.baseDecimal.toNumber(),
      quoteDecimals: info.quoteDecimal.toNumber(),
      lpDecimals: lpMintInfo.decimals,
      version: 4,
      programId: account.owner.toString(),
      authority: Liquidity.getAssociatedAuthority({ programId: account.owner }).publicKey.toString(),
      openOrders: info.openOrders.toString(),
      targetOrders: info.targetOrders.toString(),
      baseVault: info.baseVault.toString(),
      quoteVault: info.quoteVault.toString(),
      withdrawQueue: info.withdrawQueue.toString(),
      lpVault: info.lpVault.toString(),
      marketVersion: 3,
      marketProgramId: info.marketProgramId.toString(),
      marketId: info.marketId.toString(),
      marketAuthority: Market.getAssociatedAuthority({ programId: info.marketProgramId, marketId: info.marketId }).publicKey.toString(),
      marketBaseVault: marketInfo.baseVault.toString(),
      marketQuoteVault: marketInfo.quoteVault.toString(),
      marketBids: marketInfo.bids.toString(),
      marketAsks: marketInfo.asks.toString(),
      marketEventQueue: marketInfo.eventQueue.toString(),
      lookupTableAccount: PublicKey.default.toString()
    };
  } catch (err) {
    console.error('Error fetching pool info:', err);
    throw err;
  }
}