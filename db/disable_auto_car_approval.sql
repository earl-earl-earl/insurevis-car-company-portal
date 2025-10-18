-- Disable automatic car-company/insurance approval flips based on document verification
-- and make is_successful depend on manual approvals only.

CREATE OR REPLACE FUNCTION update_claim_approval_status()
RETURNS TRIGGER AS $$
DECLARE
    car_company_doc_types TEXT[] := ARRAY['lto_or', 'lto_cr', 'drivers_license', 'owner_valid_id', 'stencil_strips', 'damage_photos', 'job_estimate'];
    insurance_doc_types   TEXT[] := ARRAY['police_report', 'insurance_policy', 'drivers_license', 'owner_valid_id', 'job_estimate', 'damage_photos', 'lto_or', 'lto_cr', 'additional_documents'];

    car_company_docs_count INTEGER;
    car_company_verified_count INTEGER;
    insurance_docs_count INTEGER;
    insurance_verified_count INTEGER;

    claim_record RECORD;
BEGIN
    -- Identify claim on which the document change happened
    IF TG_OP = 'DELETE' THEN
        claim_record := OLD;
    ELSE
        claim_record := NEW;
    END IF;

    -- Optional: Keep counting for analytics/visibility (not used to flip approvals anymore)
    SELECT COUNT(*), COUNT(*) FILTER (WHERE verified_by_car_company = true)
      INTO car_company_docs_count, car_company_verified_count
      FROM public.documents
     WHERE claim_id = claim_record.claim_id
       AND type = ANY(car_company_doc_types);

    SELECT COUNT(*), COUNT(*) FILTER (WHERE verified_by_insurance_company = true)
      INTO insurance_docs_count, insurance_verified_count
      FROM public.documents
     WHERE claim_id = claim_record.claim_id
       AND type = ANY(insurance_doc_types);

    -- DO NOT auto-set is_approved_by_car_company or is_approved_by_insurance_company here.
    -- Those should be controlled manually via the app's Approve actions.
    -- Derive final success strictly from manual approvals.
    UPDATE public.claims
       SET is_successful = (is_approved_by_car_company AND is_approved_by_insurance_company),
           updated_at    = NOW()
     WHERE id = claim_record.claim_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;