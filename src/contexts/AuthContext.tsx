import {
  type PropsWithChildren,
  useMemo,
  useState,
} from 'react';
import {
  canRoleAccessRoute,
  roleHasPermission,
  roleProfiles,
  roleRouteAccess,
} from '../services/accessControl';
import {
  getAccessSettings,
  saveAccessSettings,
} from '../services/accessSettings';
import {
  authenticateMockUser,
  getPublicUserById,
  type PublicUser,
} from '../services/mockUsers';
import {
  AuthContext,
  type AuthContextValue,
  type LoginCredentials,
} from './authContextCore';

const persistentSessionKey = 'pabx-cloud-session';
const temporarySessionKey = 'pabx-cloud-session-temp';

function getInitialUser(): PublicUser | null {
  const userId =
    window.localStorage.getItem(persistentSessionKey) ??
    window.sessionStorage.getItem(temporarySessionKey);

  return userId ? getPublicUserById(userId) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(
    getInitialUser,
  );
  const [accessSettings, setAccessSettings] = useState(getAccessSettings);
  const role = currentUser?.role ?? 'user';

  const value = useMemo<AuthContextValue>(
    () => ({
      adminCanViewRecordings: accessSettings.adminCanViewRecordings,
      allowedRoutes: roleRouteAccess[role].filter(
        (routeKey) =>
          !(
            role === 'admin' &&
            routeKey === 'recordings' &&
            !accessSettings.adminCanViewRecordings
          ),
      ),
      canAccessRoute: (routeKey) =>
        !(
          role === 'admin' &&
          routeKey === 'recordings' &&
          !accessSettings.adminCanViewRecordings
        ) && canRoleAccessRoute(role, routeKey),
      currentUser,
      hasPermission: (permissionKey) =>
        !(
          role === 'admin' &&
          permissionKey === 'recordings.view' &&
          !accessSettings.adminCanViewRecordings
        ) && roleHasPermission(role, permissionKey),
      isAuthenticated: currentUser !== null,
      login: async ({
        identifier,
        password,
        remember,
      }: LoginCredentials) => {
        const user = await authenticateMockUser(identifier, password);

        if (!user) {
          return {
            success: false,
            error: 'Usuário, e-mail ou senha invalidos.',
          };
        }

        window.localStorage.removeItem(persistentSessionKey);
        window.sessionStorage.removeItem(temporarySessionKey);

        if (remember) {
          window.localStorage.setItem(persistentSessionKey, user.id);
        } else {
          window.sessionStorage.setItem(temporarySessionKey, user.id);
        }

        setCurrentUser(user);
        return { success: true };
      },
      logout: () => {
        window.localStorage.removeItem(persistentSessionKey);
        window.sessionStorage.removeItem(temporarySessionKey);
        setCurrentUser(null);
      },
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
    }),
    [accessSettings, currentUser, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

