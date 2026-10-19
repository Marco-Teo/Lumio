CREATE TABLE "user" (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false, image TEXT,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE session (
  id TEXT PRIMARY KEY, "expiresAt" TIMESTAMP(3) NOT NULL, token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX session_user_idx ON session("userId");
CREATE TABLE account (
  id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3), "refreshTokenExpiresAt" TIMESTAMP(3), scope TEXT, password TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("providerId", "accountId")
);
CREATE INDEX account_user ON account("userId");
CREATE TABLE verification (
  id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX verification_identifier ON verification(identifier);
CREATE TABLE "twoFactor" (
  id TEXT PRIMARY KEY, secret TEXT NOT NULL, "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT true, "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3)
);
CREATE INDEX two_factor_user ON "twoFactor"("userId");
CREATE TABLE person (
  id TEXT PRIMARY KEY, "userId" TEXT UNIQUE REFERENCES "user"(id) ON DELETE SET NULL,
  "firstName" TEXT, "lastName" TEXT
);
CREATE TABLE organization (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  "contactEmail" TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE organization_membership (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organization(id) ON DELETE RESTRICT,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT, role TEXT NOT NULL DEFAULT 'admin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "userId"), UNIQUE ("organizationId", id)
);
CREATE INDEX membership_user ON organization_membership("userId");
CREATE TABLE platform_role (
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, role TEXT NOT NULL,
  PRIMARY KEY ("userId", role)
);
CREATE TABLE audit_event (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organization(id) ON DELETE RESTRICT,
  "actorUserId" TEXT NOT NULL, "actorMembershipId" TEXT NOT NULL,
  action TEXT NOT NULL, "entityId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_organization_created ON audit_event("organizationId", "createdAt");
