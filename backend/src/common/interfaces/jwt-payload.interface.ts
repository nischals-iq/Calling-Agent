export class JwtPayload {
  sub: string;
  email: string;
  role: string;
  clientId?: string | null;
  permissions?: string[];
}

export class AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  clientId?: string | null;
  permissions?: string[];
}
