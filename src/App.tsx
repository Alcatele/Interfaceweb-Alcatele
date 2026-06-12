import { ConfigProvider, Spin, theme } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { useEffect, useMemo, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import AppRoutes from './routes/AppRoutes';

export type ThemeMode = 'light' | 'dark';

const storageKey = 'pabx-cloud-theme';

function getInitialTheme(): ThemeMode {
  const stored = window.localStorage.getItem(storageKey);

  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function AppContent({
  themeMode,
  onThemeChange,
}: {
  themeMode: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="login-screen">
        <Spin size="large" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <MainLayout themeMode={themeMode} onThemeChange={onThemeChange}>
      <AppRoutes />
    </MainLayout>
  );
}

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    window.localStorage.setItem(storageKey, themeMode);
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  const themeConfig = useMemo(
    () => ({
      algorithm:
        themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#0f766e',
        colorInfo: '#2563eb',
        colorSuccess: '#16a34a',
        colorWarning: '#d97706',
        colorError: '#dc2626',
        borderRadius: 8,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      components: {
        Layout: {
          bodyBg: themeMode === 'dark' ? '#101418' : '#f5f7fa',
          headerBg: themeMode === 'dark' ? '#151b21' : '#ffffff',
          siderBg: themeMode === 'dark' ? '#0e1318' : '#ffffff',
        },
        Menu: {
          itemBorderRadius: 6,
          itemMarginInline: 8,
        },
        Card: {
          borderRadiusLG: 8,
        },
      },
    }),
    [themeMode],
  );

  return (
    <ConfigProvider locale={ptBR} theme={themeConfig}>
      <AuthProvider>
        <AppContent themeMode={themeMode} onThemeChange={setThemeMode} />
      </AuthProvider>
    </ConfigProvider>
  );
}
