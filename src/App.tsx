import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/layout';
import { Routes } from '@/components/routes';
import { AuthProvider } from '@/contexts/auth-context';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark" storageKey="versionvault-theme">
          <Layout>
            <Routes />
          </Layout>
          <Toaster />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;