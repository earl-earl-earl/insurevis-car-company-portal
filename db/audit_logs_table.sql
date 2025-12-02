-- =====================================================
-- AUDIT LOG TABLE FOR CLAIM TRANSACTIONS
-- =====================================================

-- Create audit_logs table for tracking all claim-related actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Agent/User who performed the action
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_role VARCHAR(50) NOT NULL, -- Cached role for historical accuracy
    user_name VARCHAR(255), -- Cached name for historical accuracy
    
    -- Claim reference
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    claim_number VARCHAR(50) NOT NULL, -- Cached for easier reporting
    
    -- Action details
    action VARCHAR(100) NOT NULL CHECK (action IN (
        'claim_created',
        'claim_submitted',
        'claim_updated',
        'claim_approved',
        'claim_rejected',
        'document_uploaded',
        'document_verified',
        'document_rejected',
        'car_company_approval',
        'car_company_rejection',
        'insurance_company_approval',
        'insurance_company_rejection',
        'status_changed',
        'notes_added',
        'other'
    )),
    action_description TEXT, -- Additional context about the action
    
    -- Transaction details
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    outcome VARCHAR(50) CHECK (outcome IN (
        'success',
        'failure',
        'pending',
        'cancelled'
    )),
    status VARCHAR(100), -- Related status (e.g., 'approved', 'rejected', 'under_review')
    
    -- Technical details
    ip_address INET, -- IP address (nullable)
    user_agent TEXT, -- Browser/client information
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible field for extra data
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_claim_id ON public.audit_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON public.audit_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_role ON public.audit_logs(user_role);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_claim_timestamp ON public.audit_logs(claim_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON public.audit_logs(user_id, timestamp DESC);

-- =====================================================
-- AUTOMATIC AUDIT LOGGING FUNCTIONS
-- =====================================================

-- Function to automatically log claim actions
CREATE OR REPLACE FUNCTION log_claim_action()
RETURNS TRIGGER AS $$
DECLARE
    action_type VARCHAR(100);
    action_desc TEXT;
    user_rec RECORD;
    current_user_id UUID;
BEGIN
    -- Get the current authenticated user (if available)
    current_user_id := COALESCE(
        auth.uid(),
        NEW.user_id,
        (SELECT id FROM public.users LIMIT 1)
    );
    
    -- Determine action type based on trigger operation and status changes
    IF TG_OP = 'INSERT' THEN
        action_type := 'claim_created';
        action_desc := 'New claim created';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for specific status changes
        IF OLD.status != NEW.status THEN
            action_type := 'status_changed';
            action_desc := format('Status changed from %s to %s', OLD.status, NEW.status);
        ELSIF OLD.is_approved_by_car_company != NEW.is_approved_by_car_company AND NEW.is_approved_by_car_company THEN
            action_type := 'car_company_approval';
            action_desc := 'Car company approved the claim';
        ELSIF OLD.is_approved_by_insurance_company != NEW.is_approved_by_insurance_company AND NEW.is_approved_by_insurance_company THEN
            action_type := 'insurance_company_approval';
            action_desc := 'Insurance company approved the claim';
        ELSIF OLD.car_company_status != NEW.car_company_status THEN
            action_type := 'status_changed';
            action_desc := format('Car company status changed from %s to %s', 
                COALESCE(OLD.car_company_status, 'none'), 
                COALESCE(NEW.car_company_status, 'none'));
        ELSE
            action_type := 'claim_updated';
            action_desc := 'Claim details updated';
        END IF;
    END IF;
    
    -- Get user details (safely without causing RLS recursion)
    SELECT role, name INTO user_rec
    FROM public.users
    WHERE id = current_user_id;
    
    -- Insert audit log
    INSERT INTO public.audit_logs (
        user_id,
        user_role,
        user_name,
        claim_id,
        claim_number,
        action,
        action_description,
        outcome,
        status
    ) VALUES (
        current_user_id,
        COALESCE(user_rec.role, 'unknown'),
        COALESCE(user_rec.name, 'Unknown User'),
        NEW.id,
        NEW.claim_number,
        action_type,
        action_desc,
        'success',
        NEW.status
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Failed to log claim action: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log document verification actions
CREATE OR REPLACE FUNCTION log_document_action()
RETURNS TRIGGER AS $$
DECLARE
    action_type VARCHAR(100);
    action_desc TEXT;
    verifier_id UUID;
    user_rec RECORD;
    claim_rec RECORD;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'document_uploaded';
        action_desc := format('Document uploaded: %s', NEW.type);
        verifier_id := NEW.user_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for car company verification
        IF OLD.verified_by_car_company != NEW.verified_by_car_company AND NEW.verified_by_car_company THEN
            action_type := 'document_verified';
            action_desc := format('Document verified by car company: %s', NEW.type);
            verifier_id := COALESCE(NEW.car_company_verified_by, auth.uid());
        -- Check for document rejection
        ELSIF OLD.car_company_verification_notes IS NULL AND NEW.car_company_verification_notes IS NOT NULL 
              AND NOT NEW.verified_by_car_company THEN
            action_type := 'document_rejected';
            action_desc := format('Document rejected by car company: %s', NEW.type);
            verifier_id := COALESCE(NEW.car_company_verified_by, auth.uid());
        -- Check for insurance company verification
        ELSIF OLD.verified_by_insurance_company != NEW.verified_by_insurance_company AND NEW.verified_by_insurance_company THEN
            action_type := 'document_verified';
            action_desc := format('Document verified by insurance company: %s', NEW.type);
            verifier_id := COALESCE(NEW.insurance_verified_by, auth.uid());
        ELSE
            RETURN NEW; -- No verification change, skip logging
        END IF;
    ELSE
        RETURN NEW;
    END IF;
    
    -- Get claim details
    SELECT claim_number INTO claim_rec
    FROM public.claims
    WHERE id = NEW.claim_id;
    
    -- Get verifier details
    SELECT role, name INTO user_rec
    FROM public.users
    WHERE id = verifier_id;
    
    -- Insert audit log
    INSERT INTO public.audit_logs (
        user_id,
        user_role,
        user_name,
        claim_id,
        claim_number,
        action,
        action_description,
        outcome,
        metadata
    ) VALUES (
        verifier_id,
        COALESCE(user_rec.role, 'unknown'),
        COALESCE(user_rec.name, 'Unknown User'),
        NEW.claim_id,
        COALESCE(claim_rec.claim_number, 'UNKNOWN'),
        action_type,
        action_desc,
        'success',
        jsonb_build_object(
            'document_id', NEW.id,
            'document_type', NEW.type,
            'file_name', NEW.file_name
        )
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Failed to log document action: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic audit logging
DROP TRIGGER IF EXISTS trigger_audit_log_claim_actions ON public.claims;
CREATE TRIGGER trigger_audit_log_claim_actions
    AFTER INSERT OR UPDATE ON public.claims
    FOR EACH ROW
    EXECUTE FUNCTION log_claim_action();

DROP TRIGGER IF EXISTS trigger_audit_log_document_actions ON public.documents;
CREATE TRIGGER trigger_audit_log_document_actions
    AFTER INSERT OR UPDATE OF verified_by_car_company, verified_by_insurance_company, car_company_verification_notes ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION log_document_action();

-- =====================================================
-- ROW LEVEL SECURITY FOR AUDIT LOGS
-- =====================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "audit_logs_admin_view_all" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Users can view audit logs for their own claims
CREATE POLICY "audit_logs_users_view_own" ON public.audit_logs
    FOR SELECT USING (
        user_id = auth.uid() OR
        claim_id IN (SELECT id FROM public.claims WHERE user_id = auth.uid())
    );

-- Car companies can view all audit logs (they review claims)
CREATE POLICY "audit_logs_car_company_view" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'car_company'
        )
    );

-- Insurance companies can view all audit logs (they review claims)
CREATE POLICY "audit_logs_insurance_company_view" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'insurance_company'
        )
    );

-- =====================================================
-- HELPFUL VIEWS FOR AUDIT REPORTING
-- =====================================================

-- View for recent audit activities
CREATE OR REPLACE VIEW recent_audit_activities AS
SELECT 
    al.*,
    u.email as user_email,
    c.status as current_claim_status,
    c.incident_date
FROM public.audit_logs al
LEFT JOIN public.users u ON al.user_id = u.id
LEFT JOIN public.claims c ON al.claim_id = c.id
ORDER BY al.timestamp DESC;

-- View for audit summary by claim
CREATE OR REPLACE VIEW audit_summary_by_claim AS
SELECT 
    claim_id,
    claim_number,
    COUNT(*) as total_actions,
    COUNT(DISTINCT user_id) as unique_actors,
    MIN(timestamp) as first_action,
    MAX(timestamp) as last_action,
    COUNT(*) FILTER (WHERE action LIKE '%approval%') as approval_actions,
    COUNT(*) FILTER (WHERE action LIKE '%verified%') as verification_actions
FROM public.audit_logs
GROUP BY claim_id, claim_number;

-- Analyze table for query optimization
ANALYZE public.audit_logs;

-- Grant necessary permissions
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON recent_audit_activities TO authenticated;
GRANT SELECT ON audit_summary_by_claim TO authenticated;
