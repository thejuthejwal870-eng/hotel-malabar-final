import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { RuntimeErrorBoundary } from './components/RuntimeErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Hotel Malabar root element was not found.');
}

// Keep fatal browser/runtime failures from presenting as a completely blank page.
window.addEventListener('error', (event) => {
  console.error('Hotel Malabar browser error:', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('Hotel Malabar unhandled promise rejection:', event.reason);
});

createRoot(rootElement).render(
  <StrictMode>
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  </StrictMode>,
);
