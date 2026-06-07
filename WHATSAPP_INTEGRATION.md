# WhatsApp Integration Guide

## Visão Geral

A integração do WhatsApp na Interface Web Alcatele permite gerenciar mensagens, contatos e grupos de atendimento através de uma interface centralizada. O sistema suporta tanto **WhatsApp Business API** quanto **Twilio**.

## Funcionalidades

### 1. **Gerenciamento de Grupos de Atendimento** (`/whatsapp`)
- Criar, editar e deletar grupos de atendimento
- Atribuir agentes a cada grupo
- Monitorar status de atividade
- Acompanhar SLA em tempo real
- Visualizar métricas detalhadas por grupo

### 2. **Mensagens e Contatos** (`/whatsapp-mensagens`)
- Listar contatos ativos
- Gerenciar conversas por contato
- Enviar e receber mensagens
- Adicionar novos contatos
- Buscar e filtrar conversas

### 3. **Relatórios e Métricas**
- Gráficos de mensagens por hora
- Distribuição de atendimentos por grupo
- Taxas de SLA
- Tempo médio de espera e resposta
- Exportação de relatórios em CSV

## Configuração da API

### WhatsApp Business API

```typescript
import { whatsappService } from './services/whatsapp';

// Inicializar com WhatsApp Business API
await whatsappService.initialize({
  provider: 'business-api',
  businessApiConfig: {
    phoneNumberId: 'sua-phone-number-id',
    accessToken: 'seu-access-token',
    apiVersion: 'v18.0',
  },
});
```

**Pré-requisitos:**
- Conta WhatsApp Business
- Aprovação do Facebook
- Número de telefone verificado
- Access Token válido

### Twilio

```typescript
import { whatsappService } from './services/whatsapp';

// Inicializar com Twilio
await whatsappService.initialize({
  provider: 'twilio',
  twilioConfig: {
    accountSid: 'seu-account-sid',
    authToken: 'seu-auth-token',
    fromNumber: '+5511999999999',
  },
});
```

**Pré-requisitos:**
- Conta Twilio
- Número Twilio com WhatsApp habilitado
- Account SID e Auth Token

## Estrutura de Arquivos

```
src/
├── services/
│   ├── whatsapp.ts           # Serviço principal de WhatsApp
│   └── mockWhatsApp.ts       # Dados mock para desenvolvimento
├── pages/
│   ├── WhatsAppIntegration.tsx    # Página de gerenciamento de grupos
│   └── WhatsAppMessaging.tsx      # Página de mensagens e contatos
├── components/
│   └── WhatsAppChat.tsx           # Componente de chat
└── routes/
    ├── AppRoutes.tsx         # Rotas da aplicação (atualizado)
    └── menuItems.tsx         # Menu de navegação (atualizado)
```

## API Principal

### WhatsAppService

#### Métodos Disponíveis

##### `initialize(config: WhatsAppProviderConfig)`
Inicializa o serviço com configuração do provider.

```typescript
await whatsappService.initialize(config);
```

##### `sendMessage(to: string, body: string, mediaUrl?: string)`
Envia uma mensagem para um contato.

```typescript
const message = await whatsappService.sendMessage(
  '+5511987654321',
  'Olá! Como posso ajudá-lo?'
);
```

##### `getConversation(phoneNumber: string, limit?: number)`
Recupera o histórico de conversa com um contato.

```typescript
const messages = await whatsappService.getConversation(
  '+5511987654321',
  50
);
```

##### `getContacts()`
Lista todos os contatos ativos.

```typescript
const contacts = await whatsappService.getContacts();
```

##### `createQueueGroup(group: Omit<WhatsAppQueueGroup, ...>)`
Cria um novo grupo de atendimento.

```typescript
const group = await whatsappService.createQueueGroup({
  name: 'Suporte Técnico',
  description: 'Atendimento de problemas técnicos',
  agents: ['agent-1', 'agent-2'],
  isActive: true,
});
```

##### `getQueueGroups()`
Lista todos os grupos de atendimento.

```typescript
const groups = await whatsappService.getQueueGroups();
```

##### `updateQueueGroup(groupId: string, updates: Partial<WhatsAppQueueGroup>)`
Atualiza um grupo existente.

```typescript
await whatsappService.updateQueueGroup('wa-group-1', {
  name: 'Novo Nome',
  agents: ['agent-1', 'agent-2', 'agent-3'],
});
```

##### `assignToQueueGroup(contactId: string, queueGroupId: string)`
Atribui um contato a um grupo de atendimento.

```typescript
await whatsappService.assignToQueueGroup('contact-1', 'wa-group-1');
```

##### `getReports(startDate: string, endDate: string, groupId?: string)`
Gera relatórios com métricas de mensagens.

```typescript
const report = await whatsappService.getReports(
  '2026-06-01',
  '2026-06-07',
  'wa-group-1'
);
```

##### `getQueueMetrics(groupId: string)`
Obtém métricas em tempo real de um grupo.

```typescript
const metrics = await whatsappService.getQueueMetrics('wa-group-1');
```

## Tipos de Dados

### WhatsAppMessage
```typescript
interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'image' | 'video' | 'document' | 'audio';
  mediaUrl?: string;
}
```

### WhatsAppContact
```typescript
interface WhatsAppContact {
  id: string;
  phoneNumber: string;
  displayName: string;
  profilePicture?: string;
  lastMessageTime?: string;
  status: 'active' | 'inactive';
}
```

### WhatsAppQueueGroup
```typescript
interface WhatsAppQueueGroup {
  id: string;
  name: string;
  description: string;
  agents: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### WhatsAppQueueMetrics
```typescript
interface WhatsAppQueueMetrics {
  queueGroupId: string;
  queueGroupName: string;
  activeChats: number;
  waitingChats: number;
  averageWaitTime: number;
  averageResponseTime: number;
  totalMessagesHandled: number;
  agentsOnline: number;
  agentsOnBreak: number;
  slaPercentage: number;
}
```

### WhatsAppReports
```typescript
interface WhatsAppReports {
  totalMessages: number;
  totalConversations: number;
  averageResponseTime: number;
  messagesByHour: Array<{ hour: string; count: number }>;
  messagesByQueueGroup: Array<{
    groupId: string;
    groupName: string;
    count: number;
    averageResponseTime: number;
  }>;
  topContacts: WhatsAppContact[];
  slaMetrics: {
    totalMessages: number;
    withinSla: number;
    slaPercentage: number;
  };
}
```

## Permissões de Acesso

A integração usa o sistema de controle de acesso existente. Para acessar os recursos do WhatsApp, o usuário precisa da permissão `whatsapp`.

```typescript
// Em accessControl.ts
const accessMatrix = {
  'whatsapp': {
    admin: true,
    manager: true,
    agent: true,
    viewer: false,
  },
};
```

## Desenvolvimento Local

Para testar a integração localmente:

1. **Mock Data é ativado por padrão**
```typescript
// Os dados em mockWhatsApp.ts são usados automaticamente
```

2. **Substituir pelos dados reais quando necessário**
```typescript
// Em WhatsAppIntegration.tsx, substitua:
// const groups = mockQueueGroups;
// por:
// const groups = await whatsappService.getQueueGroups();
```

## Rotas Disponíveis

| Rota | Página | Descrição |
|------|--------|-----------|
| `/whatsapp` | WhatsAppIntegration | Gerenciamento de grupos e relatórios |
| `/whatsapp-mensagens` | WhatsAppMessaging | Gerenciamento de contatos e conversas |

## Próximos Passos

1. **Implementar Webhooks**
   - Configurar webhooks para receber mensagens em tempo real
   - Atualizar status de mensagens

2. **Notificações em Tempo Real**
   - Integrar WebSocket para notificações de novas mensagens
   - Suporte a push notifications

3. **Inteligência Artificial**
   - Chatbots automatizados
   - Análise de sentimento
   - Roteamento inteligente de mensagens

4. **Analíticos Avançados**
   - Heatmaps de utilização
   - Predição de picos de demanda
   - Análise de satisfação de clientes

## Troubleshooting

### Erro: "Failed to initialize WhatsApp"
- Verifique as credenciais no arquivo de configuração
- Confirme que o provider (Business API ou Twilio) está ativo
- Teste a conexão com a API externa

### Mensagens não sendo entregues
- Verifique se o número está no formato internacional (+55...)
- Confirme que o contato foi adicionado corretamente
- Verifique os logs do servidor para mais detalhes

### SLA não calculado
- Certifique-se de que as timestamps estão corretas (ISO 8601)
- Verifique se há suficientes dados de atendimento
- Valide os períodos de tempo selecionados

## Suporte

Para dúvidas ou issues relacionadas à integração do WhatsApp:
1. Consulte a documentação oficial do provider (WhatsApp Business API ou Twilio)
2. Verifique os logs da aplicação
3. Entre em contato com o time de desenvolvimento Alcatele

---

**Última atualização:** Junho de 2026  
**Versão:** 1.0.0
