"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Dashboard from "../components/Dashboard";
import { PhantomWalletProvider } from "../components/PhantomWallet";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex justify-center items-center bg-[radial-gradient(circle,#242A37,#29313F,#2C3644,#3D4854)]">
        <div className="fixed top-0 left-0 right-0 z-50">
          <PhantomWalletProvider>
            <Navbar />
          </PhantomWalletProvider>
        </div>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-white text-lg">Loading Meteora AI Agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle,#242A37,#29313F,#2C3644,#3D4854)] flex flex-col">
      <PhantomWalletProvider>
        <Navbar />
        <div className="flex-1 flex flex-col">
          <Dashboard />
        </div>
      </PhantomWalletProvider>
    </div>
  );
}
