import React, { useState, useEffect } from "react";
import { usePhantomWallet } from "./PhantomWallet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";
import { Connection, Transaction as SolanaTransaction } from '@solana/web3.js';

interface TransactionPreviewProps {
  riskLevel: number;
  poolId: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

interface PoolData {
  id: string;
  name: string;
  feeTier?: string;
  token1: string;
  token1Symbol: string;
  token1Logo: string;
  token2: string;
  token2Symbol: string;
  token2Logo: string;
}

interface SimulationResult {
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
}

const TransactionPreview: React.FC<TransactionPreviewProps> = ({
  riskLevel,
  poolId,
  onConfirm,
  onCancel
}) => {
  const { connected, publicKey, connect } = usePhantomWallet();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [pool, setPool] = useState<PoolData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [transactionType, setTransactionType] = useState<'createAccounts' | 'addLiquidity' | null>(null);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [missingAccounts, setMissingAccounts] = useState<string[]>([]);
  const [needsAccountCreation, setNeedsAccountCreation] = useState(false);

  // Fetch pool details from backend
  useEffect(() => {
    const fetchPool = async () => {
      try {
        const response = await apiRequest<{ pools: PoolData[] }>({
          method: "GET",
          url: `/api/raydium/pools/search?poolId=${poolId}`
        });
        if (response.pools && response.pools.length > 0) {
          setPool(response.pools[0]);
        } else {
          setError("Pool not found");
          toast.error("Pool not found");
        }
        setIsLoading(false);
      } catch (error) {
        setError("Failed to fetch pool data");
        toast.error("Failed to fetch pool data");
      }
    };
    if (poolId) fetchPool();
  }, [poolId]);

  // Default values in case simulation fails
  const minPrice = simulation?.priceRange.minPrice || "0.00";
  const maxPrice = simulation?.priceRange.maxPrice || "0.00";
  const rangePct = simulation?.priceRange.rangePct || 0;
  const estimatedApr = simulation?.estimatedAPR || "0.0";
  const feeTier = simulation?.feeTier || pool?.feeTier || "0.0%";

  // Fetch simulation data from the server
  useEffect(() => {
    const fetchSimulation = async () => {
      if (!connected || !publicKey) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const response = await apiRequest<{
          success: boolean;
          simulation?: SimulationResult;
          error?: string;
        }>({
          method: "POST",
          url: "/api/raydium/simulate",
          data: {
            wallet: publicKey.toString(),
            poolId,
            riskLevel
          }
        });
        if (response && response.success && response.simulation) {
          setSimulation(response.simulation);
          setError(null);
        } else {
          setError(response?.error || "Failed to simulate transaction");
          toast.error("Failed to simulate transaction");
        }
      } catch (error) {
        console.error("Simulation error:", error);
        setError("Failed to connect to simulation service");
        toast.error("Failed to connect to simulation service");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSimulation();
  }, [connected, publicKey, riskLevel]);

  useEffect(() => {
    const initWallet = async () => {
      if (!connected) {
        try {
          await connect();
        } catch (error) {
          console.error("Error connecting to wallet:", error);
        }
      }
    };
    initWallet();
  }, [connected]);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = '/default-token.png'; // Use a default token icon in public folder
  };

  const handleConfirmClick = async () => {
    if (!connected || !publicKey || !pool) return;

    try {
      setIsConfirming(true);
      setError(null);

      // Prepare transaction data
      const txData = {
        wallet: publicKey.toString(),
        poolId: pool.id,
        tokenA: pool.token1,
        tokenB: pool.token2,
        riskLevel,
        amount
      };

      // Get the transaction from the backend
      const txResponse = await apiRequest({
        method: "POST",
        url: "/api/raydium/prepare-liquidity",
        data: txData
      });

      if (!txResponse.success || !txResponse.transaction) {
        throw new Error(txResponse.error || "Failed to prepare transaction");
      }

      // Store transaction type and next steps information
      setTransactionType(txResponse.transactionType || 'addLiquidity');
      setNextStep(txResponse.nextStep || null);
      
      if (txResponse.missingAccounts && txResponse.missingAccounts.length > 0) {
        setMissingAccounts(txResponse.missingAccounts);
        setNeedsAccountCreation(true);
      } else {
        setMissingAccounts([]);
        setNeedsAccountCreation(false);
      }

      // Set up Solana connection with better options
      const rpcUrl = "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000 // 60 seconds timeout
      });
      
      // Decode base64 transaction for browser
      console.log('Decoding transaction...');
      const txBytes = Uint8Array.from(atob(txResponse.transaction), c => c.charCodeAt(0));
      const transaction = SolanaTransaction.from(txBytes);
      console.log('Transaction decoded successfully');
      
      // Sign and send the transaction
      console.log('Sending transaction...');
      // @ts-ignore
      const signature = await window.solana.signAndSendTransaction(transaction);

      // Wait for confirmation
      if (signature && signature.signature) {
        const confirmation = await connection.confirmTransaction(signature.signature, 'confirmed');
        console.log('Transaction confirmed', confirmation);
        
        // If this was a token account creation transaction, prompt the user to add liquidity now
        if (txResponse.transactionType === 'createAccounts') {
          toast.success("Token accounts created successfully! You can now add liquidity.");
          // We don't call onConfirm yet, as we want the user to explicitly add liquidity
          setIsConfirming(false);
          return;
        }
      } else {
        throw new Error('No signature returned from wallet');
      }

      toast.success("Transaction submitted! Signature: " + signature.signature);

      // The transaction handling has been moved to the try block above
      // This code is no longer needed
    } catch (error: any) {
      console.error("Transaction confirmation error:", error);
      toast.error(error.message || "Transaction failed. Please try again.");
      setError(error.message || "Transaction failed. Please try again.");
    } finally {
      if (transactionType !== 'createAccounts') {
        setIsConfirming(false);
        // Call the onConfirm callback to notify the parent component
        await onConfirm();
      } else {
        setIsConfirming(false);
      }
    }
  };
  
  const handleAddLiquidity = async () => {
    // Reset the transaction type to force a new transaction request
    setTransactionType(null);
    setNeedsAccountCreation(false);
    // Call handleConfirmClick again to get a new transaction
    await handleConfirmClick();
  };

  // Calculate SOL to USD value for fees
  const solPrice = 145.87; // Current SOL price
  const networkFeeDollars = simulation?.networkFee ? (simulation.networkFee * solPrice).toFixed(3) : "0.001";

  // Calculate token amounts based on a $100 investment
  const usdcAmount = amount / 2;
  const solAmount = (amount / 2 / solPrice).toFixed(5);

  return (
    <div className="mt-4 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-blue-900/40 to-gray-800 px-4 py-3 border-b border-gray-700">
        <h4 className="font-medium text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 2H8.828a2 2 0 00-1.414.586L6.293 3.707A1 1 0 015.586 4H4zm5 5a1 1 0 10-2 0v4a1 1 0 102 0V9zm4 1a1 1 0 100 2h1a1 1 0 100-2h-1z" clipRule="evenodd" />
          </svg>
          Transaction Preview
        </h4>
      </div>
      {isLoading ? (
        <div className="p-8 flex justify-center items-center">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <div className="text-red-400 mb-2">Error simulating transaction</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      ) : (
        <>
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
              <span className="text-gray-400">Pool</span>
              <div className="flex items-center">
                <div className="flex -space-x-1 mr-2">
                  <img src={pool?.token1Logo || ""} alt={pool?.token1Symbol || ""} className="h-5 w-5 rounded-full ring-1 ring-gray-900" onError={handleImgError} />
                  <img src={pool?.token2Logo || ""} alt={pool?.token2Symbol || ""} className="h-5 w-5 rounded-full ring-1 ring-gray-900" onError={handleImgError} />
                </div>
                <span className="text-white font-medium">{pool ? `${pool.token1Symbol || "Unknown"}-${pool.token2Symbol || "Unknown"}` : "-"} <span className="text-sm font-normal text-gray-400">({feeTier})</span></span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-500 mb-1">You pay</div>
                <div className="flex items-center">
                  <img src={pool?.token1Logo || ""} alt={pool?.token1Symbol || ""} className="h-4 w-4 rounded-full mr-1" onError={handleImgError} />
                  <span className="font-medium">{Number.isFinite(usdcAmount) ? usdcAmount.toFixed(2) : "-"} {pool?.token1Symbol || "Unknown"}</span>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-xs text-gray-500 mb-1">You pay</div>
                <div className="flex items-center">
                  <img src={pool?.token2Logo || ""} alt={pool?.token2Symbol || ""} className="h-4 w-4 rounded-full mr-1" onError={handleImgError} />
                  <span className="font-medium">{Number.isFinite(Number(solAmount)) ? solAmount : "-"} {pool?.token2Symbol || "Unknown"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <label htmlFor="amount" className="text-gray-400 text-sm">Investment Amount ($):</label>
              <input
                id="amount"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white w-24 focus:outline-none focus:border-blue-500"
                disabled={isConfirming}
              />
            </div>
            <div className="rounded-lg p-3 bg-blue-900/20 border border-blue-800/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300">Price Range</span>
                <span className="font-medium text-white">${minPrice} - ${maxPrice}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-blue-400 h-1.5 rounded-full" 
                  style={{ width: `${Math.min(100, rangePct*2)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>-{rangePct}%</span>
                <span>Current: $145.87</span>
                <span>+{rangePct}%</span>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Estimated APR</span>
                <span className="text-green-400 font-medium">{estimatedApr}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">IL Risk</span>
                <div className="flex items-center">
                  <span>{riskLevel}%</span>
                  <span className="ml-1 text-xs text-gray-500">(if price moves outside range)</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Network Fee</span>
                <div className="flex items-center">
                  <span>{simulation?.networkFee.toFixed(8) || "0.000005"} SOL</span>
                  <span className="ml-1 text-xs text-gray-500">(≈${networkFeeDollars})</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Price Impact</span>
                <span className="text-gray-300">{simulation?.impactUSD || "$0.20"}</span>
              </div>
            </div>
          </div>
          {/* Transaction Status Message */}
          {nextStep && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded-md mb-4">
              <p className="text-sm text-gray-300">{nextStep}</p>
              {missingAccounts.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">Missing token accounts:</p>
                  <ul className="list-disc list-inside text-xs text-gray-400">
                    {missingAccounts.map((account, index) => (
                      <li key={index}>{account}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex border-t border-gray-700">
            <button 
              className="flex-1 py-3 text-gray-400 hover:bg-gray-700 transition font-medium"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
            >
              Cancel
            </button>
            
            {/* Show different buttons based on transaction state */}
            {needsAccountCreation && transactionType === 'createAccounts' ? (
              <button 
                className={`flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition border-l border-gray-700 disabled:opacity-50 disabled:hover:from-blue-600 disabled:hover:to-blue-500 ${isConfirming ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleAddLiquidity}
                disabled={isConfirming || !connected || !pool || !publicKey}
                title={!connected ? "Connect your wallet first" : !pool ? "No pool selected" : isConfirming ? "Creating token accounts..." : ""}
              >
                {isConfirming ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Accounts...
                  </span>
                ) : (
                  'Add Liquidity Now'
                )}
              </button>
            ) : (
              <button 
                className={`flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition border-l border-gray-700 disabled:opacity-50 disabled:hover:from-blue-600 disabled:hover:to-blue-500 ${isConfirming ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleConfirmClick}
                disabled={isConfirming || !connected || !pool || !publicKey}
                title={!connected ? "Connect your wallet first" : !pool ? "No pool selected" : isConfirming ? "Confirming..." : ""}
              >
                {isConfirming ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Confirming...
                  </span>
                ) : (
                  'Confirm & Sign'
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionPreview;