import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  roleProfiles,
  type RouteKey,
  type UserRole,
} from '../services/accessControl';
import { getAccessSettings, saveAccessSettings } from '../services/accessSettings';
import { mvpApi, type SessionData } from '../services/mvpApi';
import type { PublicUser } from '../services/mockUsers';
import {
  AuthContext,
  type AuthContextValue,
  type LoginCredentials,
} from './authContextCore';

const mvpRoutes: Record<UserRole, RouteKey[]> = {
  super_admin: [
    'tenants',
    'dashboard',
    'extensions',
    'sip-trunks',
    'outbound-routes',
    'inbound-routes',
    'pickup-groups',
    'ring-groups',
    'voicemail',
    'webphone',
    'settings',
  ],
  admin: [
    'dashboard',
    'extensions',
    'sip-trunks',
    'outbound-routes',
    'inbound-routes',
    'pickup-groups',
    'ring-groups',
    'voicemail',
    'webphone',
    'settings',
  ],
  supervisor: [
    'dashboard',
    'extensions',
    'pickup-groups',
    'ring-groups',
    'voicemail',
    'webphone',
  ],
  agent: ['dashboard', 'extensions', 'webphone'],
  user: ['dashboard', 'extensions', 'webphone'],
};

function normalizeRole(role: string): UserRole {
  return ['super_admin', 'admin', 'supervisor', 'agent', 'user'].includes(role)
    ? (role as UserRole)
    : 'user';
}

function toPublicUser(session: SessionData): PublicUser {
  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    email: session.user.email,
    role: normalizeRole(session.role),
    extension: '',
    status: 'active',
    lastAccess: 'Sessão atual',
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessSettings, setAccessSettings] = useState(getAccessSettings);
  const role = normalizeRole(session?.role ?? 'user');

  const refreshSession = useCallback(async () => {
    try {
      setSession(await mvpApi.me());
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async ({ identifier, password, remember }: LoginCredentials) => {
      try {
        await mvpApi.login(identifier, password, remember);
        await refreshSession();
        return { success: true };
      } catch {
        return {
          success: false,
          error: 'Usuário, e-mail ou senha inválidos.',
        };
      }
    },
    [refreshSession],
  );

  const logout = useCallback(() => {
    void mvpApi.logout().finally(() => setSession(null));
  }, []);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      setIsLoading(true);
      await mvpApi.switchTenant(tenantId);
      await refreshSession();
    },
    [refreshSession],
  );

  const currentUser = session ? toPublicUser(session) : null;
  const allowedRoutes = mvpRoutes[role];

  const value = useMemo<AuthContextValue>(
    () => ({
      activeTenant: session?.tenant ?? null,
      adminCanViewRecordings: accessSettings.adminCanViewRecordings,
      allowedRoutes,
      availableTenants: session?.availableTenants ?? [],
      canAccessRoute: (routeKey) =>
        allowedRoutes.includes(routeKey as RouteKey),
      currentUser,
      hasPermission: (permissionKey) =>
        session?.permissions.includes(permissionKey) ?? false,
      isAuthenticated: currentUser !== null,
      isLoading,
      login,
      logout,
      permissions: session?.permissions ?? [],
      refreshSession,
      role,
      roleLabel: roleProfiles[role].label,
      setAdminCanViewRecordings: (enabled) => {
        const nextSettings = {
          ...accessSettings,
          adminCanViewRecordings: enabled,
        };
        saveAccessSettings(nextSettings);
        setAccessSettings(nextSettings);
      },
      switchTenant,
    }),
    [
      accessSettings,
      allowedRoutes,
      currentUser,
      isLoading,
      login,
      logout,
      refreshSession,
      role,
      session,
      switchTenant,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
