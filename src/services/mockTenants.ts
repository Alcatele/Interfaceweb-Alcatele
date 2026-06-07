export type TenantPlan = 'Start' | 'Business' | 'Enterprise';

export type TenantResourceKey =
  | 'extensions'
  | 'sipTrunks'
  | 'queues'
  | 'ivr'
  | 'ringGroups'
  | 'pickupGroups'
  | 'recordings'
  | 'webphone'
  | 'reports'
  | 'storageGb';

export type TenantResource = {
  key: TenantResourceKey;
  enabled: boolean;
  quantity: number;
};

export type MockTenant = {
  id: string;
  name: string;
  document: string;
  domain: string;
  plan: TenantPlan;
  extensionLimit: number;
  resources: TenantResource[];
  status: 'active' | 'suspended';
  createdAt: string;
};

export type CreateTenantInput = Omit<
  MockTenant,
  'id' | 'status' | 'createdAt'
>;

const storageKey = 'pabx-cloud-tenants';

export const tenantResourceCatalog: Array<{
  key: TenantResourceKey;
  label: string;
  unit: string;
}> = [
  { key: 'extensions', label: 'Ramais', unit: 'ramais' },
  { key: 'sipTrunks', label: 'Troncos SIP', unit: 'troncos' },
  { key: 'queues', label: 'Filas', unit: 'filas' },
  { key: 'ivr', label: 'URA', unit: 'menus' },
  { key: 'ringGroups', label: 'Grupos de toque', unit: 'grupos' },
  { key: 'pickupGroups', label: 'Grupos de captura', unit: 'grupos' },
  { key: 'recordings', label: 'Gravações', unit: 'canais' },
  { key: 'webphone', label: 'Webphone', unit: 'usuários' },
  { key: 'reports', label: 'Relatórios', unit: 'usuários' },
  { key: 'storageGb', label: 'Armazenamento', unit: 'GB' },
];

export function createDefaultTenantResources(
  extensionLimit: number,
): TenantResource[] {
  return [
    { key: 'extensions', enabled: true, quantity: extensionLimit },
    { key: 'sipTrunks', enabled: true, quantity: 2 },
    { key: 'queues', enabled: true, quantity: 3 },
    { key: 'ivr', enabled: true, quantity: 2 },
    { key: 'ringGroups', enabled: true, quantity: 2 },
    { key: 'pickupGroups', enabled: true, quantity: 2 },
    { key: 'recordings', enabled: true, quantity: extensionLimit },
    { key: 'webphone', enabled: true, quantity: extensionLimit },
    { key: 'reports', enabled: true, quantity: 5 },
    { key: 'storageGb', enabled: true, quantity: 50 },
  ];
}

function normalizeTenant(tenant: MockTenant): MockTenant {
  const resources =
    Array.isArray(tenant.resources) && tenant.resources.length > 0
      ? tenant.resources
      : createDefaultTenantResources(tenant.extensionLimit);

  return {
    ...tenant,
    resources,
  };
}

const defaultTenants: MockTenant[] = [
  {
    id: 'tenant-alcatele',
    name: 'Alcatele Tecnologia',
    document: '12.345.678/0001-90',
    domain: 'pbx.alcatele.cloud',
    plan: 'Enterprise',
    extensionLimit: 120,
    resources: [
      { key: 'extensions', enabled: true, quantity: 120 },
      { key: 'sipTrunks', enabled: true, quantity: 6 },
      { key: 'queues', enabled: true, quantity: 12 },
      { key: 'ivr', enabled: true, quantity: 8 },
      { key: 'ringGroups', enabled: true, quantity: 10 },
      { key: 'pickupGroups', enabled: true, quantity: 10 },
      { key: 'recordings', enabled: true, quantity: 120 },
      { key: 'webphone', enabled: true, quantity: 120 },
      { key: 'reports', enabled: true, quantity: 20 },
      { key: 'storageGb', enabled: true, quantity: 500 },
    ],
    status: 'active',
    createdAt: '15/01/2026',
  },
  {
    id: 'tenant-demo',
    name: 'Empresa Demonstração',
    document: '98.765.432/0001-10',
    domain: 'demo.alcatele.cloud',
    plan: 'Business',
    extensionLimit: 40,
    resources: [
      { key: 'extensions', enabled: true, quantity: 40 },
      { key: 'sipTrunks', enabled: true, quantity: 2 },
      { key: 'queues', enabled: true, quantity: 4 },
      { key: 'ivr', enabled: true, quantity: 2 },
      { key: 'ringGroups', enabled: true, quantity: 4 },
      { key: 'pickupGroups', enabled: true, quantity: 4 },
      { key: 'recordings', enabled: true, quantity: 40 },
      { key: 'webphone', enabled: true, quantity: 40 },
      { key: 'reports', enabled: true, quantity: 8 },
      { key: 'storageGb', enabled: true, quantity: 120 },
    ],
    status: 'active',
    createdAt: '20/05/2026',
  },
];

function saveTenants(tenants: MockTenant[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(tenants));
}

export function listMockTenants(): MockTenant[] {
  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return defaultTenants;
  }

  try {
    const tenants = JSON.parse(stored) as MockTenant[];
    return Array.isArray(tenants)
      ? tenants.map(normalizeTenant)
      : defaultTenants;
  } catch {
    return defaultTenants;
  }
}

export function createMockTenant(input: CreateTenantInput) {
  const tenants = listMockTenants();
  const normalizedDomain = input.domain.trim().toLowerCase();

  if (tenants.some((tenant) => tenant.domain === normalizedDomain)) {
    return { success: false, error: 'Este domínio já está em uso.' };
  }

  const tenant: MockTenant = {
    ...input,
    id:
      typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `tenant-${Date.now()}`,
    name: input.name.trim(),
    document: input.document.trim(),
    domain: normalizedDomain,
    extensionLimit:
      input.resources.find((resource) => resource.key === 'extensions')
        ?.quantity ?? input.extensionLimit,
    status: 'active',
    createdAt: new Intl.DateTimeFormat('pt-BR').format(new Date()),
  };

  saveTenants([...tenants, tenant]);
  return { success: true, tenant };
}

export function deleteMockTenant(tenantId: string) {
  const tenants = listMockTenants();

  if (!tenants.some((tenant) => tenant.id === tenantId)) {
    return false;
  }

  saveTenants(tenants.filter((tenant) => tenant.id !== tenantId));
  return true;
}

export function updateMockTenant(tenantId: string, input: CreateTenantInput) {
  const tenants = listMockTenants();
  const normalizedDomain = input.domain.trim().toLowerCase();

  if (
    tenants.some(
      (tenant) => tenant.id !== tenantId && tenant.domain === normalizedDomain,
    )
  ) {
    return { success: false, error: 'Este domínio já está em uso.' };
  }

  saveTenants(
    tenants.map((tenant) =>
      tenant.id === tenantId
        ? {
            ...tenant,
            ...input,
            name: input.name.trim(),
            document: input.document.trim(),
            domain: normalizedDomain,
            extensionLimit:
              input.resources.find((resource) => resource.key === 'extensions')
                ?.quantity ?? input.extensionLimit,
          }
        : tenant,
    ),
  );

  return { success: true };
}

export function updateMockTenantStatus(
  tenantId: string,
  status: MockTenant['status'],
) {
  const tenants = listMockTenants();
  saveTenants(
    tenants.map((tenant) =>
      tenant.id === tenantId ? { ...tenant, status } : tenant,
    ),
  );
}

