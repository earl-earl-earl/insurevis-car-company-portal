-- Web Portal Tables for Supabase
-- Add these tables to your existing Supabase database

-- Table for document verifications
CREATE TABLE IF NOT EXISTS public.document_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_id VARCHAR UNIQUE NOT NULL,
  vin VARCHAR NOT NULL,
  document_type VARCHAR NOT NULL,
  assessment_id VARCHAR,
  file_path VARCHAR NOT NULL,
  file_name VARCHAR NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR NOT NULL,
  is_valid BOOLEAN NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('VERIFIED', 'REJECTED', 'PENDING')),
  confidence DECIMAL(5,2),
  details TEXT,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for assessment validations  
CREATE TABLE IF NOT EXISTS public.assessment_validations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_id VARCHAR UNIQUE NOT NULL,
  vin VARCHAR NOT NULL,
  assessment_data JSONB NOT NULL,
  image_count INTEGER DEFAULT 0,
  uploaded_images JSONB DEFAULT '[]'::jsonb,
  assessment_valid BOOLEAN NOT NULL,
  confidence DECIMAL(5,2),
  recommended_action VARCHAR NOT NULL CHECK (recommended_action IN ('PROCEED_WITH_CLAIM', 'REQUIRE_INSPECTION', 'REJECT_CLAIM')),
  manufacturer_notes TEXT,
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_verifications_vin ON public.document_verifications(vin);
CREATE INDEX IF NOT EXISTS idx_document_verifications_verification_id ON public.document_verifications(verification_id);
CREATE INDEX IF NOT EXISTS idx_document_verifications_status ON public.document_verifications(status);
CREATE INDEX IF NOT EXISTS idx_document_verifications_created_at ON public.document_verifications(created_at);

CREATE INDEX IF NOT EXISTS idx_assessment_validations_vin ON public.assessment_validations(vin);
CREATE INDEX IF NOT EXISTS idx_assessment_validations_validation_id ON public.assessment_validations(validation_id);
CREATE INDEX IF NOT EXISTS idx_assessment_validations_assessment_valid ON public.assessment_validations(assessment_valid);
CREATE INDEX IF NOT EXISTS idx_assessment_validations_created_at ON public.assessment_validations(created_at);

-- Enable Row Level Security (optional - adjust based on your needs)
ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_validations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is from external car company portal)
-- You may want to restrict these based on your security requirements
CREATE POLICY "Allow public read access to document verifications" ON public.document_verifications
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to document verifications" ON public.document_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to assessment validations" ON public.assessment_validations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to assessment validations" ON public.assessment_validations
  FOR INSERT WITH CHECK (true);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_document_verifications_updated_at
  BEFORE UPDATE ON public.document_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_validations_updated_at
  BEFORE UPDATE ON public.assessment_validations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view for document verification statistics
CREATE OR REPLACE VIEW public.document_verification_stats AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_verifications,
  COUNT(*) FILTER (WHERE status = 'VERIFIED') as verified_count,
  COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_count,
  AVG(confidence) FILTER (WHERE status = 'VERIFIED') as avg_confidence_verified,
  AVG(confidence) FILTER (WHERE status = 'REJECTED') as avg_confidence_rejected
FROM public.document_verifications
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Create a view for assessment validation statistics
CREATE OR REPLACE VIEW public.assessment_validation_stats AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_assessments,
  COUNT(*) FILTER (WHERE assessment_valid = true) as valid_assessments,
  COUNT(*) FILTER (WHERE assessment_valid = false) as invalid_assessments,
  AVG(confidence) as avg_confidence,
  AVG(image_count) as avg_images_per_assessment
FROM public.assessment_validations
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
