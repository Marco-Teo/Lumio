CREATE UNIQUE INDEX "photo_processing_organizationId_registrationId_revisionId_key" ON photo_processing("organizationId","registrationId","revisionId");
CREATE FUNCTION guard_revision_quota() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_user='lumio_migrator' THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.registration WHERE id=NEW."registrationId" AND "organizationId"=NEW."organizationId" FOR UPDATE;
 IF (SELECT coalesce(sum(bytes),0) FROM public.photo_revision WHERE "registrationId"=NEW."registrationId")+NEW.bytes>1073741824 THEN RAISE EXCEPTION 'PHOTO_STORAGE_QUOTA'; END IF;
 IF NEW.number<>(SELECT coalesce(max(number),0)+1 FROM public.photo_revision WHERE "photoId"=NEW."photoId") THEN RAISE EXCEPTION 'REVISION_SEQUENCE_REQUIRED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION guard_revision_quota() FROM PUBLIC;
CREATE TRIGGER revision_quota_guard BEFORE INSERT ON photo_revision FOR EACH ROW EXECUTE FUNCTION guard_revision_quota();