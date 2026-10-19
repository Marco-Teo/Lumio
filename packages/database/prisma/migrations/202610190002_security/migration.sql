-- Runtime and migration roles are provisioned separately, never by HTTP requests.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lumio_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON "user", "session", "account", "verification", "twoFactor" TO lumio_app;
GRANT SELECT, INSERT, UPDATE ON person TO lumio_app;
GRANT SELECT ON organization, organization_membership, platform_role TO lumio_app;
GRANT SELECT, INSERT ON audit_event TO lumio_app;

ALTER TABLE organization ADD CONSTRAINT organization_status CHECK (status IN ('active', 'suspended'));
ALTER TABLE organization_membership ADD CONSTRAINT membership_role CHECK (role IN ('admin'));
ALTER TABLE platform_role ADD CONSTRAINT platform_role_value CHECK (role = 'super_admin');
ALTER TABLE audit_event ADD CONSTRAINT audit_actor_tenant_fk FOREIGN KEY ("organizationId", "actorMembershipId") REFERENCES organization_membership ("organizationId", id);

ALTER TABLE person ENABLE ROW LEVEL SECURITY;
ALTER TABLE person FORCE ROW LEVEL SECURITY;
CREATE POLICY person_self ON person TO lumio_app USING ("userId" = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("userId" = nullif(current_setting('app.user_id', true), ''));

ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_scope ON organization TO lumio_app USING (id = nullif(current_setting('app.organization_id', true), ''));

ALTER TABLE organization_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_membership FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_scope ON organization_membership TO lumio_app USING ("organizationId" = nullif(current_setting('app.organization_id', true), '') AND "userId" = nullif(current_setting('app.user_id', true), ''));

ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_scope ON audit_event TO lumio_app USING ("organizationId" = nullif(current_setting('app.organization_id', true), '')) WITH CHECK ("organizationId" = nullif(current_setting('app.organization_id', true), '') AND "actorUserId" = nullif(current_setting('app.user_id', true), '') AND EXISTS (SELECT 1 FROM organization_membership m WHERE m.id = "actorMembershipId" AND m."userId" = nullif(current_setting('app.user_id', true), '')));

ALTER TABLE platform_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_role FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_self ON platform_role TO lumio_app USING ("userId" = nullif(current_setting('app.user_id', true), ''));

-- The migration owner is still constrained by FORCE RLS; trusted CLI provisioning
-- gets an explicit policy unavailable to the runtime role.
CREATE POLICY provision_person ON person TO lumio_migrator USING (true) WITH CHECK (true);
CREATE POLICY provision_organization ON organization TO lumio_migrator USING (true) WITH CHECK (true);
CREATE POLICY provision_membership ON organization_membership TO lumio_migrator USING (true) WITH CHECK (true);
CREATE POLICY provision_audit ON audit_event TO lumio_migrator USING (true) WITH CHECK (true);
CREATE POLICY provision_platform ON platform_role TO lumio_migrator USING (true) WITH CHECK (true);

CREATE FUNCTION create_person_for_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.person (id, "userId") VALUES (gen_random_uuid()::text, NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION create_person_for_user() FROM PUBLIC;
CREATE TRIGGER user_person AFTER INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION create_person_for_user();
