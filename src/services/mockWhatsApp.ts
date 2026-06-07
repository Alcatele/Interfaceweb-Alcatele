// Mock data for WhatsApp integration
import { WhatsAppMessage, WhatsAppContact, WhatsAppQueueGroup } from './whatsapp';

export const whatsappContacts: WhatsAppContact[] = [
  {
    id: 'contact-1',
    phoneNumber: '+5511987654321',
    displayName: 'João Silva',
    lastMessageTime: '2026-06-07T15:30:00Z',
    status: 'active',
  },
  {
    id: 'contact-2',
    phoneNumber: '+5511912345678',
    displayName: 'Maria Santos',
    lastMessageTime: '2026-06-07T14:15:00Z',
    status: 'active',
  },
  {
    id: 'contact-3',
    phoneNumber: '+5511998765432',
    displayName: 'Carlos Costa',
    lastMessageTime: '2026-06-07T10:45:00Z',
    status: 'inactive',
  },
  {
    id: 'contact-4',
    phoneNumber: '+5521987654321',
    displayName: 'Ana Paula',
    lastMessageTime: '2026-06-07T09:20:00Z',
    status: 'active',
  },
  {
    id: 'contact-5',
    phoneNumber: '+5585912345678',
    displayName: 'Pedro Oliveira',
    lastMessageTime: '2026-06-06T16:50:00Z',
    status: 'inactive',
  },
];

export const whatsappMessages: WhatsAppMessage[] = [
  {
    id: 'msg-1',
    from: '+5511987654321',
    to: '+551133334444',
    body: 'Olá, tudo bem? Como posso ajudá-lo?',
    timestamp: '2026-06-07T14:15:00Z',
    status: 'delivered',
    type: 'text',
  },
  {
    id: 'msg-2',
    from: '+551133334444',
    to: '+5511987654321',
    body: 'Oi! Gostaria de saber mais sobre seus serviços.',
    timestamp: '2026-06-07T14:16:00Z',
    status: 'read',
    type: 'text',
  },
  {
    id: 'msg-3',
    from: '+5511987654321',
    to: '+551133334444',
    body: 'Claro! Temos várias opções disponíveis. Qual sua necessidade?',
    timestamp: '2026-06-07T14:17:00Z',
    status: 'delivered',
    type: 'text',
  },
  {
    id: 'msg-4',
    from: '+5511912345678',
    to: '+551133334444',
    body: 'Preciso de ajuda com uma fatura.',
    timestamp: '2026-06-07T13:45:00Z',
    status: 'read',
    type: 'text',
  },
  {
    id: 'msg-5',
    from: '+551133334444',
    to: '+5511912345678',
    body: 'Sem problema! Vou verificar sua conta.',
    timestamp: '2026-06-07T13:46:00Z',
    status: 'delivered',
    type: 'text',
  },
];

export const whatsappQueueGroups: WhatsAppQueueGroup[] = [
  {
    id: 'wa-group-1',
    name: 'Suporte Técnico',
    description: 'Atendimento de problemas técnicos',
    agents: ['agent-1', 'agent-2', 'agent-3'],
    isActive: true,
    createdAt: '2026-05-15T10:00:00Z',
    updatedAt: '2026-06-07T15:30:00Z',
  },
  {
    id: 'wa-group-2',
    name: 'Vendas',
    description: 'Informações sobre produtos e vendas',
    agents: ['agent-4', 'agent-5'],
    isActive: true,
    createdAt: '2026-05-20T14:00:00Z',
    updatedAt: '2026-06-07T16:00:00Z',
  },
  {
    id: 'wa-group-3',
    name: 'Suporte ao Cliente',
    description: 'Dúvidas gerais dos clientes',
    agents: ['agent-6', 'agent-7', 'agent-8'],
    isActive: true,
    createdAt: '2026-06-01T09:00:00Z',
    updatedAt: '2026-06-07T17:15:00Z',
  },
  {
    id: 'wa-group-4',
    name: 'Financeiro',
    description: 'Informações sobre pagamentos e faturas',
    agents: ['agent-9', 'agent-10'],
    isActive: true,
    createdAt: '2026-06-05T11:30:00Z',
    updatedAt: '2026-06-07T12:00:00Z',
  },
];

// WhatsApp hourly message statistics
export const whatsappMessageStats = {
  byHour: [
    { hour: '00:00', received: 5, sent: 3 },
    { hour: '04:00', received: 2, sent: 1 },
    { hour: '08:00', received: 45, sent: 42 },
    { hour: '12:00', received: 120, sent: 115 },
    { hour: '16:00', received: 180, sent: 175 },
    { hour: '20:00', received: 95, sent: 92 },
    { hour: '23:59', received: 12, sent: 10 },
  ],
  byQueueGroup: [
    { groupId: 'wa-group-1', name: 'Suporte Técnico', count: 450 },
    { groupId: 'wa-group-2', name: 'Vendas', count: 320 },
    { groupId: 'wa-group-3', name: 'Suporte ao Cliente', count: 620 },
    { groupId: 'wa-group-4', name: 'Financeiro', count: 280 },
  ],
};
