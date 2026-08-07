import React from "react";

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="loading-state">
      <div className="spinner small" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <span>⚠️ {error.message || "Something went wrong."}</span>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}
