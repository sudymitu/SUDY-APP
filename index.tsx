import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './hooks/useTranslation';
import { ActivationProvider } from './contexts/ActivationContext';
import { ImageLibraryProvider } from './contexts/ImageLibraryContext';
import { ApiQuotaProvider } from './contexts/ApiQuotaContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <ActivationProvider>
        <ImageLibraryProvider>
          <ApiQuotaProvider>
            <App />
          </ApiQuotaProvider>
        </ImageLibraryProvider>
      </ActivationProvider>
    </LanguageProvider>
  </React.StrictMode>
);
