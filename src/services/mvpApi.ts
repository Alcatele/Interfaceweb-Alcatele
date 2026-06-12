import api from './api';
import { demoMvpApi } from './mvpDemoApi';
import type {
  Extension,
  InboundRoute,
  OutboundRoute,
  SipTrunk,
} from './mockData';

export type SessionTenant = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  membershipId?: string;
  role?: string;
  active?: boolean;
  status?: 'active' | 'suspended' | 'closed';
};

export type SessionData = {
  sessionId: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
  tenant: SessionTenant;
  membershipId: string;
  role: string;
  permissions: string[];
  availableTenants: SessionTenant[];
};

export type DashboardSummary = {
  tenant: SessionTenant;
  metrics: {
    extensionsTotal: number;
    extensionsOnline: number;
    trunksTotal: number;
    trunksRegistered: number;
    inboundRoutes: number;
    outboundRoutes: number;
    usersTotal: number;
    pendingSync: number;
  };
};

export type ApiUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: 'active' | 'suspended' | 'disabled';
  extension: string | null;
  lastAccess: string | null;
};

export type PermissionProfile = {
  role: string;
  name: string;
  description: string;
  permissions: string[];
};

export type FusionPbxStatus = {
  mode: 'mock' | 'live';
  status: string;
  baseUrl: string | null;
  lastSyncAt: string | null;
  pendingJobs: number;
  failedJobs: number;
};

export type WebphoneConfig = {
  uri: string;
  authorizationUsername: string;
  password: string;
  displayName: string;
  wsServer: string;
  sipDomain: string;
};

const liveMvpApi = {
  async login(identifier: string, password: string, remember: boolean) {
    await api.post('/auth/login', { identifier, password, remember });
  },
  async me() {
    return (await api.get<SessionData>('/auth/me')).data;
  },
  async logout() {
    await api.post('/auth/logout');
  },
  async switchTenant(tenantId: string) {
    await api.post('/auth/switch-tenant', { tenantId });
  },
  async listTenants() {
    return (await api.get<SessionTenant[]>('/tenants')).data;
  },
  async createTenant(input: { name: string; slug: string; domain: string }) {
    return (await api.post('/tenants', input)).data;
  },
  async setTenantStatus(
    tenantId: string,
    status: 'active' | 'suspended',
  ) {
    return (await api.patch(`/tenants/${tenantId}/status`, { status })).data;
  },
  async closeTenant(tenantId: string) {
    await api.delete(`/tenants/${tenantId}`);
  },
  async dashboard() {
    return (await api.get<DashboardSummary>('/dashboard/summary')).data;
  },
  async listUsers() {
    return (await api.get<ApiUser[]>('/users')).data;
  },
  async createUser(input: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: string;
    extension?: string;
  }) {
    return (await api.post('/users', input)).data;
  },
  async resetPassword(userId: string, password: string) {
    await api.post(`/users/${userId}/reset-password`, { password });
  },
  async removeUser(userId: string) {
    await api.delete(`/users/${userId}`);
  },
  async permissions() {
    return (await api.get<PermissionProfile[]>('/permissions')).data;
  },
  async fusionPbxStatus() {
    return (await api.get<FusionPbxStatus>('/fusionpbx/status')).data;
  },
  async syncFusionPbx() {
    return (
      await api.post<{ synchronized: number; total: number }>(
        '/fusionpbx/sync',
      )
    ).data;
  },
  async listExtensions() {
    return (await api.get<Extension[]>('/pbx/extensions')).data;
  },
  async createExtension(input: Omit<Extension, 'id' | 'tenantId' | 'ip' | 'lastSeen'>) {
    return (await api.post('/pbx/extensions', input)).data;
  },
  async updateExtension(
    id: string,
    input: Omit<Extension, 'id' | 'tenantId' | 'ip' | 'lastSeen'>,
  ) {
    return (await api.patch(`/pbx/extensions/${id}`, input)).data;
  },
  async removeExtension(id: string) {
    await api.delete(`/pbx/extensions/${id}`);
  },
  async listTrunks() {
    return (await api.get<SipTrunk[]>('/pbx/trunks')).data;
  },
  async createTrunk(input: Omit<SipTrunk, 'id' | 'tenantId' | 'latency'>) {
    return (await api.post('/pbx/trunks', input)).data;
  },
  async updateTrunk(
    id: string,
    input: Omit<SipTrunk, 'id' | 'tenantId' | 'latency'>,
  ) {
    return (await api.patch(`/pbx/trunks/${id}`, input)).data;
  },
  async removeTrunk(id: string) {
    await api.delete(`/pbx/trunks/${id}`);
  },
  async listInboundRoutes() {
    return (await api.get<InboundRoute[]>('/pbx/routes/inbound')).data;
  },
  async createInboundRoute(input: Omit<InboundRoute, 'id'>) {
    return (await api.post('/pbx/routes/inbound', input)).data;
  },
  async updateInboundRoute(id: string, input: Omit<InboundRoute, 'id'>) {
    return (await api.patch(`/pbx/routes/inbound/${id}`, input)).data;
  },
  async removeInboundRoute(id: string) {
    await api.delete(`/pbx/routes/inbound/${id}`);
  },
  async listOutboundRoutes() {
    return (await api.get<Array<OutboundRoute & { trunkId: string }>>(
      '/pbx/routes/outbound',
    )).data;
  },
  async createOutboundRoute(
    input: Omit<OutboundRoute, 'id' | 'trunk'> & { trunkId: string },
  ) {
    return (await api.post('/pbx/routes/outbound', input)).data;
  },
  async updateOutboundRoute(
    id: string,
    input: Omit<OutboundRoute, 'id' | 'trunk'> & { trunkId: string },
  ) {
    return (await api.patch(`/pbx/routes/outbound/${id}`, input)).data;
  },
  async removeOutboundRoute(id: string) {
    await api.delete(`/pbx/routes/outbound/${id}`);
  },
  async webphoneConfig() {
    return (await api.get<WebphoneConfig>('/webphone/config')).data;
  },
};

export const mvpApi =
  import.meta.env.VITE_DEMO_MODE === 'true' ? demoMvpApi : liveMvpApi;
