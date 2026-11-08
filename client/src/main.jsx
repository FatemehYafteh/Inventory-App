import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { reloadOnStaleChunk } from './lib/chunkReload';
import { queryClient } from './lib/queryClient';
import '@fontsource-variable/vazirmatn';
import './index.css';

// Pages load on demand; after a new deploy an open tab may ask for a file that is gone.
reloadOnStaleChunk();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
