ALTER TABLE contest ADD COLUMN "coverData" bytea, ADD COLUMN "coverVersion" text;
ALTER TABLE contest ADD CONSTRAINT contest_cover_valid CHECK (
  ("coverData" IS NULL AND "coverVersion" IS NULL)
  OR ("coverData" IS NOT NULL AND "coverVersion" IS NOT NULL AND octet_length("coverData") BETWEEN 1 AND 1048576 AND "coverVersion" ~ '^[a-f0-9]{64}$')
);

DROP FUNCTION published_edition_catalog();
CREATE FUNCTION published_edition_catalog() RETURNS TABLE (
  "editionId" text,"organizationName" text,"contestName" text,name text,"opensAt" text,"closesAt" text,"contestId" text,"coverVersion" text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT e.id,o.name,c.name,e.name,r.configuration->>'opensAt',r.configuration->>'closesAt',c.id,c."coverVersion"
  FROM public.edition e JOIN public.organization o ON o.id=e."organizationId"
  JOIN public.contest c ON c.id=e."contestId" AND c."organizationId"=e."organizationId"
  JOIN public.edition_revision r ON r."editionId"=e.id AND r."organizationId"=e."organizationId" AND r.version=e.version
  WHERE e.status='published' AND o.status='active' ORDER BY e."createdAt" DESC LIMIT 100
$$;
DROP FUNCTION own_registration_catalog(text);
CREATE FUNCTION own_registration_catalog(target_registration text DEFAULT NULL) RETURNS TABLE (
  id text,"organizationId" text,"editionId" text,"editionName" text,"contestName" text,status text,"updatedAt" timestamp(3),
  "contestId" text,"coverVersion" text,"organizationName" text,"closesAt" text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT r.id,r."organizationId",r."editionId",r."configurationSnapshot"->>'name',r."contestName",r.status,r."updatedAt",
    c.id,c."coverVersion",r."organizationName",r."configurationSnapshot"->>'closesAt'
  FROM public.registration r JOIN public.person p ON p.id=r."personId"
  JOIN public.edition e ON e.id=r."editionId" AND e."organizationId"=r."organizationId"
  JOIN public.contest c ON c.id=e."contestId" AND c."organizationId"=r."organizationId"
  WHERE p."userId"=nullif(current_setting('app.user_id',true),'') AND (target_registration IS NULL OR r.id=target_registration)
  ORDER BY r."createdAt" DESC LIMIT 100
$$;
CREATE FUNCTION visible_contest_cover(target_id text) RETURNS TABLE (data bytea,version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT c."coverData",c."coverVersion" FROM public.contest c
  WHERE c.id=target_id AND c."coverData" IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.edition e JOIN public.organization o ON o.id=e."organizationId"
      WHERE e."contestId"=c.id AND e."organizationId"=c."organizationId" AND e.status='published' AND o.status='active')
    OR EXISTS(SELECT 1 FROM public.registration r JOIN public.person p ON p.id=r."personId"
      JOIN public.edition e ON e.id=r."editionId" AND e."organizationId"=r."organizationId"
      WHERE e."contestId"=c.id AND e."organizationId"=c."organizationId" AND p."userId"=nullif(current_setting('app.user_id',true),''))
  )
$$;
REVOKE ALL ON FUNCTION published_edition_catalog(),own_registration_catalog(text),visible_contest_cover(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION published_edition_catalog(),own_registration_catalog(text),visible_contest_cover(text) TO lumio_app;
