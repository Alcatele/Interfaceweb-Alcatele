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
        colorPrimary: '#3b6ff5',
        colorInfo: '#3b82f6',
        colorSuccess: '#16a34a',
        colorWarning: '#f59e0b',
        colorError: '#ef4444',
        borderRadius: 12,
        controlHeight: 38,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      components: {
        Button: {
          borderRadius: 10,
          controlHeight: 38,
          fontWeight: 600,
          primaryShadow: '0 8px 18px rgba(59, 111, 245, 0.22)',
        },
        Layout: {
          bodyBg: themeMode === 'dark' ? '#0f1420' : '#f4f7fb',
          headerBg: themeMode === 'dark' ? '#171d2a' : '#ffffff',
          siderBg: '#111a2e',
        },
        Menu: {
          darkItemBg: '#111a2e',
          darkItemColor: '#aebbd0',
          darkItemHoverBg: 'rgba(255, 255, 255, 0.07)',
          darkItemHoverColor: '#ffffff',
          darkItemSelectedBg: '#3b6ff5',
          darkItemSelectedColor: '#ffffff',
          itemBorderRadius: 10,
          itemHeight: 44,
          itemMarginInline: 12,
          itemMarginBlock: 4,
        },
        Card: {
          borderRadiusLG: 16,
          boxShadowTertiary: '0 8px 24px rgba(27, 39, 68, 0.06)',
        },
        Input: {
          activeBorderColor: '#3b6ff5',
          hoverBorderColor: '#7295f8',
        },
        Select: {
          optionSelectedBg: 'rgba(59, 111, 245, 0.1)',
        },
        Table: {
          headerBg: themeMode === 'dark' ? '#1b2230' : '#f7f9fc',
          headerColor: themeMode === 'dark' ? '#d9e2f1' : '#53627a',
          rowHoverBg:
            themeMode === 'dark'
              ? 'rgba(59, 111, 245, 0.08)'
              : 'rgba(59, 111, 245, 0.035)',
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
