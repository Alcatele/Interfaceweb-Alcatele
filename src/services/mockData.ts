export type Extension = {
  id: string;
  tenantId: string;
  number: string;
  name: string;
  department: string;
  device: string;
  status: 'online' | 'offline' | 'warning';
  ip: string;
  lastSeen: string;
};

export type SipTrunk = {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  host: string;
  channels: number;
  status: 'registered' | 'failed' | 'warning';
  latency: number;
};

export type OutboundRoute = {
  id: string;
  name: string;
  pattern: string;
  trunk: string;
  priority: number;
  enabled: boolean;
};

export type InboundRoute = {
  id: string;
  did: string;
  description: string;
  destination: string;
  schedule: string;
  enabled: boolean;
};

export type CallCalendarHoliday = {
  id: string;
  date: string;
  name: string;
  destination: string;
};

export type CallCalendar = {
  id: string;
  name: string;
  timezone: string;
  businessHours: string;
  businessDestination: string;
  afterHoursDestination: string;
  holidayDestination: string;
  holidays: CallCalendarHoliday[];
  enabled: boolean;
};

export type IvrMenu = {
  id: string;
  name: string;
  greeting: string;
  timeout: number;
  options: Array<{ digit: string; destination: string }>;
  enabled: boolean;
};

export type Queue = {
  id: string;
  tenantId: string;
  name: string;
  number: string;
  agents: number;
  waiting: number;
  strategy: string;
  sla: number;
  welcomeMessage: string;
  maxWaiting: number;
  overflowAfter: number;
  overflowDestination: string;
};

export type PickupGroup = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  members: string[];
  enabled: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
};

export type RingGroup = {
  id: string;
  tenantId: string;
  name: string;
  number: string;
  strategy: 'simultaneous' | 'sequential' | 'random';
  timeout: number;
  members: string[];
  fallback: string;
  enabled: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
};

export type CallRecord = {
  id: string;
  tenantId: string;
  startedAt: string;
  caller: string;
  callee: string;
  direction: 'Entrada' | 'Saída' | 'Interna';
  duration: string;
  disposition: 'Atendida' | 'Perdida' | 'Ocupado' | 'Falhou';
};

export type ProvisionedPhone = {
  id: string;
  tenantId: string;
  mac: string;
  model: string;
  vendor: string;
  extension: string;
  template: string;
  firmware: string;
  status: 'provisioned' | 'pending' | 'failed';
  lastProvisioning: string;
};

export type DirectoryContact = {
  id: string;
  tenantId: string;
  name: string;
  company: string;
  phone: string;
  mobile: string;
  email: string;
  type: 'Corporativo' | 'Cliente' | 'Fornecedor' | 'Pessoal';
  favorite: boolean;
};

export type ActiveCall = {
  id: string;
  tenantId: string;
  caller: string;
  callee: string;
  status: 'Tocando' | 'Em atendimento' | 'Em espera' | 'Estacionada';
  queue: string;
  duration: string;
  recording: boolean;
};

export type AuditEvent = {
  id: string;
  tenantId: string;
  date: string;
  user: string;
  action: string;
  module: string;
  ip: string;
  severity: 'info' | 'warning' | 'critical';
};

export type SecurityRule = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: 'ok' | 'attention';
};

export type CallCenterMetric = {
  id: string;
  queue: string;
  waiting: number;
  longestWait: string;
  answered: number;
  abandoned: number;
  callbackRequests: number;
  serviceLevel: number;
  avgTalkTime: string;
  avgWrapUp: string;
};

export const extensions: Extension[] = [
  {
    id: 'ext-1001',
    tenantId: 'tenant-alcatele',
    number: '1001',
    name: 'Ana Pereira',
    department: 'Comercial',
    device: 'Yealink T54W',
    status: 'online',
    ip: '10.24.1.38',
    lastSeen: 'Agora',
  },
  {
    id: 'ext-1002',
    tenantId: 'tenant-alcatele',
    number: '1002',
    name: 'Bruno Martins',
    department: 'Suporte',
    device: 'Webphone',
    status: 'online',
    ip: '10.24.1.42',
    lastSeen: 'Agora',
  },
  {
    id: 'ext-1003',
    tenantId: 'tenant-alcatele',
    number: '1003',
    name: 'Carla Souza',
    department: 'Financeiro',
    device: 'Fanvil X4U',
    status: 'offline',
    ip: '-',
    lastSeen: '12 min atras',
  },
  {
    id: 'ext-1004',
    tenantId: 'tenant-demo',
    number: '1004',
    name: 'Diego Lima',
    department: 'Operações',
    device: 'Softphone SIP',
    status: 'warning',
    ip: '10.24.1.51',
    lastSeen: '2 min atras',
  },
];

export const sipTrunks: SipTrunk[] = [
  {
    id: 'trk-1',
    tenantId: 'tenant-alcatele',
    name: 'Vivo Corporativo',
    provider: 'Vivo',
    host: 'sip.vivo.net.br',
    channels: 30,
    status: 'registered',
    latency: 36,
  },
  {
    id: 'trk-2',
    tenantId: 'tenant-alcatele',
    name: 'Embratel SIP',
    provider: 'Claro/Embratel',
    host: 'trunk.embratel.net',
    channels: 15,
    status: 'registered',
    latency: 44,
  },
  {
    id: 'trk-3',
    tenantId: 'tenant-demo',
    name: 'Backup DID',
    provider: 'Operadora Backup',
    host: 'backup.voip.local',
    channels: 10,
    status: 'warning',
    latency: 128,
  },
];

export const outboundRoutes: OutboundRoute[] = [
  {
    id: 'out-1',
    name: 'Local e movel',
    pattern: '0[1-9]XXXXXXXX',
    trunk: 'Vivo Corporativo',
    priority: 1,
    enabled: true,
  },
  {
    id: 'out-2',
    name: 'DDD nacional',
    pattern: '0XX[1-9]XXXXXXXX',
    trunk: 'Embratel SIP',
    priority: 2,
    enabled: true,
  },
  {
    id: 'out-3',
    name: 'Internacional',
    pattern: '00.',
    trunk: 'Vivo Corporativo',
    priority: 3,
    enabled: false,
  },
];

export const inboundRoutes: InboundRoute[] = [
  {
    id: 'in-1',
    did: '+55 11 4002-1020',
    description: 'Numero principal',
    destination: 'URA Atendimento',
    schedule: 'Comercial',
    enabled: true,
  },
  {
    id: 'in-2',
    did: '+55 11 4002-1021',
    description: 'Suporte tecnico',
    destination: 'Fila Suporte',
    schedule: '24x7',
    enabled: true,
  },
  {
    id: 'in-3',
    did: '+55 11 4002-1022',
    description: 'Financeiro',
    destination: 'Ramal 1003',
    schedule: 'Comercial',
    enabled: false,
  },
];

export const callCalendars: CallCalendar[] = [
  {
    id: 'cal-1',
    name: 'Horario Comercial',
    timezone: 'America/Sao_Paulo',
    businessHours: 'Seg-Sex 08:00-18:00',
    businessDestination: 'URA Atendimento',
    afterHoursDestination: 'Correio de voz geral',
    holidayDestination: 'Mensagem de feriado',
    holidays: [
      {
        id: 'holiday-1',
        date: '2026-01-01',
        name: 'Confraternização Universal',
        destination: 'Mensagem de feriado',
      },
      {
        id: 'holiday-2',
        date: '2026-12-25',
        name: 'Natal',
        destination: 'Plantao tecnico',
      },
    ],
    enabled: true,
  },
  {
    id: 'cal-2',
    name: 'Suporte 24x7',
    timezone: 'America/Sao_Paulo',
    businessHours: 'Todos os dias 00:00-23:59',
    businessDestination: 'Fila Suporte',
    afterHoursDestination: 'Fila Suporte',
    holidayDestination: 'Fila Suporte',
    holidays: [],
    enabled: true,
  },
];

export const ivrMenus: IvrMenu[] = [
  {
    id: 'ivr-1',
    name: 'URA Atendimento',
    greeting: 'bem-vindo-alcatele.wav',
    timeout: 8,
    options: [
      { digit: '1', destination: 'Comercial' },
      { digit: '2', destination: 'Suporte' },
      { digit: '3', destination: 'Financeiro' },
    ],
    enabled: true,
  },
  {
    id: 'ivr-2',
    name: 'URA Pos-venda',
    greeting: 'pos-venda.wav',
    timeout: 6,
    options: [
      { digit: '1', destination: 'Fila Suporte' },
      { digit: '2', destination: 'Ramal 1004' },
    ],
    enabled: true,
  },
];

export const queues: Queue[] = [
  {
    id: 'queue-1',
    tenantId: 'tenant-alcatele',
    name: 'Comercial',
    number: '6001',
    agents: 6,
    waiting: 2,
    strategy: 'Tocar todos',
    sla: 92,
    welcomeMessage: 'Aguarde. Sua ligação será atendida em instantes.',
    maxWaiting: 20,
    overflowAfter: 120,
    overflowDestination: 'URA Atendimento',
  },
  {
    id: 'queue-2',
    tenantId: 'tenant-alcatele',
    name: 'Suporte',
    number: '6002',
    agents: 8,
    waiting: 5,
    strategy: 'Menor uso',
    sla: 86,
    welcomeMessage: 'Bem-vindo ao suporte. Aguarde um de nossos agentes.',
    maxWaiting: 30,
    overflowAfter: 180,
    overflowDestination: 'Correio de voz 1002',
  },
  {
    id: 'queue-3',
    tenantId: 'tenant-demo',
    name: 'Financeiro',
    number: '6003',
    agents: 3,
    waiting: 0,
    strategy: 'Round robin',
    sla: 97,
    welcomeMessage: 'Aguarde para falar com o Financeiro.',
    maxWaiting: 10,
    overflowAfter: 90,
    overflowDestination: 'Ramal 1003',
  },
];

export const pickupGroups: PickupGroup[] = [
  {
    id: 'pickup-1',
    tenantId: 'tenant-alcatele',
    name: 'Comercial',
    code: '*81',
    members: ['1001', '1004'],
    enabled: true,
  },
  {
    id: 'pickup-2',
    tenantId: 'tenant-demo',
    name: 'Suporte',
    code: '*82',
    members: ['1002', '1003'],
    enabled: true,
  },
];

export const ringGroups: RingGroup[] = [
  {
    id: 'ring-1',
    tenantId: 'tenant-alcatele',
    name: 'Recepcao geral',
    number: '7001',
    strategy: 'simultaneous',
    timeout: 25,
    members: ['1001', '1002', '1003'],
    fallback: 'URA Atendimento',
    enabled: true,
  },
  {
    id: 'ring-2',
    tenantId: 'tenant-demo',
    name: 'Plantao tecnico',
    number: '7002',
    strategy: 'sequential',
    timeout: 20,
    members: ['1002', '1004'],
    fallback: 'Correio de voz 1002',
    enabled: true,
  },
];

export const callRecords: CallRecord[] = [
  {
    id: 'cdr-1',
    tenantId: 'tenant-alcatele',
    startedAt: '06/06/2026 09:14',
    caller: '+55 11 98888-1212',
    callee: '1001',
    direction: 'Entrada',
    duration: '00:03:42',
    disposition: 'Atendida',
  },
  {
    id: 'cdr-2',
    tenantId: 'tenant-alcatele',
    startedAt: '06/06/2026 09:27',
    caller: '1002',
    callee: '+55 21 4004-9090',
    direction: 'Saída',
    duration: '00:01:18',
    disposition: 'Atendida',
  },
  {
    id: 'cdr-3',
    tenantId: 'tenant-demo',
    startedAt: '06/06/2026 09:33',
    caller: '+55 31 97777-2323',
    callee: 'Fila Suporte',
    direction: 'Entrada',
    duration: '00:00:00',
    disposition: 'Perdida',
  },
  {
    id: 'cdr-4',
    tenantId: 'tenant-alcatele',
    startedAt: '06/06/2026 10:05',
    caller: '1004',
    callee: '1001',
    direction: 'Interna',
    duration: '00:07:11',
    disposition: 'Atendida',
  },
];

export const provisionedPhones: ProvisionedPhone[] = [
  {
    id: 'phone-1',
    tenantId: 'tenant-alcatele',
    mac: '80:5E:C0:11:42:9A',
    model: 'Yealink T54W',
    vendor: 'Yealink',
    extension: '1001',
    template: 'Comercial BLF',
    firmware: '96.86.0.70',
    status: 'provisioned',
    lastProvisioning: 'Hoje, 08:12',
  },
  {
    id: 'phone-2',
    tenantId: 'tenant-alcatele',
    mac: '00:15:65:7A:88:21',
    model: 'Fanvil X4U',
    vendor: 'Fanvil',
    extension: '1003',
    template: 'Financeiro',
    firmware: '2.12.17',
    status: 'pending',
    lastProvisioning: 'Aguardando primeiro boot',
  },
  {
    id: 'phone-3',
    tenantId: 'tenant-demo',
    mac: '7C:2F:80:AA:10:2D',
    model: 'Intelbras TIP 635G',
    vendor: 'Intelbras',
    extension: '1004',
    template: 'Operações',
    firmware: '1.4.8',
    status: 'failed',
    lastProvisioning: 'Ontem, 16:44',
  },
];

export const directoryContacts: DirectoryContact[] = [
  {
    id: 'contact-1',
    tenantId: 'tenant-alcatele',
    name: 'Patricia Alves',
    company: 'Norte Distribuidora',
    phone: '+55 11 4002-2200',
    mobile: '+55 11 98888-2200',
    email: 'patricia@norte.example',
    type: 'Cliente',
    favorite: true,
  },
  {
    id: 'contact-2',
    tenantId: 'tenant-alcatele',
    name: 'Operadora Vivo NOC',
    company: 'Vivo',
    phone: '+55 11 10315',
    mobile: '-',
    email: 'noc@vivo.example',
    type: 'Fornecedor',
    favorite: false,
  },
  {
    id: 'contact-3',
    tenantId: 'tenant-demo',
    name: 'Recepção Matriz',
    company: 'Empresa Demonstração',
    phone: '7001',
    mobile: '-',
    email: 'recepcao@demo.example',
    type: 'Corporativo',
    favorite: true,
  },
];

export const activeCalls: ActiveCall[] = [
  {
    id: 'call-1',
    tenantId: 'tenant-alcatele',
    caller: '+55 11 98888-1212',
    callee: '1001 - Ana Pereira',
    status: 'Em atendimento',
    queue: 'Comercial',
    duration: '00:04:12',
    recording: true,
  },
  {
    id: 'call-2',
    tenantId: 'tenant-alcatele',
    caller: '+55 31 97777-2323',
    callee: 'Fila Suporte',
    status: 'Tocando',
    queue: 'Suporte',
    duration: '00:00:31',
    recording: false,
  },
  {
    id: 'call-3',
    tenantId: 'tenant-demo',
    caller: '1004 - Diego Lima',
    callee: '1002 - Bruno Martins',
    status: 'Em espera',
    queue: 'Interna',
    duration: '00:02:08',
    recording: false,
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: 'audit-1',
    tenantId: 'tenant-alcatele',
    date: '07/06/2026 09:18',
    user: 'admin',
    action: 'Alterou rota de entrada +55 11 4002-1020',
    module: 'Rotas de entrada',
    ip: '10.24.1.10',
    severity: 'info',
  },
  {
    id: 'audit-2',
    tenantId: 'tenant-alcatele',
    date: '07/06/2026 08:44',
    user: 'superadmin',
    action: 'Desabilitou chamadas internacionais para tenant Demo',
    module: 'Segurança',
    ip: '10.24.1.8',
    severity: 'warning',
  },
  {
    id: 'audit-3',
    tenantId: 'tenant-demo',
    date: '06/06/2026 21:03',
    user: 'sistema',
    action: 'Bloqueio de IP por tentativas SIP inválidas',
    module: 'Antifraude',
    ip: '203.0.113.44',
    severity: 'critical',
  },
];

export const securityRules: SecurityRule[] = [
  {
    id: 'sec-1',
    name: 'MFA para administradores',
    description: 'Exige segundo fator para Super Admin e Admin.',
    enabled: true,
    status: 'ok',
  },
  {
    id: 'sec-2',
    name: 'Bloqueio de chamadas internacionais',
    description: 'Exige liberação por perfil ou PIN para chamadas 00.',
    enabled: true,
    status: 'ok',
  },
  {
    id: 'sec-3',
    name: 'TLS/SRTP nos ramais',
    description: 'Criptografia obrigatória para ramais remotos.',
    enabled: false,
    status: 'attention',
  },
  {
    id: 'sec-4',
    name: 'Proteção contra força bruta SIP',
    description: 'Bloqueia IPs com múltiplas falhas de autenticação.',
    enabled: true,
    status: 'ok',
  },
];

export const callCenterMetrics: CallCenterMetric[] = [
  {
    id: 'cc-1',
    queue: 'Comercial',
    waiting: 2,
    longestWait: '00:01:42',
    answered: 86,
    abandoned: 4,
    callbackRequests: 3,
    serviceLevel: 92,
    avgTalkTime: '00:03:28',
    avgWrapUp: '00:00:32',
  },
  {
    id: 'cc-2',
    queue: 'Suporte',
    waiting: 5,
    longestWait: '00:04:18',
    answered: 104,
    abandoned: 9,
    callbackRequests: 8,
    serviceLevel: 86,
    avgTalkTime: '00:06:12',
    avgWrapUp: '00:01:05',
  },
  {
    id: 'cc-3',
    queue: 'Financeiro',
    waiting: 0,
    longestWait: '00:00:00',
    answered: 31,
    abandoned: 1,
    callbackRequests: 0,
    serviceLevel: 97,
    avgTalkTime: '00:02:51',
    avgWrapUp: '00:00:24',
  },
];

export const dashboardSeries = {
  callsByHour: [
    { hour: '08h', answered: 22, missed: 3 },
    { hour: '09h', answered: 34, missed: 5 },
    { hour: '10h', answered: 41, missed: 4 },
    { hour: '11h', answered: 29, missed: 6 },
    { hour: '12h', answered: 18, missed: 2 },
    { hour: '13h', answered: 24, missed: 3 },
    { hour: '14h', answered: 38, missed: 7 },
    { hour: '15h', answered: 45, missed: 5 },
  ],
  trunkUsage: [68, 52, 21],
  queueSla: queues.map((queue) => queue.sla),
};

