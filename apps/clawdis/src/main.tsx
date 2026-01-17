import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Error Boundary to catch React errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            color: "#ff6b6b",
            padding: "20px",
            background: "#1a1a2e",
            fontFamily: "system-ui, sans-serif",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1>Something went wrong</h1>
          <p style={{ opacity: 0.7 }}>Please restart the app</p>
          <pre
            style={{
              background: "#0f0f1a",
              padding: "16px",
              borderRadius: "8px",
              maxWidth: "80vw",
              overflow: "auto",
              fontSize: "12px",
            }}
          >
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
