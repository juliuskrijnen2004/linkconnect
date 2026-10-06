import { Role } from "@prisma/client";

import { ForbiddenError, SessionClaims } from "@/lib/auth";

export type TenantScope = { companyId: string } | { companyId?: undefined };

export function tenantScope(session: SessionClaims, requestedCompanyId?: string): TenantScope {
  if (session.role === Role.ADMIN) {
    return requestedCompanyId ? { companyId: requestedCompanyId } : {};
  }
  if (!session.companyId) throw new ForbiddenError();
  if (requestedCompanyId && requestedCompanyId !== session.companyId) throw new ForbiddenError();
  return { companyId: session.companyId };
}

export function requireTenantCompanyId(session: SessionClaims, requestedCompanyId?: string) {
  const scope = tenantScope(session, requestedCompanyId);
  if (!scope.companyId) throw new ForbiddenError();
  return scope.companyId;
}
