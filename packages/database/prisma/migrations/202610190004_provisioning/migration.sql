CREATE TABLE organization_invitation (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES organization(id) ON DELETE RESTRICT,
  email TEXT NOT NULL, "tokenHash" TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3), "acceptedByUserId" TEXT REFERENCES "user"(id),
  UNIQUE ("organizationId", id)
);
CREATE INDEX "organization_invitation_organizationId_createdAt_idx" ON organization_invitation ("organizationId", "createdAt");
CREATE UNIQUE INDEX invitation_one_pending_email ON organization_invitation ("organizationId",email) WHERE status='pending';

CREATE TABLE outbox_event (
  id TEXT PRIMARY KEY, "organizationId" TEXT REFERENCES organization(id),
  "invitationId" TEXT REFERENCES organization_invitation(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('organization.invite','system.ping')), payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','completed','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0), "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("organizationId","invitationId") REFERENCES organization_invitation("organizationId",id),
  CHECK ((type='system.ping' AND "organizationId" IS NULL AND "invitationId" IS NULL) OR (type='organization.invite' AND "organizationId" IS NOT NULL AND "invitationId" IS NOT NULL))
);
CREATE INDEX "outbox_event_status_updatedAt_idx" ON outbox_event(status,"updatedAt");

CREATE TABLE platform_audit (
  id TEXT PRIMARY KEY, "actorUserId" TEXT REFERENCES "user"(id),
  "actorKind" TEXT NOT NULL DEFAULT 'user' CHECK ("actorKind" IN ('user','operator')),
  "organizationId" TEXT REFERENCES organization(id), action TEXT NOT NULL, "entityId" TEXT NOT NULL,
  before JSONB, after JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "platform_audit_organizationId_createdAt_idx" ON platform_audit("organizationId","createdAt");

CREATE FUNCTION is_platform_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_role p JOIN public."user" u ON u.id=p."userId"
    WHERE p."userId"=nullif(current_setting('app.user_id',true),'') AND p.role='super_admin' AND u."emailVerified" AND u."twoFactorEnabled");
$$;
REVOKE ALL ON FUNCTION is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO lumio_app;

GRANT INSERT,UPDATE ON organization TO lumio_app;
CREATE POLICY platform_org_read ON organization FOR SELECT TO lumio_app USING (is_platform_admin());
CREATE POLICY platform_org_insert ON organization FOR INSERT TO lumio_app WITH CHECK (is_platform_admin());
CREATE POLICY platform_org_update ON organization FOR UPDATE TO lumio_app USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY platform_membership_read ON organization_membership FOR SELECT TO lumio_app USING (is_platform_admin());

ALTER TABLE organization_invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitation FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_platform ON organization_invitation TO lumio_app USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY invitation_provision ON organization_invitation TO lumio_migrator USING (true) WITH CHECK (true);
GRANT SELECT,INSERT,UPDATE ON organization_invitation TO lumio_app;

ALTER TABLE outbox_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_event FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_platform ON outbox_event TO lumio_app USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY outbox_provision ON outbox_event TO lumio_migrator USING (true) WITH CHECK (true);
CREATE POLICY outbox_worker ON outbox_event TO lumio_worker USING (true) WITH CHECK (true);
GRANT SELECT,INSERT,UPDATE ON outbox_event TO lumio_app;
GRANT USAGE ON SCHEMA public TO lumio_worker;
GRANT SELECT,UPDATE ON outbox_event TO lumio_worker;
GRANT SELECT ON organization_invitation,organization TO lumio_worker;
CREATE POLICY invitation_worker ON organization_invitation FOR SELECT TO lumio_worker USING ("organizationId"=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY organization_worker ON organization FOR SELECT TO lumio_worker USING (id=nullif(current_setting('app.organization_id',true),''));

ALTER TABLE platform_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_platform_read ON platform_audit FOR SELECT TO lumio_app USING (is_platform_admin());
CREATE POLICY audit_platform_write ON platform_audit FOR INSERT TO lumio_app WITH CHECK (is_platform_admin() AND "actorUserId"=nullif(current_setting('app.user_id',true),'') AND "actorKind"='user');
CREATE POLICY audit_platform_provision ON platform_audit TO lumio_migrator USING (true) WITH CHECK (true);
GRANT SELECT,INSERT ON platform_audit TO lumio_app;

-- Narrow capability: accepts only an unexpired invitation for the verified
-- identity established by the HTTP server. It cannot assign platform privileges.
CREATE FUNCTION accept_organization_invitation(invitation_hash text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor_id text; actor_email text; org_id text; inv public.organization_invitation%ROWTYPE;
BEGIN
  actor_id := nullif(current_setting('app.user_id',true),'');
  SELECT lower(email) INTO actor_email FROM public."user" WHERE id=actor_id AND "emailVerified";
  IF actor_email IS NULL THEN RAISE EXCEPTION 'INVITATION_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
  SELECT "organizationId" INTO org_id FROM public.organization_invitation WHERE "tokenHash"=invitation_hash;
  IF org_id IS NULL THEN RAISE EXCEPTION 'INVITATION_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.organization WHERE id=org_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
  SELECT * INTO inv FROM public.organization_invitation WHERE "tokenHash"=invitation_hash FOR UPDATE;
  IF inv.status<>'pending' OR inv."expiresAt"<=CURRENT_TIMESTAMP OR inv.email<>actor_email THEN
    RAISE EXCEPTION 'INVITATION_UNAVAILABLE' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.organization_membership(id,"organizationId","userId",role)
    VALUES(gen_random_uuid()::text,org_id,actor_id,'admin') ON CONFLICT("organizationId","userId") DO NOTHING;
  UPDATE public.organization_invitation SET status='accepted',"acceptedAt"=CURRENT_TIMESTAMP,"acceptedByUserId"=actor_id WHERE id=inv.id;
  INSERT INTO public.platform_audit(id,"actorUserId","organizationId",action,"entityId")
    VALUES(gen_random_uuid()::text,actor_id,org_id,'invitation.accepted',inv.id);
  RETURN org_id;
END;
$$;
REVOKE ALL ON FUNCTION accept_organization_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_organization_invitation(text) TO lumio_app;
