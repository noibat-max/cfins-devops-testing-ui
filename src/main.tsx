import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Inter (per branding spec) + Cloudscape global styles (light theme by default)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@cloudscape-design/global-styles/index.css';
import './index.css';

import { applyBrandTheme } from './theme/brandTheme';
import { AuthProvider } from './lib/auth';
import App from './App';

applyBrandTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
