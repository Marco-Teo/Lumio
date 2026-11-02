CREATE TABLE entry (
 id text PRIMARY KEY, "organizationId" text NOT NULL, "registrationId" text NOT NULL,
 "sectionCode" text NOT NULL, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200), active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), "anonymousCode" text NOT NULL UNIQUE, "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("organizationId","registrationId",id),
 FOREIGN KEY("organizationId","registrationId") REFERENCES registration("organizationId",id)
);
CREATE INDEX entry_organization_registration ON entry("organizationId","registrationId");
CREATE TABLE photo (
 id text PRIMARY KEY,"organizationId" text NOT NULL,"registrationId" text NOT NULL,"entryId" text NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 100),"currentRevision" integer NOT NULL DEFAULT 0 CHECK("currentRevision" BETWEEN 0 AND 20),active boolean NOT NULL DEFAULT true,
 UNIQUE("entryId",position),UNIQUE("organizationId","registrationId",id),
 FOREIGN KEY("organizationId","registrationId","entryId") REFERENCES entry("organizationId","registrationId",id)
);
CREATE TABLE photo_revision (
 id text PRIMARY KEY,"organizationId" text NOT NULL,"registrationId" text NOT NULL,"photoId" text NOT NULL,
 number integer NOT NULL CHECK(number BETWEEN 1 AND 20),"storageKey" text NOT NULL UNIQUE,
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 26214400),rules jsonb NOT NULL,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("photoId",number),UNIQUE("organizationId","registrationId",id),UNIQUE("organizationId",id),
 FOREIGN KEY("organizationId","registrationId","photoId") REFERENCES photo("organizationId","registrationId",id)
);
CREATE TABLE photo_processing (
 "revisionId" text PRIMARY KEY,"organizationId" text NOT NULL,"registrationId" text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','rejected','failed')),"errorCode" text,"previewKey" text,width integer,height integer,format text,
 FOREIGN KEY("organizationId","registrationId","revisionId") REFERENCES photo_revision("organizationId","registrationId",id),
 CHECK((status='ready' AND "previewKey" IS NOT NULL AND width>0 AND height>0 AND format IN ('jpeg','png','tiff') AND "errorCode" IS NULL) OR (status<>'ready' AND "previewKey" IS NULL))
);
CREATE FUNCTION owns_media_registration(tenant_id text,registration_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT tenant_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM public.registration r JOIN public.person p ON p.id=r."personId" JOIN public."user" u ON u.id=p."userId"
 WHERE r.id=registration_id AND r."organizationId"=tenant_id AND u.id=nullif(current_setting('app.user_id',true),'') AND u."emailVerified")
$$;
CREATE FUNCTION media_registration_open(tenant_id text,registration_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.owns_media_registration(tenant_id,registration_id) AND EXISTS(
 SELECT 1 FROM public.registration r WHERE r.id=registration_id AND r."organizationId"=tenant_id AND public.registration_window_open(tenant_id,r."editionId",r."editionVersion"))
$$;
REVOKE ALL ON FUNCTION owns_media_registration(text,text),media_registration_open(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owns_media_registration(text,text),media_registration_open(text,text) TO lumio_app;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['entry','photo','photo_revision','photo_processing'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY provision ON %I TO lumio_migrator USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE POLICY owner_read ON %I FOR SELECT TO lumio_app USING(owns_media_registration("organizationId","registrationId"))',t);
 EXECUTE format('CREATE POLICY owner_insert ON %I FOR INSERT TO lumio_app WITH CHECK(media_registration_open("organizationId","registrationId"))',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO lumio_app',t);
 END LOOP; END $$;
CREATE POLICY owner_update ON entry FOR UPDATE TO lumio_app USING(owns_media_registration("organizationId","registrationId")) WITH CHECK(media_registration_open("organizationId","registrationId"));
CREATE POLICY owner_update ON photo FOR UPDATE TO lumio_app USING(owns_media_registration("organizationId","registrationId")) WITH CHECK(media_registration_open("organizationId","registrationId"));
GRANT UPDATE(title,active,version) ON entry TO lumio_app;
GRANT UPDATE("currentRevision",active) ON photo TO lumio_app;
CREATE POLICY worker_read ON photo_revision FOR SELECT TO lumio_worker USING("organizationId"=nullif(current_setting('app.organization_id',true),'') AND id=nullif(current_setting('app.photo_revision_id',true),''));
CREATE POLICY worker_read ON photo_processing FOR SELECT TO lumio_worker USING("organizationId"=nullif(current_setting('app.organization_id',true),'') AND "revisionId"=nullif(current_setting('app.photo_revision_id',true),''));
CREATE POLICY worker_update ON photo_processing FOR UPDATE TO lumio_worker USING("organizationId"=nullif(current_setting('app.organization_id',true),'') AND "revisionId"=nullif(current_setting('app.photo_revision_id',true),''));
GRANT SELECT ON photo_revision,photo_processing TO lumio_worker;
GRANT UPDATE(status,"errorCode","previewKey",width,height,format) ON photo_processing TO lumio_worker;

-- Validate immutable parents, configured sections and pending-only inserts.
CREATE FUNCTION guard_participant_media() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE config jsonb; section jsonb; BEGIN
 IF current_user='lumio_migrator' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='entry' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'ENTRY_VERSION_REQUIRED'; END IF;
  ELSE
   SELECT "configurationSnapshot" INTO config FROM public.registration WHERE id=NEW."registrationId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
   SELECT s INTO section FROM jsonb_array_elements(config->'sections') s WHERE s->>'code'=NEW."sectionCode";
   IF section IS NULL OR NEW.version<>1 OR NOT NEW.active THEN RAISE EXCEPTION 'INVALID_ENTRY'; END IF;
   IF (SELECT count(*) FROM public.entry WHERE "registrationId"=NEW."registrationId")>=100 THEN RAISE EXCEPTION 'ENTRY_LIMIT'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='photo' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW."currentRevision"<>OLD."currentRevision" AND NEW."currentRevision"<>OLD."currentRevision"+1 THEN RAISE EXCEPTION 'PHOTO_REVISION_REQUIRED'; END IF;
  ELSE
   SELECT r."configurationSnapshot" INTO config FROM public.registration r WHERE r.id=NEW."registrationId" AND r."organizationId"=NEW."organizationId";
   SELECT s INTO section FROM public.entry e CROSS JOIN LATERAL jsonb_array_elements(config->'sections') s WHERE e.id=NEW."entryId" AND e.active AND s->>'code'=e."sectionCode";
   IF section IS NULL OR NEW.position>(section->>'maxImages')::int OR NEW."currentRevision"<>0 THEN RAISE EXCEPTION 'INVALID_PHOTO'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='photo_revision' THEN
  SELECT "configurationSnapshot" INTO config FROM public.registration WHERE id=NEW."registrationId" AND "organizationId"=NEW."organizationId";
  IF NEW.rules<>config->'imageRules' OR NEW.bytes>(config->'imageRules'->>'maxBytes')::int OR NOT EXISTS(SELECT 1 FROM public.photo p JOIN public.entry e ON e.id=p."entryId" AND e."organizationId"=p."organizationId" WHERE p.id=NEW."photoId" AND p."currentRevision"=NEW.number AND p.active AND e.active) THEN RAISE EXCEPTION 'INVALID_PHOTO_REVISION'; END IF;
  IF NEW."storageKey"<>NEW."organizationId"||'/original/'||NEW.id THEN RAISE EXCEPTION 'INVALID_STORAGE_KEY'; END IF;
 ELSIF TG_TABLE_NAME='photo_processing' THEN
  IF TG_OP='INSERT' AND (NEW.status<>'pending' OR NEW."errorCode" IS NOT NULL OR NEW."previewKey" IS NOT NULL OR NEW.width IS NOT NULL OR NEW.height IS NOT NULL OR NEW.format IS NOT NULL) THEN RAISE EXCEPTION 'PROCESSING_PENDING_REQUIRED'; END IF;
  IF TG_OP='UPDATE' AND OLD.status<>'pending' THEN RAISE EXCEPTION 'PROCESSING_ALREADY_FINISHED'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION guard_participant_media() FROM PUBLIC;
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE ON entry FOR EACH ROW EXECUTE FUNCTION guard_participant_media();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE ON photo FOR EACH ROW EXECUTE FUNCTION guard_participant_media();
CREATE TRIGGER media_guard BEFORE INSERT ON photo_revision FOR EACH ROW EXECUTE FUNCTION guard_participant_media();
CREATE TRIGGER media_guard BEFORE INSERT OR UPDATE ON photo_processing FOR EACH ROW EXECUTE FUNCTION guard_participant_media();

ALTER TABLE outbox_event ADD COLUMN "photoRevisionId" text;
ALTER TABLE outbox_event ADD CONSTRAINT outbox_photo_tenant_fk FOREIGN KEY("organizationId","photoRevisionId") REFERENCES photo_revision("organizationId",id);
CREATE UNIQUE INDEX "outbox_event_type_photoRevisionId_key" ON outbox_event(type,"photoRevisionId");
ALTER TABLE outbox_event DROP CONSTRAINT outbox_event_type_check,DROP CONSTRAINT outbox_event_check;
ALTER TABLE outbox_event ADD CONSTRAINT outbox_event_type_check CHECK(type IN ('organization.invite','system.ping','registration.started','photo.process'));
ALTER TABLE outbox_event ADD CONSTRAINT outbox_event_check CHECK(
 (type='system.ping' AND "organizationId" IS NULL AND "invitationId" IS NULL AND "registrationId" IS NULL AND "photoRevisionId" IS NULL)
 OR (type='organization.invite' AND "organizationId" IS NOT NULL AND "invitationId" IS NOT NULL AND "registrationId" IS NULL AND "photoRevisionId" IS NULL)
 OR (type='registration.started' AND "organizationId" IS NOT NULL AND "invitationId" IS NULL AND "registrationId" IS NOT NULL AND "photoRevisionId" IS NULL)
 OR (type='photo.process' AND "organizationId" IS NOT NULL AND "invitationId" IS NULL AND "registrationId" IS NULL AND "photoRevisionId" IS NOT NULL AND payload=jsonb_build_object('revisionId',"photoRevisionId"))
);
CREATE POLICY photo_create ON outbox_event FOR INSERT TO lumio_app WITH CHECK(type='photo.process' AND EXISTS(SELECT 1 FROM photo_revision r WHERE r.id="photoRevisionId" AND r."organizationId"=outbox_event."organizationId" AND media_registration_open(r."organizationId",r."registrationId")));