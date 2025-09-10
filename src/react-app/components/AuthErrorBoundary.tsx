import { Component, ReactNode } from "react";
import { ApiService } from "../services/api";

interface Props {
  children: ReactNode;
  onAuthError: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is an authentication error
    if (error.message.includes("Authentication expired")) {
      return { hasError: true, error };
    }
    // For other errors, don't catch them here
    throw error;
  }

  componentDidCatch(error: Error) {
    if (error.message.includes("Authentication expired")) {
      // Clear auth and trigger re-authentication
      ApiService.clearAuth();
      this.props.onAuthError();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div>Session expired. Please refresh the page to continue.</div>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}
