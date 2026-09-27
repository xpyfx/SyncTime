import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle unhandled rejections and errors caused by browser extensions (e.g. MetaMask, Wallet extensions)
if (typeof window !== 'undefined') {
  const isExtensionError = (err: any) => {
    const str = (err?.message || err?.stack || String(err || '')).toLowerCase();
    return (
      str.includes('metamask') ||
      str.includes('ethereum') ||
      str.includes('web3') ||
      str.includes('wallet') ||
      str.includes('failed to connect') ||
      str.includes('user rejected')
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isExtensionError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        console.warn('Suppressed browser extension rejection:', event.reason);
      }
    },
    true
  );

  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (isExtensionError(message) || isExtensionError(error) || isExtensionError(source)) {
      console.warn('Suppressed browser extension window.onerror:', message);
      return true; // Prevents error reporting
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

