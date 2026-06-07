import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import type { RouteKey } from '../services/accessControl';

type ProtectedRouteProps = {
  children: ReactNode;
  routeKey: RouteKey;
};

export default function ProtectedRoute({
  children,
  routeKey,
}: ProtectedRouteProps) {
  const { canAccessRoute } = useAuth();
  const location = useLocation();

  if (!canAccessRoute(routeKey)) {
    return (
      <Navigate
        replace
        state={{ from: location.pathname }}
        to="/acesso-negado"
      />
    );
  }

  return <>{children}</>;
}
