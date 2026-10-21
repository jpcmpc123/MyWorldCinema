import React, { Component, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
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

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    // Clear session reload markers before manually triggering reload
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('vite_') || key.startsWith('chunk_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (_) {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {this.props.fallbackTitle || 'Algo deu errado ao carregar esta página'}
          </h2>
          <p className="text-sm text-lb-text max-w-md mb-6">
            {this.props.fallbackMessage ||
              'Pode ter ocorrido uma atualização no aplicativo ou uma falha de conexão. Tente recarregar.'}
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-lb-green text-black font-semibold text-sm hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
