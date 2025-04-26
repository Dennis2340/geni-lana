"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { PublicKey } from "@solana/web3.js";

// Import the Phantom SDK if available, otherwise provide fallback
let createPhantom: any;
let Position: any;

try {
  // Dynamic import to prevent build errors if the package isn't installed
  const phantomSdk = require("@phantom/wallet-sdk");
  createPhantom = phantomSdk.createPhantom;
  Position = phantomSdk.Position;
} catch (error) {
  console.warn("@phantom/wallet-sdk not found, using fallback");
}

// Fallback for browser extension
declare global {
  interface Window {
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect: () => Promise<{ publicKey: any }>;
        disconnect: () => Promise<void>;
        signTransaction: <T>(transaction: T) => Promise<T>;
        signAllTransactions: <T>(transactions: T[]) => Promise<T[]>;
        signAndSendTransaction: <T>(transaction: T) => Promise<any>;
        signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
        publicKey: any | null;
      };
    };
  }
}

interface PhantomWalletContextType {
  phantom: any;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const PhantomWalletContext = createContext<PhantomWalletContextType | undefined>(undefined);

export function PhantomWalletProvider({ children }: { children: ReactNode }) {
  const [phantom, setPhantom] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const initWallet = async () => {
      try {
        // Try to use the modern SDK if available
        if (createPhantom) {
          // Initialize Phantom wallet as a popup
          const phantomInstance = await createPhantom({
            position: Position.topRight,
            namespace: "phantom-sak",
          });
          
          setPhantom(phantomInstance);
          
          // Check if already connected
          try {
            if (phantomInstance.solana) {
              // Try to connect silently if the user has previously connected
              const account = await phantomInstance.solana.connect({ silent: true });
              console.log("account", account);
              if (account) {
                setPublicKey(phantomInstance.solana.publicKey);
                setConnected(true);
              }
            }
          } catch (error) {
            // Silent connection failed, user needs to connect manually
            console.log("Not previously connected");
          }
        } 
        // Fallback to browser extension
        else if (window.phantom?.solana) {
          const provider = window.phantom.solana;
          if (provider?.isPhantom) {
            setPhantom(provider);
            if (provider.publicKey) {
              setPublicKey(provider.publicKey);
              setConnected(true);
            }
          }
        } else {
          toast.error("Please install Phantom wallet", {
            description: "Visit phantom.app to install",
            duration: 5000
          });
        }
      } catch (error) {
        console.error("Error initializing wallet:", error);
        toast.error("Failed to initialize wallet");
      }
    };
    initWallet();
  }, []);

  const connect = async () => {
    try {
      setConnecting(true);
      
      // Modern SDK approach
      if (phantom?.solana && createPhantom) {
        try {
          phantom.show(); // Show the wallet UI for SDK version
          
          const account = await phantom.solana.connect();
          if (account) {
            setPublicKey(phantom.solana.publicKey);
            setConnected(true);
            toast.success("Wallet connected successfully");
          }
        } catch (error) {
          console.error("Error connecting to Phantom wallet:", error);
          toast.error("Failed to connect wallet");
          throw error;
        }
      } 
      // Browser extension fallback
      else if (window.phantom?.solana) {
        const provider = window.phantom.solana;
        if (!provider?.isPhantom) {
          throw new Error("Phantom wallet not installed");
        }
        
        const resp = await provider.connect();
        setPublicKey(resp.publicKey);
        setConnected(true);
        setPhantom(provider);
        toast.success("Wallet connected successfully");
      } else {
        toast.error("Phantom wallet not found");
      }
    } catch (error) {
      console.error("Error in connect:", error);
      toast.error("Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      // Modern SDK approach
      if (phantom?.solana && createPhantom) {
        await phantom.solana.disconnect();
        setPublicKey(null);
        setConnected(false);
        toast.success("Wallet disconnected");
      }
      // Browser extension fallback
      else if (window.phantom?.solana) {
        const provider = window.phantom.solana;
        if (provider?.isPhantom) {
          await provider.disconnect();
          setPhantom(null);
          setPublicKey(null);
          setConnected(false);
          toast.success("Wallet disconnected");
        }
      }
    } catch (error) {
      console.error("Error in wallet disconnect:", error);
      toast.error("Failed to disconnect wallet");
    }
  };

  return (
    <PhantomWalletContext.Provider
      value={{
        phantom,
        publicKey,
        connected,
        connecting,
        connect,
        disconnect,
      }}
    >
      {!phantom && (
        <div style={{background:'#ffebee',color:'#c62828',padding:'12px',textAlign:'center',borderRadius:'6px',marginBottom:'16px'}}>
          <b>Phantom Wallet not detected.</b> <a href="https://phantom.app" target="_blank" rel="noopener noreferrer">Install Phantom</a> for full functionality.
        </div>
      )}
      {children}
    </PhantomWalletContext.Provider>
  );
}

export function usePhantomWallet() {
  const context = useContext(PhantomWalletContext);
  if (context === undefined) {
    throw new Error("usePhantomWallet must be used within a PhantomWalletProvider");
  }
  return context;
}
