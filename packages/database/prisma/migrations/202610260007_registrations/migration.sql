ALTER TABLE person ADD COLUMN phone text, ADD COLUMN "birthDate" text,
  ADD COLUMN address text, ADD COLUMN city text, ADD COLUMN province text,
  ADD COLUMN "postalCode" text, ADD COLUMN country text, ADD COLUMN "profileVersion" integer NOT NULL DEFAULT 1;

CREATE TABLE registration (
  id text PRIMARY KEY, "organizationId" text NOT NULL, "editionId" text NOT NULL,
  "editionVersion" integer NOT NULL, "personId" text NOT NULL REFERENCES person(id),
  "profileSnapshot" jsonb NOT NULL, "configurationSnapshot" jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('profile_incomplete','entries_incomplete')),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  "regulationsAcceptedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "privacyAcknowledgedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId",id), UNIQUE ("editionId","personId"),
  FOREIGN KEY ("organizationId","editionId","editionVersion") REFERENCES edition_revision("organizationId","editionId",version)
);
CREATE INDEX registration_organizationId_editionId_createdAt_idx ON registration("organizationId","editionId","createdAt");
CREATE TABLE registration_event (
  id text PRIMARY KEY, "organizationId" text NOT NULL, "registrationId" text NOT NULL,
  "actorUserId" text NOT NULL REFERENCES "user"(id), action text NOT NULL,
  before jsonb NOT NULL, after jsonb NOT NULL, "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("organizationId","registrationId") REFERENCES registration("organizationId",id)
);
CREATE INDEX registration_event_organizationId_registrationId_createdAt_idx ON registration_event("organizationId","registrationId","createdAt");

-- Public catalog capabilities expose published configuration only, never
-- draft history, authors, memberships, credentials or participant data.
CREATE FUNCTION published_edition_catalog() RETURNS TABLE (
  "editionId" text, "organizationName" text, "contestName" text, name text,
  "opensAt" text, "closesAt" text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT e.id,o.name,c.name,e.name,r.configuration->>'opensAt',r.configuration->>'closesAt'
  FROM public.edition e JOIN public.organization o ON o.id=e."organizationId"
  JOIN public.contest c ON c.id=e."contestId" AND c."organizationId"=e."organizationId"
  JOIN public.edition_revision r ON r."editionId"=e.id AND r."organizationId"=e."organizationId" AND r.version=e.version
  WHERE e.status='published' AND o.status='active' ORDER BY e."createdAt" DESC LIMIT 100
$$;
CREATE FUNCTION published_edition_detail(target_id text) RETURNS TABLE (
  "editionId" text, "organizationId" text, "organizationName" text, "contestName" text, version integer, configuration jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT e.id,e."organizationId",o.name,c.name,e.version,r.configuration
  FROM public.edition e JOIN public.organization o ON o.id=e."organizationId"
  JOIN public.contest c ON c.id=e."contestId" AND c."organizationId"=e."organizationId"
  JOIN public.edition_revision r ON r."editionId"=e.id AND r."organizationId"=e."organizationId" AND r.version=e.version
  WHERE e.id=target_id AND e.status='published' AND o.status='active'
$$;
CREATE FUNCTION registration_window_open(tenant_id text,edition_id text,edition_version integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.edition e JOIN public.organization o ON o.id=e."organizationId"
    JOIN public.edition_revision r ON r."organizationId"=e."organizationId" AND r."editionId"=e.id AND r.version=e.version
    JOIN public."user" u ON u.id=nullif(current_setting('app.user_id',true),'') AND u."emailVerified"
    WHERE e.id=edition_id AND e."organizationId"=tenant_id AND e.version=edition_version
      AND e.status='published' AND o.status='active'
      AND CURRENT_TIMESTAMP >= (r.configuration->>'opensAt')::timestamptz
      AND CURRENT_TIMESTAMP < (r.configuration->>'closesAt')::timestamptz
  )
$$;
CREATE FUNCTION own_registration_catalog(target_registration text DEFAULT NULL) RETURNS TABLE (
  id text,"organizationId" text,"editionId" text,"editionName" text,"contestName" text,status text,"updatedAt" timestamp(3)
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT r.id,r."organizationId",r."editionId",r."configurationSnapshot"->>'name',c.name,r.status,r."updatedAt"
  FROM public.registration r JOIN public.person p ON p.id=r."personId"
  JOIN public.edition e ON e.id=r."editionId" AND e."organizationId"=r."organizationId"
  JOIN public.contest c ON c.id=e."contestId" AND c."organizationId"=r."organizationId"
  WHERE p."userId"=nullif(current_setting('app.user_id',true),'') AND (target_registration IS NULL OR r.id=target_registration) ORDER BY r."createdAt" DESC LIMIT 100
$$;
REVOKE ALL ON FUNCTION published_edition_catalog(),published_edition_detail(text),registration_window_open(text,text,integer),own_registration_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published_edition_catalog(),published_edition_detail(text),registration_window_open(text,text,integer),own_registration_catalog(text) TO lumio_app;

CREATE FUNCTION lock_registration_window(tenant_id text,edition_id text,edition_version integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM 1 FROM public.organization WHERE id=tenant_id FOR SHARE;
  PERFORM 1 FROM public.edition WHERE id=edition_id AND "organizationId"=tenant_id FOR SHARE;
  RETURN public.registration_window_open(tenant_id,edition_id,edition_version);
END $$;
REVOKE ALL ON FUNCTION lock_registration_window(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_registration_window(text,text,integer) TO lumio_app;

ALTER TABLE registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration FORCE ROW LEVEL SECURITY;
CREATE POLICY provision ON registration TO lumio_migrator USING(true) WITH CHECK(true);
CREATE POLICY registration_self_read ON registration FOR SELECT TO lumio_app USING (
  "organizationId"=nullif(current_setting('app.organization_id',true),'')
  AND EXISTS(SELECT 1 FROM person p WHERE p.id="personId" AND p."userId"=nullif(current_setting('app.user_id',true),''))
);
CREATE POLICY registration_admin_read ON registration FOR SELECT TO lumio_app USING(can_manage_competitions("organizationId"));
CREATE POLICY registration_self_create ON registration FOR INSERT TO lumio_app WITH CHECK (
  "organizationId"=nullif(current_setting('app.organization_id',true),'')
  AND EXISTS(SELECT 1 FROM person p WHERE p.id="personId" AND p."userId"=nullif(current_setting('app.user_id',true),''))
  AND registration_window_open("organizationId","editionId","editionVersion")
);
CREATE POLICY registration_self_update ON registration FOR UPDATE TO lumio_app USING (
  "organizationId"=nullif(current_setting('app.organization_id',true),'')
  AND EXISTS(SELECT 1 FROM person p WHERE p.id="personId" AND p."userId"=nullif(current_setting('app.user_id',true),''))
) WITH CHECK (registration_window_open("organizationId","editionId","editionVersion"));
GRANT SELECT,INSERT,UPDATE ON registration TO lumio_app;

ALTER TABLE registration_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_event FORCE ROW LEVEL SECURITY;
CREATE POLICY provision ON registration_event TO lumio_migrator USING(true) WITH CHECK(true);
CREATE POLICY registration_event_read ON registration_event FOR SELECT TO lumio_app USING (
  "organizationId"=nullif(current_setting('app.organization_id',true),'')
  AND EXISTS(SELECT 1 FROM registration r WHERE r.id="registrationId" AND r."organizationId"=registration_event."organizationId")
);
CREATE POLICY registration_event_insert ON registration_event FOR INSERT TO lumio_app WITH CHECK (
  "organizationId"=nullif(current_setting('app.organization_id',true),'')
  AND "actorUserId"=nullif(current_setting('app.user_id',true),'')
  AND EXISTS(SELECT 1 FROM registration r JOIN person p ON p.id=r."personId" WHERE r.id="registrationId" AND r."organizationId"=registration_event."organizationId" AND p."userId"="actorUserId")
);
GRANT SELECT,INSERT ON registration_event TO lumio_app;

CREATE FUNCTION guard_registration_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF current_user='lumio_migrator' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW)-ARRAY['profileSnapshot','status','version','updatedAt'])<>(to_jsonb(OLD)-ARRAY['profileSnapshot','status','version','updatedAt']) THEN
    RAISE EXCEPTION 'REGISTRATION_IDENTITY_LOCKED';
  END IF;
  IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'REGISTRATION_VERSION_REQUIRED'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION guard_registration_identity() FROM PUBLIC;
CREATE TRIGGER registration_identity_guard BEFORE UPDATE ON registration FOR EACH ROW EXECUTE FUNCTION guard_registration_identity();
