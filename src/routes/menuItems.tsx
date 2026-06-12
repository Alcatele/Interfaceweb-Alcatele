import {
  ApartmentOutlined,
  ApiOutlined,
  AudioOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CalendarOutlined,
  ContactsOutlined,
  ControlOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  FileSearchOutlined,
  LoginOutlined,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  UsergroupAddOutlined,
  BankOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import type { RouteKey } from '../services/accessControl';

export type RouteItem = {
  key: RouteKey;
  label: string;
  path: string;
  icon: ReactNode;
};

export const routeItems: RouteItem[] = [
  {
    key: 'tenants',
    label: 'Empresas',
    path: '/empresas',
    icon: <BankOutlined />,
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: <DashboardOutlined />,
  },
  {
    key: 'extensions',
    label: 'Ramais',
    path: '/ramais',
    icon: <PhoneOutlined />,
  },
  {
    key: 'provisioning',
    label: 'Provisionamento',
    path: '/provisionamento',
    icon: <ToolOutlined />,
  },
  {
    key: 'contacts',
    label: 'Contatos',
    path: '/contatos',
    icon: <ContactsOutlined />,
  },
  {
    key: 'agents',
    label: 'Agentes',
    path: '/agentes',
    icon: <TeamOutlined />,
  },
  {
    key: 'sip-trunks',
    label: 'Troncos SIP',
    path: '/troncos-sip',
    icon: <ApiOutlined />,
  },
  {
    key: 'outbound-routes',
    label: 'Rotas de saída',
    path: '/rotas-saida',
    icon: <BranchesOutlined />,
  },
  {
    key: 'inbound-routes',
    label: 'Rotas de entrada',
    path: '/rotas-entrada',
    icon: <LoginOutlined />,
  },
  {
    key: 'call-calendar',
    label: 'Calendário',
    path: '/calendario',
    icon: <CalendarOutlined />,
  },
  {
    key: 'ivr',
    label: 'URA',
    path: '/ura',
    icon: <DeploymentUnitOutlined />,
  },
  {
    key: 'pickup-groups',
    label: 'Grupos de captura',
    path: '/grupos-captura',
    icon: <UsergroupAddOutlined />,
  },
  {
    key: 'ring-groups',
    label: 'Grupos de chamada',
    path: '/grupos-toque',
    icon: <PhoneOutlined />,
  },
  {
    key: 'queues',
    label: 'Filas',
    path: '/filas',
    icon: <ApartmentOutlined />,
  },
  {
    key: 'operator-panel',
    label: 'Painel de operador',
    path: '/operador',
    icon: <ControlOutlined />,
  },
  {
    key: 'call-center',
    label: 'Central de atendimento',
    path: '/central-atendimento',
    icon: <BarChartOutlined />,
  },
  {
    key: 'reports',
    label: 'CDR / Relatórios',
    path: '/relatorios',
    icon: <FileSearchOutlined />,
  },
  {
    key: 'recordings',
    label: 'Gravações',
    path: '/gravacoes',
    icon: <AudioOutlined />,
  },
  {
    key: 'chat',
    label: 'Chat interno',
    path: '/chat',
    icon: <MessageOutlined />,
  },
  {
    key: 'webphone',
    label: 'Webphone WebRTC',
    path: '/webphone',
    icon: <CustomerServiceOutlined />,
  },
  {
    key: 'voicemail',
    label: 'Correio de voz',
    path: '/correio-voz',
    icon: <MailOutlined />,
  },
  {
    key: 'security-audit',
    label: 'Segurança',
    path: '/seguranca',
    icon: <SafetyCertificateOutlined />,
  },
  {
    key: 'settings',
    label: 'Configurações',
    path: '/configuracoes',
    icon: <SettingOutlined />,
  },
];

export const menuItems: MenuProps['items'] = routeItems.map((item) => ({
  key: item.key,
  icon: item.icon,
  label: item.label,
}));

export const defaultIcon = <AppstoreOutlined />;
