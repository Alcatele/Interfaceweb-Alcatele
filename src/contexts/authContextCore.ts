import { createContext } from 'react';
import type {
  PermissionKey,
  RouteKey,
  UserRole,
} from '../services/accessControl';
import type { PublicUser } from '../services/mockUsers';

export type LoginCredentials = {
  identifier: string;
  password: string;
  remember: boolean;
};

export type AuthContextValue = {
  adminCanViewRecordings: boolean;
  allowedRoutes: RouteKey[];
  canAccessRoute: (routeKey: string) => boolean;
  currentUser: PublicUser | null;
  hasPermission: (permissionKey: PermissionKey) => boolean;
  isAuthenticated: boolean;
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  role: UserRole;
  roleLabel: string;
  setAdminCanViewRecordings: (enabled: boolean) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
