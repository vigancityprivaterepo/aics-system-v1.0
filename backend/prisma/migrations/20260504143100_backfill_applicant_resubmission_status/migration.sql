UPDATE "applicant_applications"
SET "status" = 'resubmission_required'
WHERE COALESCE("metadata"->>'portalWorkflowStatus', '') = 'resubmission_required'
  AND "status" = 'under_review';
