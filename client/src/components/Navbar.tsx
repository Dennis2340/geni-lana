"use client";

import React, { useState } from "react";
import { usePhantomWallet } from "./PhantomWallet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmailSetup from "./EmailSetup";

const Navbar: React.FC = () => {
  // Use the wallet hook directly - our provider ensures it will always work
  const walletContextValues = usePhantomWallet();

  const { connect, disconnect, connected, publicKey, connecting } = walletContextValues;
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEmailSetup, setShowEmailSetup] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success("Wallet connected successfully");
    } catch (error) {
      toast.error("Failed to connect wallet");
      console.error("Connection error:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDropdown(false);
      toast.success("Wallet disconnected");
    } catch (error) {
      toast.error("Failed to disconnect wallet");
      console.error("Disconnect error:", error);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-opacity-90 backdrop-blur-md bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <img 
                src="https://pbs.twimg.com/profile_images/1748419475857367040/B9I9tEr7_400x400.jpg" 
                alt="Meteora Logo" 
                className="h-8 w-8 rounded-full mr-2" 
              />
              <span className="text-xl font-semibold tracking-wide text-white">
                Meteora <span className="text-blue-500">AI</span> Agent
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Button
                variant="outline"
                className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200"
                onClick={() => setShowEmailSetup(!showEmailSetup)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Notifications</span>
              </Button>
              
              {showEmailSetup && (
                <div className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg bg-gray-800 border border-gray-700 z-50">
                  <Card className="bg-gray-800 border-0">
                    <CardHeader className="px-4 py-3 pb-1">
                      <CardTitle className="text-lg text-white">Notification Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <EmailSetup />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
            
            <div className="relative group">
              {connected ? (
                <Button 
                  variant="default" 
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition duration-200"
                  onClick={toggleDropdown}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 0a1 1 0 00-1 1v3a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 00-1-1V5a1 1 0 011-1h6a1 1 0 011 1v.3a1 1 0 00-1 .7V6z" clipRule="evenodd" />
                  </svg>
                  <span>Connected</span>
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition duration-200"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <span className="mr-2">Connecting...</span>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 0a1 1 0 00-1 1v3a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 00-1-1V5a1 1 0 011-1h6a1 1 0 011 1v.3a1 1 0 00-1 .7V6z" clipRule="evenodd" />
                      </svg>
                      <span>Connect Wallet</span>
                    </>
                  )}
                </Button>
              )}
              {connected && <div className="absolute top-0 right-0 mt-1 mr-1 h-3 w-3 bg-green-500 rounded-full border-2 border-gray-900"></div>}
              
              {showDropdown && connected && (
                <div className="absolute right-0 mt-2 w-60 rounded-lg shadow-lg py-1 bg-gray-800 border border-gray-700 z-50">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <p className="text-sm text-gray-400 mb-1">Connected as</p>
                    <p className="text-sm font-medium truncate">
                      {publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'Unknown'}
                    </p>
                  </div>
                  <div className="border-t border-gray-700 mt-2 pt-2">
                    <button 
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition"
                      onClick={handleDisconnect}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
