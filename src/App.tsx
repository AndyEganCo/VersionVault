import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/layout';
import { Routes } from '@/components/routes';
import { AuthProvider } from '@/contexts/auth-context';
import { Analytics } from '@vercel/analytics/react';

export function App() {
  return (
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
  );
}

export default App;