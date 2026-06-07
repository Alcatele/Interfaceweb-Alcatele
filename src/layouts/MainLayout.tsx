import {
  BellOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Grid,
  Layout,
  Menu,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import { PropsWithChildren, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ThemeMode } from '../App';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { useAuth } from '../contexts/useAuth';
import { routeItems } from '../routes/menuItems';
import { roleProfiles } from '../services/accessControl';

const { Header, Sider, Content, Footer } = Layout;

type MainLayoutProps = PropsWithChildren<{
  themeMode: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}>;

export default function MainLayout({
  children,
  themeMode,
  onThemeChange,
}: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = screens.lg === false;
  const { canAccessRoute, currentUser, logout, role, roleLabel } = useAuth();

  const activeKey = useMemo(() => {
    const match =
      routeItems.find((route) => route.path === location.pathname) ??
      routeItems.find(
        (route) =>
          route.path !== '/' && location.pathname.startsWith(route.path),
      );

    return match?.key ?? 'dashboard';
  }, [location.pathname]);

  const currentRoute = routeItems.find((route) => route.key === activeKey);
  const visibleRouteItems = useMemo(
    () => routeItems.filter((route) => canAccessRoute(route.key)),
    [canAccessRoute],
  );
  const visibleMenuItems: MenuProps['items'] = useMemo(
    () =>
      visibleRouteItems.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    [visibleRouteItems],
  );

  if (!currentUser) {
    return null;
  }

  return (
    <Layout className="app-layout">
      <Sider
        breakpoint="lg"
        className="app-sider"
        collapsed={collapsed}
        collapsedWidth={isMobile ? 0 : 72}
        collapsible
        onBreakpoint={(broken) => setCollapsed(broken)}
        onCollapse={setCollapsed}
        theme={themeMode}
        trigger={null}
        width={256}
      >
        <div className="brand">
          <div className="brand-mark">AC</div>
          <div className="brand-copy">
            <p className="brand-title">Alcatele Cloud PBX</p>
            <p className="brand-subtitle">Painel administrativo</p>
          </div>
        </div>
        <Menu
          items={visibleMenuItems}
          mode="inline"
          onClick={({ key }) => {
            const route = routeItems.find((item) => item.key === key);

            if (route) {
              navigate(route.path);

              if (isMobile) {
                setCollapsed(true);
              }
            }
          }}
          selectedKeys={[activeKey]}
          style={{ borderInlineEnd: 0, paddingBlock: 12 }}
          theme={themeMode}
        />
      </Sider>

      <Layout>
        <Header className="topbar">
          <div className="topbar-left">
            <Button
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              type="text"
            />
            <Typography.Text strong>{currentRoute?.label}</Typography.Text>
          </div>

          <div className="topbar-right">
            <Button
              aria-label={
                themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
              }
              icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={() =>
                onThemeChange(themeMode === 'dark' ? 'light' : 'dark')
              }
              title={themeMode === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            />
            <Badge count={3} size="small">
              <Button
                aria-label="Notificações"
                icon={<BellOutlined />}
                title="Notificações"
              />
            </Badge>
            <Space size={8}>
              <Avatar icon={<UserOutlined />} />
              <div className="topbar-user">
                <Typography.Text strong>{currentUser.name}</Typography.Text>
                <Typography.Text
                  style={{
                    color: roleProfiles[role].color,
                    display: 'block',
                    fontSize: 12,
                  }}
                >
                  {roleLabel}
                </Typography.Text>
              </div>
              <Tooltip title="Alterar minha senha">
                <Button
                  aria-label="Alterar minha senha"
                  icon={<LockOutlined />}
                  onClick={() => setChangePasswordOpen(true)}
                  title="Alterar minha senha"
                  type="text"
                />
              </Tooltip>
              <Tooltip title="Sair">
                <Button
                  aria-label="Sair"
                  icon={<LogoutOutlined />}
                  onClick={logout}
                  title="Sair"
                  type="text"
                />
              </Tooltip>
            </Space>
          </div>
        </Header>
        <Content className="page-shell">{children}</Content>
        <Footer className="app-footer">
          <Typography.Text type="secondary">
            Copyright 2026 Alcatele Tecnologia. Todos os direitos reservados.
          </Typography.Text>
        </Footer>
      </Layout>
      <ChangePasswordModal
        onClose={() => setChangePasswordOpen(false)}
        open={changePasswordOpen}
        userId={currentUser.id}
      />
    </Layout>
  );
}

