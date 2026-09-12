import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

export class RuntimeErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error || 'Unknown application error');
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Hotel Malabar UI runtime error:', error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#0a1f13] text-[#fcfaf6] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border border-[#cba135]/40 bg-[#102a1b] p-7 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#cba135]/50 bg-[#173d26] text-[#dfb64c] text-2xl font-bold">
            !
          </div>
          <h1 className="font-brand text-2xl font-bold uppercase tracking-wide text-white">Hotel Malabar</h1>
          <p className="mt-2 text-sm text-[#d8cfbe]">The website hit a temporary loading error.</p>
          <button
            onClick={this.reload}
            className="mt-6 rounded-xl bg-gradient-to-r from-[#dfb64c] to-[#cba135] px-6 py-3 font-bold text-[#0a1f13] shadow-lg"
          >
            Reload Website
          </button>
          <p className="mt-4 break-words text-[11px] text-[#829b8b]">{this.state.message}</p>
        </div>
      </div>
    );
  }
}
