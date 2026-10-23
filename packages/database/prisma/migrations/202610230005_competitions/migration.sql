ALTER TABLE audit_event ADD COLUMN before jsonb, ADD COLUMN after jsonb;

CREATE TABLE contest (
  id text PRIMARY KEY, "organizationId" text NOT NULL REFERENCES organization(id),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '', "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId",id), UNIQUE ("organizationId",slug)
);
CREATE TABLE edition (
  id text PRIMARY KEY, "organizationId" text NOT NULL, "contestId" text NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120), slug text NOT NULL,
  identifier text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0), "publishedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId",id), UNIQUE ("organizationId","contestId",slug),
  FOREIGN KEY ("organizationId","contestId") REFERENCES contest("organizationId",id),
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK ((status='draft' AND "publishedAt" IS NULL) OR (status<>'draft' AND "publishedAt" IS NOT NULL))
);
CREATE TABLE section (
  id text PRIMARY KEY, "organizationId" text NOT NULL, "editionId" text NOT NULL,
  name text NOT NULL, code text NOT NULL, description text NOT NULL, theme text NOT NULL,
  type text NOT NULL CHECK (type IN ('single','portfolio')),
  "minImages" integer NOT NULL CHECK ("minImages">=1),
  "maxImages" integer NOT NULL CHECK ("maxImages">="minImages" AND "maxImages"<=100),
  "feeCents" integer NOT NULL CHECK ("feeCents">=0), "specificRules" text NOT NULL,
  position integer NOT NULL CHECK (position>=0),
  UNIQUE ("organizationId","editionId",code),
  FOREIGN KEY ("organizationId","editionId") REFERENCES edition("organizationId",id)
);
CREATE INDEX section_organizationId_editionId_position_idx ON section("organizationId","editionId",position);
CREATE TABLE edition_revision (
  id text PRIMARY KEY, "organizationId" text NOT NULL, "editionId" text NOT NULL,
  version integer NOT NULL CHECK (version>0), configuration jsonb NOT NULL,
  "actorUserId" text NOT NULL REFERENCES "user"(id),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId","editionId",version),
  FOREIGN KEY ("organizationId","editionId") REFERENCES edition("organizationId",id)
);

-- Discovery reveals only the signed-in user's own memberships, never a tenant directory.
CREATE POLICY membership_discovery ON organization_membership FOR SELECT TO lumio_app
  USING ("userId"=nullif(current_setting('app.user_id',true),''));

-- A platform privilege alone does not grant access to competition data.
CREATE FUNCTION can_manage_competitions(tenant_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT tenant_id=nullif(current_setting('app.organization_id',true),'')
    AND EXISTS (SELECT 1 FROM public.organization o WHERE o.id=tenant_id AND o.status='active')
    AND EXISTS (SELECT 1 FROM public.organization_membership m JOIN public."user" u ON u.id=m."userId"
      WHERE m."organizationId"=tenant_id AND m."userId"=nullif(current_setting('app.user_id',true),'')
        AND m.role='admin' AND u."emailVerified" AND u."twoFactorEnabled")
$$;
REVOKE ALL ON FUNCTION can_manage_competitions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_manage_competitions(text) TO lumio_app;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['contest','edition','section','edition_revision'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_manage ON %I TO lumio_app USING (can_manage_competitions("organizationId")) WITH CHECK (can_manage_competitions("organizationId"))',t);
    EXECUTE format('CREATE POLICY provision ON %I TO lumio_migrator USING (true) WITH CHECK (true)',t);
  END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON contest,edition TO lumio_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON section TO lumio_app;
GRANT SELECT,INSERT ON edition_revision TO lumio_app;

-- Published configurations are frozen. Locking the parent also serializes concurrent saves/publication.
CREATE FUNCTION guard_edition_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE edition_status text;
BEGIN
  IF TG_TABLE_NAME='edition' THEN
    IF OLD.status<>'draft' AND NOT (
      OLD.status='published' AND NEW.status='archived'
      AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status')
    ) THEN RAISE EXCEPTION 'EDITION_LOCKED'; END IF;
    IF OLD.status='draft' AND NEW.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
    IF NEW."organizationId"<>OLD."organizationId" OR NEW."contestId"<>OLD."contestId" THEN RAISE EXCEPTION 'EDITION_PARENT_LOCKED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    SELECT status INTO edition_status FROM public.edition WHERE id=OLD."editionId" AND "organizationId"=OLD."organizationId" FOR UPDATE;
  ELSE
    SELECT status INTO edition_status FROM public.edition WHERE id=NEW."editionId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
  END IF;
  IF edition_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'EDITION_LOCKED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION guard_edition_configuration() FROM PUBLIC;
CREATE TRIGGER edition_guard BEFORE UPDATE ON edition FOR EACH ROW EXECUTE FUNCTION guard_edition_configuration();
CREATE TRIGGER section_guard BEFORE INSERT OR UPDATE OR DELETE ON section FOR EACH ROW EXECUTE FUNCTION guard_edition_configuration();
CREATE TRIGGER revision_guard BEFORE INSERT ON edition_revision FOR EACH ROW EXECUTE FUNCTION guard_edition_configuration();
