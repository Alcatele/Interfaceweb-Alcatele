import type { UserRole } from './accessControl';

export type AgentPauseReason =
  | 'quick_break'
  | 'lunch'
  | 'training'
  | 'backoffice'
  | 'personal';

export const agentPauseOptions: Array<{
  label: string;
  value: AgentPauseReason;
}> = [
  { label: 'Pausa rapida', value: 'quick_break' },
  { label: 'Almoco', value: 'lunch' },
  { label: 'Treinamento', value: 'training' },
  { label: 'Backoffice', value: 'backoffice' },
  { label: 'Pessoal', value: 'personal' },
];

export type MockUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  extension: string;
  status: 'active' | 'inactive';
  lastAccess: string;
  passwordHash: string;
  workQueueId?: string;
  agentStatus?: 'available' | 'paused';
  pauseReason?: AgentPauseReason;
};

export type PublicUser = Omit<MockUser, 'passwordHash'>;

export type DemoAccount = {
  role: UserRole;
  username: string;
  password: string;
};

export type CreateMockUserInput = {
  name: string;
  username: string;
  email: string;
  role: UserRole;
  extension: string;
  password: string;
  workQueueId?: string;
};

export type UserOperationResult = {
  success: boolean;
  error?: string;
};

const usersStorageKey = 'pabx-cloud-users';

const defaultUsers: MockUser[] = [
  {
    id: 'usr-super-admin',
    name: 'Super Admin',
    username: 'superadmin',
    email: 'superadmin@alcatele.cloud',
    role: 'super_admin',
    extension: '1000',
    status: 'active',
    lastAccess: 'Primeiro acesso',
    passwordHash:
      'afbabbdc45b1eb528a3099c4ef03099146728c61cd13ff4da3bf1139d3f9ed91',
  },
  {
    id: 'usr-admin',
    name: 'Administrador',
    username: 'admin',
    email: 'admin@alcatele.cloud',
    role: 'admin',
    extension: '1001',
    status: 'active',
    lastAccess: 'Hoje, 09:42',
    passwordHash:
      'a36aef5a11c4073fbe60314fc9df530a9d5f986533594d1f5190742ff9e0e408',
  },
  {
    id: 'usr-supervisor',
    name: 'Marina Costa',
    username: 'supervisor',
    email: 'supervisor@alcatele.cloud',
    role: 'supervisor',
    extension: '1005',
    status: 'active',
    lastAccess: 'Hoje, 08:55',
    passwordHash:
      '73a0df17d5eae70d1e53d5e73f83657081034552a4ec80cb9d672bfc4e18c148',
  },
  {
    id: 'usr-agent',
    name: 'Bruno Martins',
    username: 'agente',
    email: 'agente@alcatele.cloud',
    role: 'agent',
    extension: '1002',
    status: 'active',
    lastAccess: 'Hoje, 09:18',
    workQueueId: 'queue-2',
    agentStatus: 'available',
    passwordHash:
      '1d3c8493583186603ecda76f41e45846d42189c4b1b3773c63d1e754571f34d3',
  },
  {
    id: 'usr-user',
    name: 'Carla Souza',
    username: 'usuario',
    email: 'usuario@alcatele.cloud',
    role: 'user',
    extension: '1003',
    status: 'active',
    lastAccess: 'Ontem, 17:31',
    passwordHash:
      'e4752fc4d42480dc6fc3b87f4cc426f84571ad647b380c52e7f785a3e7cdc220',
  },
];

export const demoAccounts: DemoAccount[] = [
  { role: 'super_admin', username: 'superadmin', password: 'Cloud@2026' },
  { role: 'admin', username: 'admin', password: 'Admin@2026' },
  {
    role: 'supervisor',
    username: 'supervisor',
    password: 'Supervisor@2026',
  },
  { role: 'agent', username: 'agente', password: 'Agente@2026' },
  { role: 'user', username: 'usuario', password: 'Usuario@2026' },
];

function saveUsers(users: MockUser[]) {
  window.localStorage.setItem(usersStorageKey, JSON.stringify(users));
}

function toPublicUser(user: MockUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    extension: user.extension,
    status: user.status,
    lastAccess: user.lastAccess,
    workQueueId: user.workQueueId,
    agentStatus: user.agentStatus,
    pauseReason: user.pauseReason,
  };
}

export function getMockUsers(): MockUser[] {
  const stored = window.localStorage.getItem(usersStorageKey);

  if (!stored) {
    return defaultUsers;
  }

  try {
    const users = JSON.parse(stored) as MockUser[];
    return Array.isArray(users) ? users : defaultUsers;
  } catch {
    return defaultUsers;
  }
}

export function listPublicUsers(): PublicUser[] {
  return getMockUsers().map(toPublicUser);
}

export function getPublicUserById(userId: string): PublicUser | null {
  const user = getMockUsers().find((item) => item.id === userId);
  return user ? toPublicUser(user) : null;
}

export async function hashPassword(password: string) {
  const data = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function authenticateMockUser(
  identifier: string,
  password: string,
): Promise<PublicUser | null> {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const users = getMockUsers();
  const user = users.find(
    (item) =>
      item.status === 'active' &&
      (item.username.toLowerCase() === normalizedIdentifier ||
        item.email.toLowerCase() === normalizedIdentifier) &&
      item.passwordHash === passwordHash,
  );

  if (!user) {
    return null;
  }

  const updatedUser = {
    ...user,
    lastAccess: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date()),
  };

  saveUsers(users.map((item) => (item.id === user.id ? updatedUser : item)));

  return toPublicUser(updatedUser);
}

export async function updateMockUserPassword(
  userId: string,
  password: string,
) {
  const users = getMockUsers();
  const userExists = users.some((user) => user.id === userId);

  if (!userExists) {
    return false;
  }

  const passwordHash = await hashPassword(password);
  saveUsers(
    users.map((user) =>
      user.id === userId ? { ...user, passwordHash } : user,
    ),
  );

  return true;
}

export async function changeMockUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<UserOperationResult> {
  const users = getMockUsers();
  const user = users.find((item) => item.id === userId);

  if (!user) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  const currentPasswordHash = await hashPassword(currentPassword);

  if (user.passwordHash !== currentPasswordHash) {
    return { success: false, error: 'A senha atual está incorreta.' };
  }

  const newPasswordHash = await hashPassword(newPassword);
  saveUsers(
    users.map((item) =>
      item.id === userId ? { ...item, passwordHash: newPasswordHash } : item,
    ),
  );

  return { success: true };
}

export async function createMockUser(
  input: CreateMockUserInput,
): Promise<UserOperationResult> {
  const users = getMockUsers();
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();

  if (users.some((user) => user.username.toLowerCase() === username)) {
    return { success: false, error: 'Este nome de usuário já está em uso.' };
  }

  if (users.some((user) => user.email.toLowerCase() === email)) {
    return { success: false, error: 'Este e-mail já está em uso.' };
  }

  const passwordHash = await hashPassword(input.password);
  const id =
    typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `usr-${Date.now()}`;

  saveUsers([
    ...users,
    {
      id,
      name: input.name.trim(),
      username,
      email,
      role: input.role,
      extension: input.extension.trim(),
      status: 'active',
      lastAccess: 'Nunca acessou',
      workQueueId: input.workQueueId,
      agentStatus: input.role === 'agent' ? 'available' : undefined,
      pauseReason: undefined,
      passwordHash,
    },
  ]);

  return { success: true };
}

export function deleteMockUser(
  userId: string,
  currentUserId: string,
): UserOperationResult {
  const users = getMockUsers();
  const user = users.find((item) => item.id === userId);

  if (!user) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  if (userId === currentUserId) {
    return { success: false, error: 'Você não pode apagar sua própria conta.' };
  }

  if (
    user.role === 'super_admin' &&
    users.filter((item) => item.role === 'super_admin').length === 1
  ) {
    return {
      success: false,
      error: 'O sistema precisa manter pelo menos um Super Admin.',
    };
  }

  saveUsers(users.filter((item) => item.id !== userId));
  return { success: true };
}

export async function requestMockPasswordRecovery(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const userExists = getMockUsers().some(
    (user) =>
      user.email.toLowerCase() === normalizedIdentifier ||
      user.username.toLowerCase() === normalizedIdentifier,
  );

  await new Promise((resolve) => window.setTimeout(resolve, 500));
  return userExists;
}

export function updateMockAgentWorkState(
  userId: string,
  updates: {
    workQueueId?: string;
    agentStatus?: 'available' | 'paused';
    pauseReason?: AgentPauseReason;
  },
): PublicUser | null {
  const users = getMockUsers();
  const user = users.find((item) => item.id === userId);

  if (!user || user.role !== 'agent') {
    return null;
  }

  const updatedUser: MockUser = {
    ...user,
    ...updates,
  };

  saveUsers(
    users.map((item) => (item.id === userId ? updatedUser : item)),
  );

  return toPublicUser(updatedUser);
}

