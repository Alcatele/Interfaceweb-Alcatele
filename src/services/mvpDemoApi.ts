import {
  extensions as seedExtensions,
  inboundRoutes as seedInboundRoutes,
  outboundRoutes as seedOutboundRoutes,
  pickupGroups as seedPickupGroups,
  ringGroups as seedRingGroups,
  sipTrunks as seedSipTrunks,
  type Extension,
  type InboundRoute,
  type OutboundRoute,
  type PickupGroup,
  type RingGroup,
  type SipTrunk,
} from './mockData';
import {
  authenticateMockUser,
  createMockUser,
  deleteMockUser,
  listPublicUsers,
  updateMockUserPassword,
  type PublicUser,
} from './mockUsers';
import type {
  ApiUser,
  DashboardSummary,
  FusionPbxStatus,
  PermissionProfile,
  SessionData,
  SessionTenant,
  TenantLimits,
  TenantResources,
  VoicemailBox,
  WebphoneConfig,
} from './mvpApi';

type Synced<T> = T & { syncStatus: 'pending' | 'synced' };
type DemoOutboundRoute = Synced<OutboundRoute> & { trunkId: string };

const sessionKey = 'alcatele-mvp-demo-session';
const activeTenantKey = 'alcatele-mvp-demo-tenant';
const tenantsKey = 'alcatele-mvp-demo-tenants';

const defaultLimits: TenantLimits = {
  users: 10,
  extensions: 10,
  trunks: 2,
  inboundRoutes: 5,
  outboundRoutes: 5,
  pickupGroups: 3,
  ringGroups: 3,
  voicemailBoxes: 10,
};

const defaultTenants: SessionTenant[] = [
  {
    id: 'tenant-alcatele',
    name: 'Alcatele Tecnologia',
    slug: 'alcatele',
    domain: 'pbx.alcatele.local',
    status: 'active',
    role: 'super_admin',
    limits: defaultLimits,
  },
  {
    id: 'tenant-demo',
    name: 'Empresa Demonstracao',
    slug: 'demo',
    domain: 'demo.alcatele.local',
    status: 'active',
    role: 'super_admin',
    limits: defaultLimits,
  },
];

let demoExtensions: Array<Synced<Extension>> = seedExtensions.map((item) => ({
  ...item,
  syncStatus: 'synced',
}));
let demoTrunks: Array<Synced<SipTrunk>> = seedSipTrunks.map((item) => ({
  ...item,
  syncStatus: 'synced',
}));
let demoInboundRoutes: Array<Synced<InboundRoute>> = seedInboundRoutes.map(
  (item) => ({ ...item, syncStatus: 'synced' }),
);
let demoOutboundRoutes: DemoOutboundRoute[] = seedOutboundRoutes.map(
  (item) => ({
    ...item,
    trunkId:
      demoTrunks.find((trunk) => trunk.name === item.trunk)?.id ??
      demoTrunks[0].id,
    syncStatus: 'synced',
  }),
);
let demoPickupGroups: PickupGroup[] = seedPickupGroups.map((item) => ({
  ...item,
  syncStatus: 'synced',
}));
let demoRingGroups: RingGroup[] = seedRingGroups.map((item) => ({
  ...item,
  syncStatus: 'synced',
}));
let demoVoicemailBoxes: VoicemailBox[] = [
  {
    id: 'voicemail-1001',
    tenantId: 'tenant-alcatele',
    mailbox: '1001',
    name: 'Caixa postal comercial',
    notificationEmail: 'comercial@alcatele.local',
    transcriptionEnabled: false,
    enabled: true,
    syncStatus: 'synced',
  },
];
let lastSyncAt: string | null = new Date().toISOString();

function makeId(prefix: string) {
  return typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${prefix}-${Date.now()}`;
}

function getTenants() {
  const stored = window.localStorage.getItem(tenantsKey);

  if (!stored) {
    return defaultTenants;
  }

  try {
    const tenants = JSON.parse(stored) as SessionTenant[];
    return Array.isArray(tenants) ? tenants : defaultTenants;
  } catch {
    return defaultTenants;
  }
}

function saveTenants(tenants: SessionTenant[]) {
  window.localStorage.setItem(tenantsKey, JSON.stringify(tenants));
}

function getSessionUser() {
  const stored = window.localStorage.getItem(sessionKey);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as PublicUser;
  } catch {
    return null;
  }
}

function permissionsFor(role: string) {
  const common = ['dashboard.view', 'pbx.view', 'webphone.use'];

  if (role === 'super_admin') {
    return [
      'tenant.manage',
      'users.manage',
      'permissions.view',
      'pbx.configure',
      ...common,
    ];
  }

  if (role === 'admin') {
    return ['users.manage', 'permissions.view', 'pbx.configure', ...common];
  }

  return common;
}

function availableTenantsFor(user: PublicUser) {
  const tenants = getTenants().filter((tenant) => tenant.status === 'active');
  return user.role === 'super_admin' ? tenants : tenants.slice(0, 1);
}

function currentTenant(user: PublicUser) {
  const tenants = availableTenantsFor(user);
  const activeId = window.localStorage.getItem(activeTenantKey);
  return tenants.find((tenant) => tenant.id === activeId) ?? tenants[0];
}

function requireUser() {
  const user = getSessionUser();

  if (!user) {
    throw new Error('Sessao de demonstracao ausente.');
  }

  return user;
}

function pendingCount() {
  return [
    ...demoExtensions,
    ...demoTrunks,
    ...demoInboundRoutes,
    ...demoOutboundRoutes,
    ...demoPickupGroups,
    ...demoRingGroups,
    ...demoVoicemailBoxes,
  ].filter((item) => item.syncStatus === 'pending').length;
}

function resourcesFor(tenant: SessionTenant): TenantResources {
  return {
    limits: tenant.limits ?? defaultLimits,
    usage: {
      users: listPublicUsers().length,
      extensions: demoExtensions.filter((item) => item.tenantId === tenant.id)
        .length,
      trunks: demoTrunks.filter((item) => item.tenantId === tenant.id).length,
      inboundRoutes:
        tenant.id === 'tenant-alcatele' ? demoInboundRoutes.length : 0,
      outboundRoutes:
        tenant.id === 'tenant-alcatele' ? demoOutboundRoutes.length : 0,
      pickupGroups: demoPickupGroups.filter(
        (item) => item.tenantId === tenant.id,
      ).length,
      ringGroups: demoRingGroups.filter((item) => item.tenantId === tenant.id)
        .length,
      voicemailBoxes: demoVoicemailBoxes.filter(
        (item) => item.tenantId === tenant.id,
      ).length,
    },
  };
}

function assertDemoLimit(resource: keyof TenantLimits) {
  const resources = resourcesFor(currentTenant(requireUser()));

  if (resources.usage[resource] >= resources.limits[resource]) {
    throw new Error('Limite contratado atingido.');
  }
}

export const demoMvpApi = {
  async login(identifier: string, password: string, remember: boolean) {
    void remember;
    const user = await authenticateMockUser(identifier, password);

    if (!user || !['super_admin', 'admin', 'user'].includes(user.role)) {
      throw new Error('Credenciais invalidas.');
    }

    window.localStorage.setItem(sessionKey, JSON.stringify(user));
    window.localStorage.setItem(
      activeTenantKey,
      availableTenantsFor(user)[0].id,
    );
  },

  async me(): Promise<SessionData> {
    const user = requireUser();
    const tenant = currentTenant(user);

    return {
      sessionId: 'demo-session',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
      },
      tenant,
      membershipId: `membership-${user.id}-${tenant.id}`,
      role: user.role,
      permissions: permissionsFor(user.role),
      availableTenants: availableTenantsFor(user),
    };
  },

  async logout() {
    window.localStorage.removeItem(sessionKey);
    window.localStorage.removeItem(activeTenantKey);
  },

  async switchTenant(tenantId: string) {
    const user = requireUser();

    if (!availableTenantsFor(user).some((tenant) => tenant.id === tenantId)) {
      throw new Error('Empresa indisponivel.');
    }

    window.localStorage.setItem(activeTenantKey, tenantId);
  },

  async listTenants() {
    const user = requireUser();
    const active = currentTenant(user);
    return availableTenantsFor(user).map((tenant) => ({
      ...tenant,
      ...resourcesFor(tenant),
      active: tenant.id === active.id,
    }));
  },

  async createTenant(input: {
    name: string;
    slug: string;
    domain: string;
    limits: TenantLimits;
  }) {
    const tenants = getTenants();

    if (
      tenants.some(
        (tenant) =>
          tenant.slug === input.slug || tenant.domain === input.domain,
      )
    ) {
      throw new Error('Empresa duplicada.');
    }

    const tenant: SessionTenant = {
      id: makeId('tenant'),
      name: input.name,
      slug: input.slug,
      domain: input.domain,
      status: 'active',
      role: 'super_admin',
      limits: input.limits,
    };
    saveTenants([...tenants, tenant]);
    return tenant;
  },

  async tenantResources() {
    return resourcesFor(currentTenant(requireUser()));
  },

  async updateTenantLimits(tenantId: string, limits: TenantLimits) {
    saveTenants(
      getTenants().map((tenant) =>
        tenant.id === tenantId ? { ...tenant, limits } : tenant,
      ),
    );
  },

  async setTenantStatus(
    tenantId: string,
    status: 'active' | 'suspended',
  ) {
    saveTenants(
      getTenants().map((tenant) =>
        tenant.id === tenantId ? { ...tenant, status } : tenant,
      ),
    );
  },

  async closeTenant(tenantId: string) {
    saveTenants(
      getTenants().map((tenant) =>
        tenant.id === tenantId ? { ...tenant, status: 'closed' } : tenant,
      ),
    );
  },

  async dashboard(): Promise<DashboardSummary> {
    const user = requireUser();
    const tenant = currentTenant(user);
    const tenantExtensions = demoExtensions.filter(
      (item) => item.tenantId === tenant.id,
    );
    const tenantTrunks = demoTrunks.filter(
      (item) => item.tenantId === tenant.id,
    );

    return {
      tenant,
      metrics: {
        extensionsTotal: tenantExtensions.length,
        extensionsOnline: tenantExtensions.filter(
          (item) => item.status === 'online',
        ).length,
        trunksTotal: tenantTrunks.length,
        trunksRegistered: tenantTrunks.filter(
          (item) => item.status === 'registered',
        ).length,
        inboundRoutes: tenant.id === 'tenant-alcatele'
          ? demoInboundRoutes.length
          : 0,
        outboundRoutes: tenant.id === 'tenant-alcatele'
          ? demoOutboundRoutes.length
          : 0,
        usersTotal: listPublicUsers().length,
        pendingSync: pendingCount(),
      },
    };
  },

  async listUsers(): Promise<ApiUser[]> {
    return listPublicUsers()
      .filter((user) => ['super_admin', 'admin', 'user'].includes(user.role))
      .map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status === 'active' ? 'active' : 'disabled',
        extension: user.extension || null,
        lastAccess: user.lastAccess,
      }));
  },

  async createUser(input: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: string;
    extension?: string;
  }) {
    assertDemoLimit('users');

    if (input.extension) {
      assertDemoLimit('extensions');
    }

    const result = await createMockUser({
      ...input,
      role: input.role === 'admin' ? 'admin' : 'user',
      extension: input.extension ?? '',
    });

    if (!result.success) {
      throw new Error(result.error);
    }
  },

  async resetPassword(userId: string, password: string) {
    if (!(await updateMockUserPassword(userId, password))) {
      throw new Error('Usuario nao encontrado.');
    }
  },

  async removeUser(userId: string) {
    const user = requireUser();
    const result = deleteMockUser(userId, user.id);

    if (!result.success) {
      throw new Error(result.error);
    }
  },

  async permissions(): Promise<PermissionProfile[]> {
    return [
      {
        role: 'super_admin',
        name: 'Super Admin',
        description: 'Controle da plataforma e empresas',
        permissions: permissionsFor('super_admin'),
      },
      {
        role: 'admin',
        name: 'Administrador',
        description: 'Administracao da empresa e PABX',
        permissions: permissionsFor('admin'),
      },
      {
        role: 'user',
        name: 'Usuario',
        description: 'WebPhone e recursos pessoais',
        permissions: permissionsFor('user'),
      },
    ];
  },

  async fusionPbxStatus(): Promise<FusionPbxStatus> {
    return {
      mode: 'mock',
      status: 'active',
      baseUrl: null,
      lastSyncAt,
      pendingJobs: pendingCount(),
      failedJobs: 0,
    };
  },

  async syncFusionPbx() {
    const total = pendingCount();
    demoExtensions = demoExtensions.map((item) => ({
      ...item,
      syncStatus: 'synced',
    }));
    demoTrunks = demoTrunks.map((item) => ({
      ...item,
      syncStatus: 'synced',
    }));
    demoInboundRoutes = demoInboundRoutes.map((item) => ({
      ...item,
      syncStatus: 'synced',
    }));
    demoOutboundRoutes = demoOutboundRoutes.map((item) => ({
      ...item,
      syncStatus: 'synced',
    }));
    demoPickupGroups = demoPickupGroups.map((item) => ({
      ...item,
      syncStatus: 'synced',
    }));
    demoRingGroups = demoRingGroups.map((item) => ({
      ...item,
      syncStatus: 'synced',
    }));
    demoVoicemailBoxes = demoVoicemailBoxes.map((item) => ({
      ...item,
      syncStatus: 'synced',
    }));
    lastSyncAt = new Date().toISOString();
    return { synchronized: total, total };
  },

  async listExtensions() {
    const tenant = currentTenant(requireUser());
    return demoExtensions.filter((item) => item.tenantId === tenant.id);
  },

  async createExtension(
    input: Omit<Extension, 'id' | 'tenantId' | 'ip' | 'lastSeen'>,
  ) {
    assertDemoLimit('extensions');
    const tenant = currentTenant(requireUser());
    demoExtensions.push({
      ...input,
      id: makeId('extension'),
      tenantId: tenant.id,
      ip: '-',
      lastSeen: 'Nunca',
      syncStatus: 'pending',
    });
  },

  async updateExtension(
    id: string,
    input: Omit<Extension, 'id' | 'tenantId' | 'ip' | 'lastSeen'>,
  ) {
    demoExtensions = demoExtensions.map((item) =>
      item.id === id ? { ...item, ...input, syncStatus: 'pending' } : item,
    );
  },

  async removeExtension(id: string) {
    demoExtensions = demoExtensions.filter((item) => item.id !== id);
  },

  async listTrunks() {
    const tenant = currentTenant(requireUser());
    return demoTrunks.filter((item) => item.tenantId === tenant.id);
  },

  async createTrunk(
    input: Omit<SipTrunk, 'id' | 'tenantId' | 'latency'>,
  ) {
    assertDemoLimit('trunks');
    const tenant = currentTenant(requireUser());
    demoTrunks.push({
      ...input,
      id: makeId('trunk'),
      tenantId: tenant.id,
      latency: 0,
      syncStatus: 'pending',
    });
  },

  async updateTrunk(
    id: string,
    input: Omit<SipTrunk, 'id' | 'tenantId' | 'latency'>,
  ) {
    demoTrunks = demoTrunks.map((item) =>
      item.id === id ? { ...item, ...input, syncStatus: 'pending' } : item,
    );
  },

  async removeTrunk(id: string) {
    demoTrunks = demoTrunks.filter((item) => item.id !== id);
  },

  async listInboundRoutes() {
    return demoInboundRoutes;
  },

  async createInboundRoute(input: Omit<InboundRoute, 'id'>) {
    assertDemoLimit('inboundRoutes');
    demoInboundRoutes.push({
      ...input,
      id: makeId('inbound'),
      syncStatus: 'pending',
    });
  },

  async updateInboundRoute(id: string, input: Omit<InboundRoute, 'id'>) {
    demoInboundRoutes = demoInboundRoutes.map((item) =>
      item.id === id ? { ...item, ...input, syncStatus: 'pending' } : item,
    );
  },

  async removeInboundRoute(id: string) {
    demoInboundRoutes = demoInboundRoutes.filter((item) => item.id !== id);
  },

  async listOutboundRoutes() {
    return demoOutboundRoutes;
  },

  async createOutboundRoute(
    input: Omit<OutboundRoute, 'id' | 'trunk'> & { trunkId: string },
  ) {
    assertDemoLimit('outboundRoutes');
    const trunk = demoTrunks.find((item) => item.id === input.trunkId);
    demoOutboundRoutes.push({
      ...input,
      id: makeId('outbound'),
      trunk: trunk?.name ?? 'Tronco',
      syncStatus: 'pending',
    });
  },

  async updateOutboundRoute(
    id: string,
    input: Omit<OutboundRoute, 'id' | 'trunk'> & { trunkId: string },
  ) {
    const trunk = demoTrunks.find((item) => item.id === input.trunkId);
    demoOutboundRoutes = demoOutboundRoutes.map((item) =>
      item.id === id
        ? {
            ...item,
            ...input,
            trunk: trunk?.name ?? item.trunk,
            syncStatus: 'pending',
          }
        : item,
    );
  },

  async removeOutboundRoute(id: string) {
    demoOutboundRoutes = demoOutboundRoutes.filter((item) => item.id !== id);
  },

  async listPickupGroups() {
    const tenant = currentTenant(requireUser());
    return demoPickupGroups.filter((item) => item.tenantId === tenant.id);
  },

  async createPickupGroup(input: Omit<PickupGroup, 'id' | 'tenantId'>) {
    assertDemoLimit('pickupGroups');
    const tenant = currentTenant(requireUser());
    demoPickupGroups.push({
      ...input,
      id: makeId('pickup'),
      tenantId: tenant.id,
      syncStatus: 'pending',
    });
  },

  async updatePickupGroup(
    id: string,
    input: Omit<PickupGroup, 'id' | 'tenantId'>,
  ) {
    demoPickupGroups = demoPickupGroups.map((item) =>
      item.id === id ? { ...item, ...input, syncStatus: 'pending' } : item,
    );
  },

  async removePickupGroup(id: string) {
    demoPickupGroups = demoPickupGroups.filter((item) => item.id !== id);
  },

  async listRingGroups() {
    const tenant = currentTenant(requireUser());
    return demoRingGroups.filter((item) => item.tenantId === tenant.id);
  },

  async createRingGroup(input: Omit<RingGroup, 'id' | 'tenantId'>) {
    assertDemoLimit('ringGroups');
    const tenant = currentTenant(requireUser());
    demoRingGroups.push({
      ...input,
      id: makeId('ring'),
      tenantId: tenant.id,
      syncStatus: 'pending',
    });
  },

  async updateRingGroup(
    id: string,
    input: Omit<RingGroup, 'id' | 'tenantId'>,
  ) {
    demoRingGroups = demoRingGroups.map((item) =>
      item.id === id ? { ...item, ...input, syncStatus: 'pending' } : item,
    );
  },

  async removeRingGroup(id: string) {
    demoRingGroups = demoRingGroups.filter((item) => item.id !== id);
  },

  async listVoicemailBoxes() {
    const tenant = currentTenant(requireUser());
    return demoVoicemailBoxes.filter((item) => item.tenantId === tenant.id);
  },

  async createVoicemailBox(
    input: Omit<VoicemailBox, 'id' | 'tenantId' | 'syncStatus'>,
  ) {
    assertDemoLimit('voicemailBoxes');
    const tenant = currentTenant(requireUser());
    demoVoicemailBoxes.push({
      ...input,
      id: makeId('voicemail'),
      tenantId: tenant.id,
      syncStatus: 'pending',
    });
  },

  async updateVoicemailBox(
    id: string,
    input: Omit<VoicemailBox, 'id' | 'tenantId' | 'syncStatus'>,
  ) {
    demoVoicemailBoxes = demoVoicemailBoxes.map((item) =>
      item.id === id ? { ...item, ...input, syncStatus: 'pending' } : item,
    );
  },

  async removeVoicemailBox(id: string) {
    demoVoicemailBoxes = demoVoicemailBoxes.filter((item) => item.id !== id);
  },

  async webphoneConfig(): Promise<WebphoneConfig> {
    const user = requireUser();
    const tenant = currentTenant(user);
    return {
      uri: `sip:${user.extension || '1000'}@${tenant.domain}`,
      authorizationUsername: user.extension || '1000',
      password: 'demo-only',
      displayName: user.name,
      wsServer: 'wss://demo.invalid:7443',
      sipDomain: tenant.domain,
    };
  },
};
