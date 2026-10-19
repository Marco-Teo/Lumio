-- A tenant identifier alone never grants access; bind reads to membership too.
DROP POLICY organization_scope ON organization;
CREATE POLICY organization_scope ON organization TO lumio_app USING (
  id = nullif(current_setting('app.organization_id', true), '')
  AND EXISTS (SELECT 1 FROM organization_membership m WHERE m."organizationId" = organization.id AND m."userId" = nullif(current_setting('app.user_id', true), ''))
);

DROP POLICY audit_scope ON audit_event;
CREATE POLICY audit_scope ON audit_event TO lumio_app USING (
  "organizationId" = nullif(current_setting('app.organization_id', true), '')
  AND EXISTS (SELECT 1 FROM organization_membership m WHERE m."organizationId" = audit_event."organizationId" AND m."userId" = nullif(current_setting('app.user_id', true), ''))
) WITH CHECK (
  "organizationId" = nullif(current_setting('app.organization_id', true), '')
  AND "actorUserId" = nullif(current_setting('app.user_id', true), '')
  AND EXISTS (SELECT 1 FROM organization_membership m WHERE m.id = "actorMembershipId" AND m."userId" = nullif(current_setting('app.user_id', true), ''))
);
