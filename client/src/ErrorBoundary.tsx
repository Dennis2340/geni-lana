import React from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={({ error }) => (
        <div style={{ padding: 32, color: '#c62828', background: '#ffebee', borderRadius: 8 }}>
          <h2>Something went wrong.</h2>
          <pre>{error.message}</pre>
        </div>
      )}
      onError={(error, errorInfo) => {
        // Log error if needed
        console.error("ErrorBoundary caught error:", error, errorInfo);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
