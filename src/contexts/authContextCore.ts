import { createContext } from 'react';
import type {
  PermissionKey,
  RouteKey,
  UserRole,
} from '../services/accessControl';
import type { PublicUser } from '../services/mockUsers';
import type { SessionTenant } from '../services/mvpApi';

export type LoginCredentials = {
  identifier: string;
  password: string;
  remember: boolean;
};

export type AuthContextValue = {
  adminCanViewRecordings: boolean;
  allowedRoutes: RouteKey[];
  activeTenant: SessionTenant | null;
  availableTenants: SessionTenant[];
  canAccessRoute: (routeKey: string) => boolean;
  currentUser: PublicUser | null;
  hasPermission: (permissionKey: PermissionKey) => boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  permissions: string[];
  refreshSession: () => Promise<void>;
  role: UserRole;
  roleLabel: string;
  setAdminCanViewRecordings: (enabled: boolean) => void;
  switchTenant: (tenantId: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
