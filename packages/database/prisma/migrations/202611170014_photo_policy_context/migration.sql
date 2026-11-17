-- Narrow read capability for the assigned pending photo revision. No personal
-- data, mutable edition data, additional table grants or changes to media_guard.
CREATE FUNCTION photo_policy_context(revision_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'sectionCode', e."sectionCode",
    'regulatoryProfile', r."configurationSnapshot"->'regulatoryProfile',
    'regulatoryPhotoPolicy', r."configurationSnapshot"->'regulatoryPhotoPolicy',
    'regulatorySections', CASE WHEN r."configurationSnapshot" ? 'regulatorySections' THEN
      jsonb_build_object(
        'profileId', r."configurationSnapshot"->'regulatorySections'->'profileId',
        'sections', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'sectionCode', s->>'sectionCode', 'sectionType', s->>'sectionType'))
          FROM jsonb_array_elements(r."configurationSnapshot"->'regulatorySections'->'sections') s
          WHERE s->>'sectionCode'=e."sectionCode"), '[]'::jsonb))
      ELSE NULL END))
  FROM public.photo_revision pr
  JOIN public.photo_processing pp ON pp."revisionId"=pr.id AND pp."organizationId"=pr."organizationId"
  JOIN public.photo p ON p.id=pr."photoId" AND p."organizationId"=pr."organizationId" AND p."registrationId"=pr."registrationId"
  JOIN public.entry e ON e.id=p."entryId" AND e."organizationId"=p."organizationId" AND e."registrationId"=p."registrationId"
  JOIN public.registration r ON r.id=pr."registrationId" AND r."organizationId"=pr."organizationId"
  WHERE pr.id=revision_id
    AND pr.id=nullif(current_setting('app.photo_revision_id',true),'')
    AND pr."organizationId"=nullif(current_setting('app.organization_id',true),'')
    AND pp.status='pending'
$$;
REVOKE ALL ON FUNCTION photo_policy_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION photo_policy_context(text) TO lumio_worker;
