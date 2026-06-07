export type ChatConversation = {
  id: string;
  title: string;
  type: 'channel' | 'direct';
  memberIds: string[];
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
};

const messagesStorageKey = 'pabx-cloud-chat-messages';
const conversationsStorageKey = 'pabx-cloud-chat-conversations';

const defaultConversations: ChatConversation[] = [
  {
    id: 'channel-geral',
    title: 'Geral',
    type: 'channel',
    memberIds: [],
  },
  {
    id: 'channel-suporte',
    title: 'Equipe Suporte',
    type: 'channel',
    memberIds: ['usr-supervisor', 'usr-agent'],
  },
  {
    id: 'direct-admin',
    title: 'Administrador',
    type: 'direct',
    memberIds: ['usr-super-admin', 'usr-admin'],
  },
];

function saveConversations(conversations: ChatConversation[]) {
  window.localStorage.setItem(
    conversationsStorageKey,
    JSON.stringify(conversations),
  );
}

export function listChatConversations() {
  const stored = window.localStorage.getItem(conversationsStorageKey);

  if (!stored) {
    return defaultConversations;
  }

  try {
    const conversations = JSON.parse(stored) as ChatConversation[];
    return Array.isArray(conversations) ? conversations : defaultConversations;
  } catch {
    return defaultConversations;
  }
}

export function createChatConversation(
  title: string,
  creatorId: string,
  memberIds: string[],
) {
  const conversations = listChatConversations();
  const uniqueMemberIds = Array.from(new Set([creatorId, ...memberIds]));
  const conversation: ChatConversation = {
    id:
      typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `conversation-${Date.now()}`,
    title: title.trim(),
    type: 'direct',
    memberIds: uniqueMemberIds,
  };

  saveConversations([...conversations, conversation]);
  return conversation;
}

const defaultMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    conversationId: 'channel-geral',
    senderId: 'usr-supervisor',
    senderName: 'Marina Costa',
    text: 'Bom dia. O atendimento está operando normalmente.',
    sentAt: '08:32',
  },
  {
    id: 'msg-2',
    conversationId: 'channel-suporte',
    senderId: 'usr-agent',
    senderName: 'Bruno Martins',
    text: 'Fila Suporte revisada. Estou disponível.',
    sentAt: '09:18',
  },
  {
    id: 'msg-3',
    conversationId: 'direct-admin',
    senderId: 'usr-admin',
    senderName: 'Administrador',
    text: 'As rotas foram atualizadas para o horário comercial.',
    sentAt: '09:41',
  },
];

export function listChatMessages() {
  const stored = window.localStorage.getItem(messagesStorageKey);

  if (!stored) {
    return defaultMessages;
  }

  try {
    const messages = JSON.parse(stored) as ChatMessage[];
    return Array.isArray(messages) ? messages : defaultMessages;
  } catch {
    return defaultMessages;
  }
}

export function sendChatMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string,
) {
  const messages = listChatMessages();
  const message: ChatMessage = {
    id:
      typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `msg-${Date.now()}`,
    conversationId,
    senderId,
    senderName,
    text: text.trim(),
    sentAt: new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
  };

  window.localStorage.setItem(
    messagesStorageKey,
    JSON.stringify([...messages, message]),
  );
  return message;
}
