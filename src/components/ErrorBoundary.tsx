import React, { Component, ErrorInfo, ReactNode } from 'react';
import { BrandLogo } from './BrandLogo.tsx';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[App Error Boundary] Uncaught runtime display error:', error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/menu/prime-cafe';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas text-[#080808] flex items-center justify-center p-6 text-center selection:bg-[#080808] selection:text-[#FCF6BA]">
          <div className="max-w-md bg-gold-surface p-8 rounded-2xl border-2 border-[#080808]/40 shadow-2xl space-y-4">
            <BrandLogo size="lg" className="justify-center mx-auto" showSubtitle={false} />
            <div className="inline-flex p-3 rounded-full bg-amber-500/20 text-amber-900 border border-amber-600/30">
              <AlertTriangle className="w-6 h-6 text-[#080808]" />
            </div>
            <h1 className="text-xl font-extrabold text-[#080808] font-display">
              Four Season Cafe &amp; Restaurant
            </h1>
            <p className="text-xs text-[#1A1A1A] font-semibold leading-relaxed">
              We encountered a temporary display issue. Tap below to reload the digital menu smoothly.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-[#080808] text-[#FCF6BA] font-extrabold text-xs hover:bg-[#1A1A1A] shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Reload Menu</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-[#080808] font-bold text-xs border border-[#080808]/30 transition-all cursor-pointer"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
