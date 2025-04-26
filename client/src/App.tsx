"use client";

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import { Toaster as SonnerToaster } from "sonner";
import { ErrorBoundary } from "./ErrorBoundary";
import { PhantomWalletProvider } from "./components/PhantomWallet";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PhantomWalletProvider>
            <Toaster />
            <SonnerToaster
              position="bottom-right"
              toastOptions={{
                className: "bg-[rgba(42,43,54,0.8)] text-white border border-[rgba(255,255,255,0.1)] shadow-lg",
                duration: 2500,
              }}
            />
            <Router />
          </PhantomWalletProvider>
        </TooltipProvider>
      </QueryClientProvider>
      <div style={{position:'fixed',bottom:10,right:10,fontSize:12,color:'#aaa'}}>It works! (React tree rendered)</div>
    </ErrorBoundary>
  );
}

export default App;
