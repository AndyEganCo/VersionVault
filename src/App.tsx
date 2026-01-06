import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/layout';
import { Routes } from '@/components/routes';
import { AuthProvider } from '@/contexts/auth-context';
import { Analytics } from '@vercel/analytics/react';

export function App() {
  return (
    <HelmetProvider>
      <BrowserRouter future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}>
        <AuthProvider>
          <ThemeProvider defaultTheme="dark" storageKey="versionvault-theme">
            <Layout>
              <Routes />
            </Layout>
            <Toaster />
            <Analytics />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;