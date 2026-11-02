-- Select before limiting: the newest 100 catalog rows may omit older deadlines.
CREATE FUNCTION closing_edition_catalog() RETURNS TABLE (
  "editionId" text,"organizationName" text,"contestName" text,name text,"opensAt" text,"closesAt" text,"contestId" text,"coverVersion" text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT x.id,x.organization_name,x.contest_name,x.edition_name,x.opens_at,x.closes_at,x.contest_id,x.cover_version
  FROM (
    SELECT DISTINCT ON (c.id) e.id,o.name AS organization_name,c.name AS contest_name,e.name AS edition_name,
      r.configuration->>'opensAt' AS opens_at,r.configuration->>'closesAt' AS closes_at,c.id AS contest_id,c."coverVersion" AS cover_version
    FROM public.edition e JOIN public.organization o ON o.id=e."organizationId"
    JOIN public.contest c ON c.id=e."contestId" AND c."organizationId"=e."organizationId"
    JOIN public.edition_revision r ON r."editionId"=e.id AND r."organizationId"=e."organizationId" AND r.version=e.version
    WHERE e.status='published' AND o.status='active'
      AND (r.configuration->>'opensAt')::timestamptz <= CURRENT_TIMESTAMP
      AND (r.configuration->>'closesAt')::timestamptz > CURRENT_TIMESTAMP
    ORDER BY c.id,(r.configuration->>'closesAt')::timestamptz,e.id
  ) x ORDER BY x.closes_at::timestamptz,x.id LIMIT 5
$$;
REVOKE ALL ON FUNCTION closing_edition_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION closing_edition_catalog() TO lumio_app;
