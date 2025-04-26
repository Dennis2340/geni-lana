"use client";

import React, { useState } from "react";
import { AIChat } from "./Chat";
import { usePhantomWallet } from "./PhantomWallet";
import EmailSetup from "./EmailSetup";

interface DashboardSummaryProps {
  riskLevel: number;
  emailConfigured: boolean;
  onUpdatePreference: () => void;
  onSetupNotifications: () => void;
}

const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  riskLevel,
  emailConfigured,
  onUpdatePreference,
  onSetupNotifications
}) => {
  // Risk badge styling based on level
  const getRiskBadgeClass = () => {
    if (riskLevel <= 5) {
      return "text-xs px-2 py-1 rounded-full bg-green-500 bg-opacity-20 text-green-400";
    } else if (riskLevel <= 10) {
      return "text-xs px-2 py-1 rounded-full bg-yellow-500 bg-opacity-20 text-yellow-400";
    } else {
      return "text-xs px-2 py-1 rounded-full bg-red-500 bg-opacity-20 text-red-400";
    }
  };
  
  const getRiskBadgeText = () => {
    if (riskLevel <= 5) return "Low";
    if (riskLevel <= 10) return "Medium";
    return "High";
  };

  return (
    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* DeFi Summary Card */}
      <div className="bg-gray-900 bg-opacity-60 rounded-xl border border-gray-800 p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">My Liquidity</h3>
          <div className="text-xs px-2 py-1 rounded-full bg-blue-500 bg-opacity-20 text-blue-400">Active</div>
        </div>
        <div className="mt-1">
          <span className="text-xl font-semibold">$0.00</span>
        </div>
        <div className="mt-auto pt-3 text-xs text-gray-400">No active positions</div>
      </div>
      
      {/* Risk Preference Card */}
      <div className="bg-gray-900 bg-opacity-60 rounded-xl border border-gray-800 p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">Risk Preference</h3>
          <div className={getRiskBadgeClass()}>{getRiskBadgeText()}</div>
        </div>
        <div className="mt-1">
          <span className="text-xl font-semibold">{riskLevel}%</span>
          <span className="text-sm text-gray-400 ml-1">IL tolerance</span>
        </div>
        <div className="mt-auto pt-3">
          <button 
            className="text-xs text-blue-400 hover:text-blue-300 transition"
            onClick={onUpdatePreference}
          >
            Update preference
          </button>
        </div>
      </div>
      
      {/* Notification Card */}
      <div className="bg-gray-900 bg-opacity-60 rounded-xl border border-gray-800 p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">Notifications</h3>
          <div className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">Email</div>
        </div>
        <div className="mt-1">
          <span className="text-sm text-gray-400">
            {emailConfigured ? "Configured" : "Not configured"}
          </span>
        </div>
        <div className="mt-auto pt-3">
          <button 
            className="text-xs text-blue-400 hover:text-blue-300 transition"
            onClick={onSetupNotifications}
          >
            {emailConfigured ? "Update notifications" : "Setup notifications"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [riskLevel, setRiskLevel] = useState(5);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const { connected } = usePhantomWallet();
  const [phantomBannerShown, setPhantomBannerShown] = useState(false);

  const handleUpdatePreference = () => {
    // Could open a modal or scroll to chat with specific instruction
    const message = "To update your risk preference, just tell me your new preference like 'Set my risk to 10%' or use the slider below the chat input.";
    alert(message);
  };

  const handleSetupNotifications = () => {
    setShowEmailSetup(true);
  };

  const handleEmailSetupComplete = () => {
    setEmailConfigured(true);
    setShowEmailSetup(false);
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Welcome to Meteora AI Agent</h1>
          <p className="mt-2">Please connect your Phantom Wallet for full functionality.</p>
          <p className="mt-2 text-sm text-gray-400">If you don't have Phantom, you can still explore the UI, but some features will be disabled.</p>
        </div>
        <AIChat />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle,#242A37,#29313F,#2C3644,#3D4854)] pt-20 pb-8 px-4">
      <div className="max-w-4xl mx-auto">
        <DashboardSummary 
          riskLevel={riskLevel}
          emailConfigured={emailConfigured}
          onUpdatePreference={handleUpdatePreference}
          onSetupNotifications={handleSetupNotifications}
        />
        {showEmailSetup && (
          <div className="bg-gray-900 bg-opacity-80 rounded-xl border border-gray-800 p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-300 mb-4">Email Notification Setup</h2>
            <EmailSetup />
            <button 
              className="mt-4 text-xs text-gray-400 hover:text-gray-300"
              onClick={handleEmailSetupComplete}
            >
              Close
            </button>
          </div>
        )}
        <AIChat />
      </div>
    </div>
  );
};

export default Dashboard;
