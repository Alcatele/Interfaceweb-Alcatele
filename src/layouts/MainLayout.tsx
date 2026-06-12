import {
  BellOutlined,
  CheckCircleFilled,
  CustomerServiceOutlined,
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
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import { PropsWithChildren, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ThemeMode } from '../App';
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
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = screens.lg === false;
  const {
    activeTenant,
    availableTenants,
    canAccessRoute,
    currentUser,
    logout,
    role,
    roleLabel,
    switchTenant,
  } = useAuth();

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
        theme="dark"
        trigger={null}
        width={264}
      >
        <div className="sider-inner">
          <div className="brand">
            <div className="brand-mark">AC</div>
            <div className="brand-copy">
              <p className="brand-title">Alcatele Cloud</p>
              <p className="brand-subtitle">Unified Communications</p>
            </div>
          </div>
          {!collapsed ? <p className="navigation-label">Workspace</p> : null}
          <Menu
            className="app-menu"
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
            theme="dark"
          />
          {!collapsed ? (
            <div className="sider-status">
              <span className="sider-status-icon">
                <CheckCircleFilled />
              </span>
              <div>
                <strong>Serviços operacionais</strong>
                <span>Ambiente monitorado</span>
              </div>
            </div>
          ) : null}
        </div>
      </Sider>

      <Layout className="app-main">
        <Header className="topbar">
          <div className="topbar-left">
            <Button
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              type="text"
            />
            <div className="topbar-context">
              <span>Console UCaaS</span>
              <Typography.Text strong>{currentRoute?.label}</Typography.Text>
            </div>
          </div>

          <div className="topbar-right">
            <div className="tenant-control">
              <span className="tenant-control-icon">
                <CustomerServiceOutlined />
              </span>
              <div>
                <span className="tenant-label">Empresa ativa</span>
                <Select
                  aria-label="Empresa ativa"
                  bordered={false}
                  onChange={(tenantId) => void switchTenant(tenantId)}
                  options={availableTenants.map((tenant) => ({
                    label: tenant.name,
                    value: tenant.id,
                  }))}
                  popupMatchSelectWidth={260}
                  value={activeTenant?.id}
                />
              </div>
            </div>
            <Button
              className="topbar-icon-button"
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
                className="topbar-icon-button"
                aria-label="Notificações"
                icon={<BellOutlined />}
                title="Notificações"
              />
            </Badge>
            <Space className="user-control" size={9}>
              <Avatar className="user-avatar" icon={<UserOutlined />} />
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
              <Tooltip title="Sair">
                <Button
                  aria-label="Sair"
                  className="user-logout"
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
            Alcatele Tecnologia · Comunicação empresarial em nuvem
          </Typography.Text>
        </Footer>
      </Layout>
    </Layout>
  );
}

