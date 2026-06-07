import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import AccessDenied from '../pages/AccessDenied';
import Agents from '../pages/Agents';
import CallCalendars from '../pages/CallCalendars';
import CallCenterAdvanced from '../pages/CallCenterAdvanced';
import Contacts from '../pages/Contacts';
import Dashboard from '../pages/Dashboard';
import Extensions from '../pages/Extensions';
import InboundRoutes from '../pages/InboundRoutes';
import InternalChat from '../pages/InternalChat';
import Ivr from '../pages/Ivr';
import OutboundRoutes from '../pages/OutboundRoutes';
import OperatorPanel from '../pages/OperatorPanel';
import PickupGroups from '../pages/PickupGroups';
import PhoneProvisioning from '../pages/PhoneProvisioning';
import Queues from '../pages/Queues';
import Recordings from '../pages/Recordings';
import Reports from '../pages/Reports';
import RingGroups from '../pages/RingGroups';
import SecurityAudit from '../pages/SecurityAudit';
import Settings from '../pages/Settings';
import SipTrunks from '../pages/SipTrunks';
import Tenants from '../pages/Tenants';
import Voicemail from '../pages/Voicemail';
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
        path="/provisionamento"
        element={protect('provisioning', <PhoneProvisioning />)}
      />
      <Route path="/contatos" element={protect('contacts', <Contacts />)} />
      <Route path="/agentes" element={protect('agents', <Agents />)} />
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
      <Route
        path="/calendario"
        element={protect('call-calendar', <CallCalendars />)}
      />
      <Route path="/ura" element={protect('ivr', <Ivr />)} />
      <Route
        path="/grupos-captura"
        element={protect('pickup-groups', <PickupGroups />)}
      />
      <Route
        path="/grupos-toque"
        element={protect('ring-groups', <RingGroups />)}
      />
      <Route path="/filas" element={protect('queues', <Queues />)} />
      <Route
        path="/operador"
        element={protect('operator-panel', <OperatorPanel />)}
      />
      <Route
        path="/central-atendimento"
        element={protect('call-center', <CallCenterAdvanced />)}
      />
      <Route path="/relatorios" element={protect('reports', <Reports />)} />
      <Route
        path="/gravacoes"
        element={protect('recordings', <Recordings />)}
      />
      <Route path="/chat" element={protect('chat', <InternalChat />)} />
      <Route path="/webphone" element={protect('webphone', <Webphone />)} />
      <Route
        path="/correio-voz"
        element={protect('voicemail', <Voicemail />)}
      />
      <Route
        path="/seguranca"
        element={protect('security-audit', <SecurityAudit />)}
      />
      <Route
        path="/configuracoes"
        element={protect('settings', <Settings />)}
      />
      <Route path="/acesso-negado" element={<AccessDenied />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

