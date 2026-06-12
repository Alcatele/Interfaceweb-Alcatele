import { Request } from 'express';

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
};

export type SessionTenant = {
  id: string;
  name: string;
  slug: string;
  domain: string;
};

export type AvailableTenant = SessionTenant & {
  membershipId: string;
  role: string;
};

export type SessionContext = {
  sessionId: string;
  user: SessionUser;
  tenant: SessionTenant;
  membershipId: string;
  role: string;
  permissions: string[];
  availableTenants: AvailableTenant[];
};

export interface AuthenticatedRequest extends Request {
  session: SessionContext;
}
