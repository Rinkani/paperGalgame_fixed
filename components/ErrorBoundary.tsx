import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-pink-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg border-2 border-red-200">
            <div className="text-red-500 text-4xl mb-4">⚠</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              呜… 出错了（Error）
            </h2>
            <p className="text-gray-600 mb-4 font-mono text-sm bg-gray-50 p-3 rounded-lg break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-gal-pink text-white px-6 py-2 rounded-full font-bold hover:bg-gal-pink-dark transition-colors"
            >
              重新开始（Reload）
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
