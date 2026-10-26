ALTER TABLE registration ADD COLUMN "organizationName" text, ADD COLUMN "contestName" text, ADD COLUMN "contactEmail" text;
UPDATE registration r SET "organizationName"=o.name,"contestName"=c.name,"contactEmail"=o."contactEmail"
FROM edition e JOIN contest c ON c.id=e."contestId" AND c."organizationId"=e."organizationId"
JOIN organization o ON o.id=e."organizationId"
WHERE r."editionId"=e.id AND r."organizationId"=e."organizationId";
ALTER TABLE registration ALTER COLUMN "organizationName" SET NOT NULL, ALTER COLUMN "contestName" SET NOT NULL, ALTER COLUMN "contactEmail" SET NOT NULL;

ALTER TABLE outbox_event ADD COLUMN "registrationId" text REFERENCES registration(id) ON DELETE RESTRICT;
ALTER TABLE outbox_event ADD CONSTRAINT outbox_registration_tenant_fk FOREIGN KEY("organizationId","registrationId") REFERENCES registration("organizationId",id);
CREATE UNIQUE INDEX "outbox_event_type_registrationId_key" ON outbox_event(type,"registrationId");
ALTER TABLE outbox_event DROP CONSTRAINT outbox_event_type_check, DROP CONSTRAINT outbox_event_check;
ALTER TABLE outbox_event ADD CONSTRAINT outbox_event_type_check CHECK(type IN ('organization.invite','system.ping','registration.started'));
ALTER TABLE outbox_event ADD CONSTRAINT outbox_event_check CHECK(
  (type='system.ping' AND "organizationId" IS NULL AND "invitationId" IS NULL AND "registrationId" IS NULL)
  OR (type='organization.invite' AND "organizationId" IS NOT NULL AND "invitationId" IS NOT NULL AND "registrationId" IS NULL)
  OR (type='registration.started' AND "organizationId" IS NOT NULL AND "invitationId" IS NULL AND "registrationId" IS NOT NULL)
);
CREATE POLICY receipt_owner ON outbox_event FOR SELECT TO lumio_app USING (
  type='registration.started' AND "organizationId"=nullif(current_setting('app.organization_id',true),'')
  AND EXISTS(SELECT 1 FROM registration r JOIN person p ON p.id=r."personId"
    WHERE r.id="registrationId" AND r."organizationId"=outbox_event."organizationId" AND p."userId"=nullif(current_setting('app.user_id',true),''))
);
CREATE POLICY receipt_create ON outbox_event FOR INSERT TO lumio_app WITH CHECK (
  type='registration.started' AND "organizationId"=nullif(current_setting('app.organization_id',true),'')
  AND EXISTS(SELECT 1 FROM registration r JOIN person p ON p.id=r."personId"
    WHERE r.id="registrationId" AND r."organizationId"=outbox_event."organizationId" AND p."userId"=nullif(current_setting('app.user_id',true),''))
);

DROP FUNCTION published_edition_detail(text);
CREATE FUNCTION published_edition_detail(target_id text) RETURNS TABLE (
  "editionId" text,"organizationId" text,"organizationName" text,"contestName" text,"contactEmail" text,version integer,configuration jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT e.id,e."organizationId",o.name,c.name,o."contactEmail",e.version,r.configuration
  FROM public.edition e JOIN public.organization o ON o.id=e."organizationId"
  JOIN public.contest c ON c.id=e."contestId" AND c."organizationId"=e."organizationId"
  JOIN public.edition_revision r ON r."editionId"=e.id AND r."organizationId"=e."organizationId" AND r.version=e.version
  WHERE e.id=target_id AND e.status='published' AND o.status='active'
$$;
REVOKE ALL ON FUNCTION published_edition_detail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published_edition_detail(text) TO lumio_app;
