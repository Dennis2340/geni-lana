import assert from 'assert';
import {
  TOKEN_PROGRAM_ID,
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TokenAmount,
  SPL_ACCOUNT_LAYOUT,
} from '@raydium-io/raydium-sdk';
import { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { formatAmmKeysById } from './formatAmmKeysById';
import { buildTx, getWalletTokenAccount, getATAAddress } from './utils';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';

// Define common token constants for convenience
const DEFAULT_TOKEN = {
  SOL: new Token(
    TOKEN_PROGRAM_ID, // Use TOKEN_PROGRAM_ID instead of chain ID
    new PublicKey('So11111111111111111111111111111111111111112'),
    9,
    'SOL',
    'Wrapped SOL'
  ),
  USDC: new Token(
    TOKEN_PROGRAM_ID,
    new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    6,
    'USDC',
    'USD Coin'
  ),
  RAY: new Token(
    TOKEN_PROGRAM_ID,
    new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
    6,
    'RAY',
    'Raydium'
  ),
};

// Token map for quick lookup
const TOKEN_MAP: Record<string, Token> = {
  'So11111111111111111111111111111111111111112': DEFAULT_TOKEN.SOL,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': DEFAULT_TOKEN.USDC,
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': DEFAULT_TOKEN.RAY,
};

// Transaction version (legacy, as in demo)
const makeTxVersion = 0;

/**
 * Add liquidity to a Raydium pool
 * Builds an unsigned transaction and returns it as base64 for frontend signing.
 */
export async function addLiquidityToPool({
  wallet,
  poolId,
  tokenA,
  tokenB,
  riskLevel,
  amount,
  slippage = 1, // percent, default 1%
}: {
  wallet: string;
  poolId: string;
  tokenA: string; // base token mint
  tokenB: string; // quote token mint
  riskLevel: number;
  amount: number; // amount of tokenA (base) in natural units
  slippage?: number;
}): Promise<{ 
  transaction: string; 
  anotherAmount: string; 
  transactionType: 'createAccounts' | 'addLiquidity';
  missingAccounts?: string[];
  nextStep?: string;
}> {
  // Validate required parameters
  if (!wallet || !poolId || !tokenA || !tokenB || !amount) {
    throw new Error('Missing required parameters for addLiquidityToPool');
  }

  // Initialize connection with more reliable settings
  const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  console.log(`Using RPC URL: ${RPC_URL}`);
  
  // Create a connection with commitment level and confirmation strategy
  const connection = new Connection(RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000, // 60 seconds timeout
    disableRetryOnRateLimit: false,
  });
  
  const owner = new PublicKey(wallet);

  try {
    // Validate the pool ID is a valid PublicKey
    try {
      new PublicKey(poolId);
    } catch (err) {
      throw new Error(`Invalid pool ID format: ${poolId}`);
    }
    
    // 1. Fetch pool info and keys
    console.log(`Fetching pool info for ID: ${poolId}`);
    let targetPoolInfo;
    try {
      targetPoolInfo = await formatAmmKeysById(poolId);
    } catch (error) {
      console.error('Error fetching pool info:', error);
      throw new Error(`Cannot find or decode the target pool: ${poolId}. Please verify that this is a valid Raydium pool ID.`);
    }
    
    assert(targetPoolInfo, 'Cannot find the target pool');
    const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;
    
    // 2. Prepare token objects and amounts
    // Try to use predefined tokens first, or create new Token objects if not in our map
    let baseToken = TOKEN_MAP[tokenA];
    let quoteToken = TOKEN_MAP[tokenB];
    
    if (!baseToken) {
      // Create a new Token object if not in our map
      baseToken = new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey(tokenA),
        targetPoolInfo.baseDecimals,
        '', // We don't need symbol/name for the transaction
        ''
      );
    }
    
    if (!quoteToken) {
      // Create a new Token object if not in our map
      quoteToken = new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey(tokenB),
        targetPoolInfo.quoteDecimals,
        '',
        ''
      );
    }
    
    const inputTokenAmount = new TokenAmount(baseToken, amount);
    const slippagePct = new Percent(slippage, 100);

    // 3. Fetch user token accounts
    const walletTokenAccounts = await getWalletTokenAccount(connection, owner);
    
    // Log token accounts for debugging
    console.log(`Found ${walletTokenAccounts.length} token accounts for wallet ${wallet}`);
    walletTokenAccounts.forEach((account, index) => {
      console.log(`Token account ${index + 1}:`, {
        pubkey: account.pubkey.toString(),
        mint: account.accountInfo.mint.toString(),
        owner: account.accountInfo.owner.toString(),
        amount: account.accountInfo.amount.toString()
      });
    });
    
    // Check if wallet has the required token accounts
    const hasBaseToken = walletTokenAccounts.some(account => 
      account.accountInfo.mint.toString() === tokenA);
    const hasQuoteToken = walletTokenAccounts.some(account => 
      account.accountInfo.mint.toString() === tokenB);
    
    if (!hasBaseToken) {
      console.warn(`Wallet does not have an account for base token ${tokenA}`);
    }
    
    if (!hasQuoteToken) {
      console.warn(`Wallet does not have an account for quote token ${tokenB}`);
    }
    
    // Create instructions for token accounts if they don't exist
    const createAccountInstructions: TransactionInstruction[] = [];
    
    if (!hasBaseToken) {
      console.log(`Creating instruction for base token account: ${tokenA}`);
      const baseTokenMint = new PublicKey(tokenA);
      const { publicKey: ataAddress } = getATAAddress(
        TOKEN_PROGRAM_ID, 
        owner, 
        baseTokenMint
      );
      
      // Create instruction for base token ATA
      const createBaseTokenAccountIx = createAssociatedTokenAccountInstruction(
        owner, // payer
        ataAddress, // associatedToken
        owner, // owner
        baseTokenMint // mint
      );
      
      createAccountInstructions.push(createBaseTokenAccountIx);
    }
    
    if (!hasQuoteToken) {
      console.log(`Creating instruction for quote token account: ${tokenB}`);
      const quoteTokenMint = new PublicKey(tokenB);
      const { publicKey: ataAddress } = getATAAddress(
        TOKEN_PROGRAM_ID, 
        owner, 
        quoteTokenMint
      );
      
      // Create instruction for quote token ATA
      
      const createQuoteTokenAccountIx = createAssociatedTokenAccountInstruction(
        owner, // payer
        ataAddress, // associatedToken
        owner, // owner
        quoteTokenMint // mint
      );
      
      createAccountInstructions.push(createQuoteTokenAccountIx);
    }
    
    // If we only need to create token accounts and not add liquidity yet, create a simple transaction
    if (createAccountInstructions.length > 0) {
      console.log('Creating a transaction just for token account creation');
      
      // Get a recent blockhash with retry logic
      let blockhash;
      try {
        const blockhashResponse = await connection.getLatestBlockhash('finalized');
        blockhash = blockhashResponse.blockhash;
        console.log('Got recent blockhash:', blockhash);
      } catch (error) {
        console.error('Error getting blockhash:', error);
        // Try again with a different commitment level
        const blockhashResponse = await connection.getLatestBlockhash('confirmed');
        blockhash = blockhashResponse.blockhash;
        console.log('Got fallback blockhash:', blockhash);
      }
      
      if (!blockhash) {
        throw new Error('Failed to get a recent blockhash from the Solana network');
      }
      
      // Create a new transaction with just the account creation instructions
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = owner;
      transaction.add(...createAccountInstructions);
      
      // Serialize the transaction for frontend
      const serializedTx = transaction.serialize({ requireAllSignatures: false }).toString('base64');
      
      // Collect the missing accounts for better user feedback
      const missingAccounts = [];
      if (!hasBaseToken) missingAccounts.push(tokenA);
      if (!hasQuoteToken) missingAccounts.push(tokenB);
      
      return {
        transaction: serializedTx,
        anotherAmount: '0', // No liquidity added yet, just creating accounts
        transactionType: 'createAccounts',
        missingAccounts,
        nextStep: 'After signing this transaction to create the necessary token accounts, you can add liquidity to the pool.'
      };
    }
    
    // If we have token accounts, try to fetch pool info and add liquidity
    try {
      // Fetch additional pool info
      const extraPoolInfo = await Liquidity.fetchInfo({ connection, poolKeys });
      console.log('Successfully fetched pool info:', {
        baseReserve: extraPoolInfo.baseReserve.toString(),
        quoteReserve: extraPoolInfo.quoteReserve.toString(),
        lpSupply: extraPoolInfo.lpSupply.toString()
      });
      
      // 4. Compute the other side amount
      const { maxAnotherAmount, anotherAmount, liquidity } = Liquidity.computeAnotherAmount({
        poolKeys,
        poolInfo: { ...targetPoolInfo, ...extraPoolInfo },
        amount: inputTokenAmount,
        anotherCurrency: quoteToken,
        slippage: slippagePct,
      });
      
      console.log('Will add liquidity info', {
        liquidity: liquidity.toString(),
        liquidityD: new Decimal(liquidity.toString()).div(10 ** extraPoolInfo.lpDecimals).toString(),
        baseAmount: inputTokenAmount.toFixed(),
        quoteAmount: anotherAmount.toFixed(),
      });
      
      // 5. Build the add liquidity instruction
      const addLiquidityInstructionResponse = await Liquidity.makeAddLiquidityInstructionSimple({
        connection,
        poolKeys,
        userKeys: {
          owner,
          payer: owner,
          tokenAccounts: walletTokenAccounts,
        },
        amountInA: inputTokenAmount,
        amountInB: maxAnotherAmount,
        fixedSide: 'a',
        makeTxVersion,
      });

      // 6. Get a recent blockhash with retry logic
      let blockhash;
      try {
        const blockhashResponse = await connection.getLatestBlockhash('finalized');
        blockhash = blockhashResponse.blockhash;
        console.log('Got recent blockhash for liquidity tx:', blockhash);
      } catch (err) {
        console.error('Error getting blockhash for liquidity tx:', err);
        const blockhashResponse = await connection.getLatestBlockhash('confirmed');
        blockhash = blockhashResponse.blockhash;
        console.log('Got fallback blockhash for liquidity tx:', blockhash);
      }

      if (!blockhash) {
        throw new Error('Failed to get a recent blockhash from the Solana network');
      }

      // 7. Manually create the transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = owner;
      for (const tx of addLiquidityInstructionResponse.innerTransactions) {
        transaction.add(...tx.instructions);
      }

      // 8. Serialize the transaction with error handling
      let serializedTx: string;
      try {
        const serializedBuffer = transaction.serialize({ requireAllSignatures: false });
        serializedTx = serializedBuffer.toString('base64');
      } catch (err) {
        console.error('Error serializing transaction:', err);
        throw new Error('Failed to serialize transaction');
      }

      return {
        transaction: serializedTx,
        anotherAmount: anotherAmount.toFixed(),
        transactionType: 'addLiquidity',
        nextStep: 'Sign this transaction to add liquidity to the pool.'
      };
    } catch (error) {
      console.error('Error building liquidity transaction:', error);
      
      // If we can't add liquidity but have token accounts, return a dummy transaction
      if (hasBaseToken && hasQuoteToken) {
        throw new Error(`Failed to add liquidity to pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } else {
        // We should never reach here since we already handled the token account creation case above
        throw new Error('Failed to prepare transaction');
      }
    }
  } catch (error) {
    console.error('Error in addLiquidityToPool:', error);
    throw new Error(`Failed to add liquidity to pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Remove liquidity from a Raydium pool
 */
export async function removeLiquidityFromPool({
  wallet,
  poolId,
  lpAmount,
}: {
  wallet: string;
  poolId: string;
  lpAmount: number; // Amount of LP tokens to remove
}): Promise<{ transaction: string }> {
  // TODO: Implement based on Raydium SDK V1 demo's remove liquidity logic
  throw new Error('removeLiquidityFromPool is not implemented.');
}

/**
 * Swap tokens in a Raydium pool
 */
export async function swapTokensInPool({
  wallet,
  poolId,
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
}: {
  wallet: string;
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  minAmountOut: number;
}): Promise<{ transaction: string }> {
  // TODO: Implement based on Raydium SDK V1 demo's swap logic
  throw new Error('swapTokensInPool is not implemented.');
}

/**
 * Fetch state of a Raydium pool
 */
export async function fetchPoolState({
  poolId,
}: {
  poolId: string;
}): Promise<any> {
  // TODO: Implement based on Raydium SDK V1 demo's pool info fetching
  throw new Error('fetchPoolState is not implemented.');
}

/**
 * Fetch a user's LP token balance in a Raydium pool
 */
export async function fetchUserLpBalance({
  wallet,
  poolId,
}: {
  wallet: string;
  poolId: string;
}): Promise<string> {
  // TODO: Implement based on Raydium SDK V1 demo's balance fetching
  throw new Error('fetchUserLpBalance is not implemented.');
}