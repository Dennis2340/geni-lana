"use client";

import React, { useEffect, useState, useRef } from "react";
import { marked } from "marked";
import { toast } from "sonner";
import { Icon } from "@iconify/react";
import { generateText, type CoreMessage } from "ai";
import { nanoid } from "nanoid";
import { usePhantomWallet, PhantomWalletProvider } from "./PhantomWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmailSetup from "./EmailSetup";
import { myProvider } from "../utils/provider";
import { executeMeteoraTransaction } from "../utils/meteora";
import TransactionPreview from "./TransactionPreview";
import PoolRecommendations from "./PoolRecommendations";

type AIChatProps = {};

export const AIChat: React.FC<AIChatProps> = () => {
  const [messages, setMessages] = useState<CoreMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [showPools, setShowPools] = useState(false);
  const [riskLevel, setRiskLevel] = useState(5);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  type PoolSortField = 'apr' | 'tvl' | 'volume24h';
  type PoolSortOrder = 'asc' | 'desc';
  interface PoolFilters {
    sortField?: PoolSortField;
    sortOrder?: PoolSortOrder;
    tokenSymbols?: string[];
  }
  const [poolFilters, setPoolFilters] = useState<PoolFilters>({});
  const { phantom, connected, publicKey } = usePhantomWallet();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: CoreMessage = {
        role: "assistant",
        content: `👋 Welcome to the Meteora AI Agent! I'm here to help you provide liquidity on Meteora's DLMM pools with minimal effort.

To get started, I just need to know: **What impermanent loss (IL) risk are you comfortable with?** For example:

* Low risk (1-5%): Stable pairs, narrow range
* Medium risk (5-10%): Moderate volatility, wider range
* High risk (10%+): Volatile pairs, maximum yield potential`
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Simple intent extraction for pool queries
  function extractPoolQuery(input: string): PoolFilters {
    input = input.toLowerCase();
    if (input.includes("least risk") || input.includes("safest")) {
      return { sortField: "tvl", sortOrder: "desc" };
    }
    if (input.includes("highest apr") || input.includes("most yield")) {
      return { sortField: "apr", sortOrder: "desc" };
    }
    const tokenMatch = input.match(/([A-Z]{2,5})\/([A-Z]{2,5})/i);
    if (tokenMatch) {
      return { tokenSymbols: [tokenMatch[1].toUpperCase(), tokenMatch[2].toUpperCase()] };
    }
    return {};
  }

  // Helper to save a message to the backend
  async function saveMessage(user_public_key: string, content: string) {
    try {
      await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_public_key: publicKey, content }),
      });
    } catch (err) {
      console.error('Failed to save message:', err);
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return;

    // Always hide transaction preview when user sends a new message
    setShowTransaction(false);
    
    const userMessage: CoreMessage = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    // Save user message
    if (publicKey) {
      await saveMessage(publicKey.toString(), input);
    }

    // Extract pool query intent
    const poolQuery = extractPoolQuery(input);
    if (Object.keys(poolQuery).length > 0) {
      setShowPools(true);
      setPoolFilters(poolQuery);
      const poolsResponse: CoreMessage = {
        role: "assistant",
        content: `Here are some pools based on your request: ${input}`
      };
      setMessages([...updatedMessages, poolsResponse]);
      // Save assistant message
      if (publicKey) {
        await saveMessage(publicKey.toString(), poolsResponse.content as string);
      }
      setIsLoading(false);
      return;
    }

    try {
      // Special command handling
      if (input.toLowerCase().includes("set risk") || input.toLowerCase().includes("change risk")) {
        const match = input.match(/\d+/);
        if (match) {
          const riskValue = parseInt(match[0], 10);
          if (riskValue >= 1 && riskValue <= 15) {
            setRiskLevel(riskValue);

            const riskResponse: CoreMessage = {
              role: "assistant", 
              content: `I've updated your risk preference to ${riskValue}%. This will be used for future liquidity positions.

Would you like me to recommend some pools based on this new risk level?`
            };

            setMessages([...updatedMessages, riskResponse]);
            setIsLoading(false);
            return;
          }
        }
      }

      // Command for showing transaction
      if (input.toLowerCase().includes("add liquidity") || input.toLowerCase().includes("provide liquidity")) {
        if (!selectedPoolId) {
          setShowPools(true);
          const promptResponse: CoreMessage = {
            role: "assistant",
            content: `Please select a pool before proceeding to add liquidity. Here are some recommended pools based on your ${riskLevel}% risk tolerance.`
          };
          setMessages([...updatedMessages, promptResponse]);
          setIsLoading(false);
          return;
        }
        setShowTransaction(true);
        const txResponse: CoreMessage = {
          role: "assistant", 
          content: `I've prepared a transaction for you to review based on your ${riskLevel}% risk tolerance. Please check the details and confirm when you're ready.`
        };
        setMessages([...updatedMessages, txResponse]);
        setIsLoading(false);
        return;
      }

      // Command for add liquidity (show pools again, not simulation)
      if (input.toLowerCase().includes("add liquidity")) {
        setShowPools(true);
        setShowTransaction(false);
        setSelectedPoolId(null);
        setIsLoading(false);
        const poolsResponse: CoreMessage = {
          role: "assistant",
          content: `Here are all available liquidity pools. Select one to continue.`
        };
        setMessages([...updatedMessages, poolsResponse]);
        return;
      }
      // Command for showing pools
      if (input.toLowerCase().includes("show pools") || input.toLowerCase().includes("recommend pools")) {
        setShowPools(true);

        const poolsResponse: CoreMessage = {
          role: "assistant", 
          content: `Here are some recommended pools based on your ${riskLevel}% risk tolerance. These are optimized to balance yield and impermanent loss risk.`
        };

        setMessages([...updatedMessages, poolsResponse]);
        setIsLoading(false);
        return;
      }

      // For general responses, we'll use a simpler approach to avoid API errors
      // First try with OpenAI
      try {
        const result = await generateText({
          model: myProvider.languageModel("chat-model"),
          messages: updatedMessages.slice(-4), // Limit context to last 4 messages to reduce token count
          system: `You are a helpful AI assistant for Meteora, a Solana DeFi protocol specializing in decentralized liquidity market making (DLMM). Provide short, concise answers about Solana DeFi, liquidity provision, and impermanent loss. The user has a risk level of ${riskLevel}%.

Risk levels are interpreted:
- 1-5%: Low risk, suitable for stablecoin pairs
- 5-10%: Medium risk for most assets
- 10%+: High risk, for maximum yield

Keep responses under 150 words. For adding liquidity, suggest using the "add liquidity" command.`,
        });

        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: result.text || "Sorry, I didn't quite understand that. Could you please rephrase?",
          },
        ]);
      } catch (openaiError) {
        console.log("OpenAI error, using fallback response:", openaiError);

        // Generate a fallback response based on the user's query
        let responseContent = "";

        if (input.toLowerCase().includes("what is meteora")) {
          responseContent = `Meteora is a decentralized liquidity market making (DLMM) protocol on Solana. It allows users to provide liquidity within specific price ranges to maximize capital efficiency and yield. With your ${riskLevel}% risk tolerance, you'd be focusing on ${riskLevel <= 5 ? 'safer, stable pairs' : riskLevel <= 10 ? 'moderately volatile pairs' : 'higher risk, higher reward pairs'}.`;
        } 
        else if (input.toLowerCase().includes("impermanent loss") || input.toLowerCase().includes("il")) {
          responseContent = `Impermanent loss (IL) occurs when the price of your deposited assets changes compared to simply holding them. With your ${riskLevel}% risk tolerance, you're prepared for price movements that might cause up to ${riskLevel}% IL. The narrower your price range, the less IL risk but potentially lower returns.`;
        }
        else if (input.toLowerCase().includes("risk")) {
          responseContent = `Your current risk level is set to ${riskLevel}%. This means you're comfortable with approximately ${riskLevel}% impermanent loss if prices move outside your liquidity range. I'll use this to recommend appropriate pools and position ranges.`;
        }
        else {
          responseContent = `I understand you're asking about "${input}". As a Meteora liquidity assistant, I focus on helping you provide liquidity to Solana DeFi pools based on your ${riskLevel}% risk tolerance.\n\nYou can ask me about impermanent loss, risk management, or use commands like "show pools" or "add liquidity" to interact with liquidity positions.`;
        }

        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: responseContent,
          },
        ]);
      }
    } catch (error) {
      console.error("Message processing error:", error);
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
        },
      ]);
    }

    setIsLoading(false);
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleRiskSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRiskLevel(parseInt(e.target.value, 10));
  };

  const handleTransactionConfirm = async () => {
    setShowTransaction(false);
    setIsLoading(true);

    try {
      if (!connected || !phantom) {
        toast.error("Please connect your wallet first");
        setIsLoading(false);
        return;
      }

      // Generate a transaction ID for the UI
      // We don't need to call executeMeteoraTransaction anymore since the actual
      // transaction was already handled by the TransactionPreview component
      const txHash = nanoid(32); // Just generate a mock transaction hash
      toast.success("Liquidity position created successfully!");
    } catch (error) {
      console.error('Transaction error:', error);
      const errorMessage: CoreMessage = {
        role: "assistant",
        content: "I'm sorry, there was an error processing your transaction. Please check your wallet and try again."
      };

      setMessages([...messages, errorMessage]);
      toast.error("Transaction failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle transaction cancellation
  const handleTransactionCancel = () => {
    setShowTransaction(false);
    
    // Add a message to the chat indicating cancellation
    const cancelMessage: CoreMessage = {
      role: "assistant",
      content: "Transaction cancelled. You can continue chatting or type 'show pools' to see liquidity pool options again."
    };
    
    setMessages([...messages, cancelMessage]);
  };

  return (
    <div className="w-full max-w-4xl flex flex-col h-[calc(100vh-6rem)] mx-auto px-4">
      <div className="flex-1 flex flex-col overflow-hidden rounded-2xl bg-gray-900 border-gray-800 p-6">
        {showEmailSetup && (
          <Card className="mb-6 bg-gray-900 border-gray-800">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-lg text-white">Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailSetup />
            </CardContent>
          </Card>
        )}
        <div 
          ref={chatContainerRef}
          className="chat-container flex-1 overflow-y-auto px-5 py-6 space-y-8"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex items-start ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "user" ? (
                <div className="flex flex-col items-end max-w-[80%]">
                  <div className="flex items-center mb-1 justify-end">
                    <span className="text-xs text-gray-500 mr-2">{getCurrentTime()}</span>
                    <span className="text-sm font-medium text-blue-400">You</span>
                  </div>
                  <div className="bg-blue-600 text-white px-4 py-3 rounded-xl rounded-tr-none shadow-md">
                    <div 
                      className="prose prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0"
                      dangerouslySetInnerHTML={{ __html: marked(m.content as string) }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-3">
                    <div className="bg-gray-800 rounded-full flex items-center justify-center w-9 h-9 border border-gray-700">
                      <img 
                        src="https://pbs.twimg.com/profile_images/1748419475857367040/B9I9tEr6_400x400.jpg" 
                        alt="Meteora Logo" 
                        className="rounded-full w-7 h-7" 
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start max-w-[80%]">
                    <div className="flex items-center mb-1">
                      <span className="text-sm font-medium text-blue-400 mr-2">
                        Meteora AI
                      </span>
                      <span className="text-xs text-gray-500">{getCurrentTime()}</span>
                    </div>
                    <div className="bg-gray-800 text-gray-100 px-4 py-3 rounded-xl rounded-tl-none shadow-md">
                      <div 
                        className="prose prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0"
                        dangerouslySetInnerHTML={{ __html: marked(m.content as string) }}
                      />
                    </div>

                    {/* Show pool recommendations if triggered */}
                    {i === messages.length - 1 && showPools && (
                      <div className="mt-4 w-full">
                        <PoolRecommendations 
                          riskLevel={riskLevel}
                          sortField={poolFilters.sortField}
                          sortOrder={poolFilters.sortOrder}
                          tokenSymbols={poolFilters.tokenSymbols}
                          onSelect={(poolId: string) => {
                            setSelectedPoolId(poolId);
                            setShowPools(false);
                            setShowTransaction(true);
                            setMessages((prev) => ([
                              ...prev,
                              {
                                role: "assistant",
                                content: `You selected pool **${poolId}**. Preparing your transaction preview...`
                              }
                            ]));
                          }}
                        />
                      </div>
                    )}

                    {/* Show transaction preview if triggered */}
                    {i === messages.length - 1 && showTransaction && selectedPoolId && (
                      <div className="mt-4 w-full">
                        <PhantomWalletProvider>
                          <TransactionPreview 
                            riskLevel={riskLevel}
                            poolId={selectedPoolId}
                            onConfirm={handleTransactionConfirm}
                            onCancel={handleTransactionCancel}
                          />
                        </PhantomWalletProvider>
                        {/* Add a small note about being able to continue chatting */}
                        <div className="mt-2 text-xs text-gray-400 text-center">
                          You can continue chatting or ask a new question while this transaction is open
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="mt-4 p-2 relative">
          <div className="relative flex flex-col bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden">
            <div className="w-full px-4 py-3">
              <textarea
                className="w-full min-h-[24px] bg-transparent border-none text-white placeholder-gray-400 focus:outline-none focus:ring-0 resize-none"
                placeholder="Ask about Meteora liquidity, IL risks, or positions..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())
                }
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-between items-center px-4 py-2">
              <div className="flex-1">
                <div className="flex flex-col">
                  <div className="text-xs flex justify-between items-center">
                    <span className="text-gray-400">IL Risk Tolerance:</span>
                    <span className="text-gray-200 font-medium">{riskLevel}%</span>
                  </div>
                  <div className="mt-1 relative">
                    <input 
                      type="range" 
                      min="1" 
                      max="15" 
                      value={riskLevel} 
                      onChange={handleRiskSliderChange}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                      <span>Low Risk</span>
                      <span>Med Risk</span>
                      <span>High Risk</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="text-white bg-blue-600 hover:bg-blue-700 rounded-full p-2 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <svg
                      className="animate-spin w-5 h-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  ) : (
                    <Icon icon="solar:alt-arrow-right-bold-duotone" width="24" height="24" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};