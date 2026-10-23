-- Migration owner retains explicit maintenance rights. Runtime cannot reparent
-- sections from a frozen edition or forge the author of a configuration revision.
DROP POLICY tenant_manage ON edition_revision;
CREATE POLICY tenant_manage ON edition_revision TO lumio_app
  USING (can_manage_competitions("organizationId"))
  WITH CHECK (can_manage_competitions("organizationId") AND "actorUserId"=nullif(current_setting('app.user_id',true),''));

CREATE OR REPLACE FUNCTION guard_edition_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE edition_status text;
BEGIN
  IF current_user='lumio_migrator' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='edition' THEN
    IF TG_OP='INSERT' THEN
      IF NEW.status<>'draft' OR NEW."publishedAt" IS NOT NULL THEN RAISE EXCEPTION 'EDITION_MUST_START_DRAFT'; END IF;
      RETURN NEW;
    END IF;
    IF OLD.status<>'draft' AND NOT (
      OLD.status='published' AND NEW.status='archived'
      AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status')
    ) THEN RAISE EXCEPTION 'EDITION_LOCKED'; END IF;
    IF OLD.status='draft' AND NEW.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
    IF NEW."organizationId"<>OLD."organizationId" OR NEW."contestId"<>OLD."contestId" THEN RAISE EXCEPTION 'EDITION_PARENT_LOCKED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND (NEW."editionId"<>OLD."editionId" OR NEW."organizationId"<>OLD."organizationId") THEN
    RAISE EXCEPTION 'SECTION_PARENT_LOCKED';
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
CREATE TRIGGER edition_initial_state BEFORE INSERT ON edition FOR EACH ROW EXECUTE FUNCTION guard_edition_configuration();
