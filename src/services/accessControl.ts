export const userRoles = [
  'super_admin',
  'admin',
  'supervisor',
  'agent',
  'user',
] as const;

export type UserRole = (typeof userRoles)[number];

export const routeKeys = [
  'tenants',
  'dashboard',
  'extensions',
  'provisioning',
  'contacts',
  'agents',
  'sip-trunks',
  'outbound-routes',
  'inbound-routes',
  'call-calendar',
  'ivr',
  'pickup-groups',
  'ring-groups',
  'queues',
  'operator-panel',
  'call-center',
  'reports',
  'recordings',
  'chat',
  'webphone',
  'voicemail',
  'security-audit',
  'settings',
] as const;

export type RouteKey = (typeof routeKeys)[number];

export const permissions = [
  {
    key: 'tenant.manage',
    label: 'Gerenciar tenants',
    description: 'Criar tenants, domínios e políticas globais.',
  },
  {
    key: 'users.manage',
    label: 'Gerenciar usuários',
    description: 'Criar contas, perfis e credenciais.',
  },
  {
    key: 'agents.manage',
    label: 'Gerenciar agentes',
    description: 'Criar agentes e administrar fila e disponibilidade.',
  },
  {
    key: 'pbx.configure',
    label: 'Configurar PABX',
    description: 'Alterar troncos, rotas, URA e configurações.',
  },
  {
    key: 'provisioning.manage',
    label: 'Provisionar telefones',
    description: 'Cadastrar aparelhos, templates e reprovisionamento remoto.',
  },
  {
    key: 'contacts.manage',
    label: 'Gerenciar contatos',
    description: 'Criar agenda corporativa, contatos pessoais e discagem rápida.',
  },
  {
    key: 'call-groups.manage',
    label: 'Gerenciar grupos de chamadas',
    description: 'Criar grupos de captura e grupos de toque.',
  },
  {
    key: 'queues.supervise',
    label: 'Supervisionar filas',
    description: 'Acompanhar agentes, SLA e chamadas em espera.',
  },
  {
    key: 'queues.manage',
    label: 'Gerenciar filas',
    description: 'Criar e alterar filas de atendimento.',
  },
  {
    key: 'reports.view',
    label: 'Ver relatórios',
    description: 'Consultar CDR e indicadores operacionais.',
  },
  {
    key: 'recordings.view',
    label: 'Ver gravações',
    description: 'Ouvir e consultar gravações de chamadas.',
  },
  {
    key: 'webphone.use',
    label: 'Usar Webphone',
    description: 'Realizar chamadas pelo navegador.',
  },
  {
    key: 'voicemail.use',
    label: 'Usar correio de voz',
    description: 'Consultar, ouvir e retornar mensagens de voz.',
  },
  {
    key: 'operator.use',
    label: 'Usar painel de operador',
    description: 'Monitorar presença, transferir e estacionar chamadas.',
  },
  {
    key: 'security.audit',
    label: 'Auditar segurança',
    description: 'Consultar logs, regras antifraude e bloqueios por IP.',
  },
  {
    key: 'callcenter.advanced',
    label: 'Central de atendimento avançada',
    description: 'Acompanhar wallboard, SLA, callbacks e supervisão de filas.',
  },
] as const;

export type PermissionKey = (typeof permissions)[number]['key'];

export const roleProfiles: Record<
  UserRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    color: string;
  }
> = {
  super_admin: {
    label: 'Super Admin',
    shortLabel: 'Super',
    description: 'Acesso total a tenants, segurança, usuários e PABX.',
    color: 'purple',
  },
  admin: {
    label: 'Admin',
    shortLabel: 'Admin',
    description: 'Administra o tenant e todas as configurações do PABX.',
    color: 'blue',
  },
  supervisor: {
    label: 'Supervisor',
    shortLabel: 'Supervisor',
    description: 'Administra agentes, filas, gravações e relatórios.',
    color: 'cyan',
  },
  agent: {
    label: 'Agente',
    shortLabel: 'Agente',
    description: 'Atende chamadas, usa Webphone e acompanha sua fila.',
    color: 'green',
  },
  user: {
    label: 'Usuário',
    shortLabel: 'Usuário',
    description: 'Acesso básico ao Webphone e painel pessoal.',
    color: 'default',
  },
};

export const roleOptions = userRoles.map((role) => ({
  label: roleProfiles[role].label,
  value: role,
}));

export const roleRouteAccess: Record<UserRole, RouteKey[]> = {
  super_admin: [...routeKeys],
  admin: routeKeys.filter((routeKey) => routeKey !== 'tenants'),
  supervisor: [
    'dashboard',
    'extensions',
    'contacts',
    'agents',
    'queues',
    'operator-panel',
    'call-center',
    'reports',
    'recordings',
    'chat',
    'webphone',
    'voicemail',
  ],
  agent: [
    'dashboard',
    'extensions',
    'contacts',
    'pickup-groups',
    'ring-groups',
    'queues',
    'chat',
    'webphone',
    'voicemail',
  ],
  user: ['dashboard', 'extensions', 'contacts', 'chat', 'webphone', 'voicemail'],
};

export const rolePermissions: Record<UserRole, PermissionKey[]> = {
  super_admin: permissions.map((permission) => permission.key),
  admin: [
    'users.manage',
    'agents.manage',
    'pbx.configure',
    'provisioning.manage',
    'contacts.manage',
    'call-groups.manage',
    'queues.supervise',
    'queues.manage',
    'reports.view',
    'recordings.view',
    'webphone.use',
    'voicemail.use',
    'operator.use',
    'security.audit',
    'callcenter.advanced',
  ],
  supervisor: [
    'agents.manage',
    'contacts.manage',
    'queues.supervise',
    'queues.manage',
    'reports.view',
    'recordings.view',
    'webphone.use',
    'voicemail.use',
    'operator.use',
    'callcenter.advanced',
  ],
  agent: ['contacts.manage', 'webphone.use', 'voicemail.use'],
  user: ['contacts.manage', 'webphone.use', 'voicemail.use'],
};

export function isUserRole(value: string | null): value is UserRole {
  return userRoles.includes(value as UserRole);
}

export function canRoleAccessRoute(role: UserRole, routeKey: string) {
  return roleRouteAccess[role].includes(routeKey as RouteKey);
}

export function roleHasPermission(role: UserRole, permissionKey: PermissionKey) {
  return rolePermissions[role].includes(permissionKey);
}
