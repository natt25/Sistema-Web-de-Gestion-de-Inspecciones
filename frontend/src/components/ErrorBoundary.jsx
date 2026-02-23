import React from "react";

const IS_DEV = Boolean(import.meta.env.DEV);

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      errorStack: "",
      componentStack: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Error de render",
      errorStack: error?.stack || "",
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      componentStack: errorInfo?.componentStack || "",
      errorStack: error?.stack || this.state.errorStack,
    });
    console.error("[ErrorBoundary] UI crash:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (!IS_DEV) {
      return (
        <div style={{ padding: 16 }}>
          Ocurrio un error inesperado en la interfaz.
        </div>
      );
    }

    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>Error de UI capturado</h2>
        <p style={{ marginTop: 8 }}>{this.state.errorMessage}</p>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12 }}>
          {this.state.errorStack || "(sin stack JS)"}
        </pre>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12 }}>
          {this.state.componentStack || "(sin component stack)"}
        </pre>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Revisa la consola del navegador para stack trace.
        </p>
      </div>
    );
  }
}
