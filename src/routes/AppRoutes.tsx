import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import AccessDenied from '../pages/AccessDenied';
import Dashboard from '../pages/Dashboard';
import Extensions from '../pages/Extensions';
import InboundRoutes from '../pages/InboundRoutes';
import OutboundRoutes from '../pages/OutboundRoutes';
import Settings from '../pages/Settings';
import SipTrunks from '../pages/SipTrunks';
import Tenants from '../pages/Tenants';
import Webphone from '../pages/Webphone';
import type { RouteKey } from '../services/accessControl';

function protect(routeKey: RouteKey, element: ReactNode) {
  return <ProtectedRoute routeKey={routeKey}>{element}</ProtectedRoute>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/empresas" element={protect('tenants', <Tenants />)} />
      <Route path="/" element={protect('dashboard', <Dashboard />)} />
      <Route path="/ramais" element={protect('extensions', <Extensions />)} />
      <Route
        path="/troncos-sip"
        element={protect('sip-trunks', <SipTrunks />)}
      />
      <Route
        path="/rotas-saida"
        element={protect('outbound-routes', <OutboundRoutes />)}
      />
      <Route
        path="/rotas-entrada"
        element={protect('inbound-routes', <InboundRoutes />)}
      />
      <Route path="/webphone" element={protect('webphone', <Webphone />)} />
      <Route
        path="/configuracoes"
        element={protect('settings', <Settings />)}
      />
      <Route path="/acesso-negado" element={<AccessDenied />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
