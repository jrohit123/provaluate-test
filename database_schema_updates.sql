-- Database Schema Updates for Plan-based CV Processing Limits and Payment Tracking

-- 1. Add CV processing counter to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS cv_processed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cv_processing_reset_date TIMESTAMP DEFAULT NOW();

-- 2. Create company_usage_tracking table for detailed usage tracking
CREATE TABLE IF NOT EXISTS company_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    usage_type VARCHAR(50) NOT NULL, -- 'cv_processing', 'user_creation', etc.
    usage_count INTEGER DEFAULT 1,
    usage_date TIMESTAMP DEFAULT NOW(),
    metadata JSONB, -- Additional usage details
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create subscription_payments table for payment tracking
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(plan_id),
    payment_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(255),
    payment_date TIMESTAMP,
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly'
    metadata JSONB, -- Additional payment details
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create subscription_history table for plan changes and renewals
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(plan_id),
    action_type VARCHAR(50) NOT NULL, -- 'upgrade', 'downgrade', 'renewal', 'cancellation'
    previous_plan_id UUID REFERENCES plans(plan_id),
    effective_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_usage_tracking_company_id ON company_usage_tracking(company_id);
CREATE INDEX IF NOT EXISTS idx_company_usage_tracking_usage_date ON company_usage_tracking(usage_date);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_company_id ON subscription_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_payment_date ON subscription_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_subscription_history_company_id ON subscription_history(company_id);

-- 6. Add RLS (Row Level Security) policies
ALTER TABLE company_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_usage_tracking
CREATE POLICY "Users can view their company's usage tracking" ON company_usage_tracking
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert usage tracking for their company" ON company_usage_tracking
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE user_id = auth.uid()
        )
    );

-- RLS policies for subscription_payments
CREATE POLICY "Users can view their company's payments" ON subscription_payments
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert payments for their company" ON subscription_payments
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE user_id = auth.uid()
        )
    );

-- RLS policies for subscription_history
CREATE POLICY "Users can view their company's subscription history" ON subscription_history
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert subscription history for their company" ON subscription_history
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE user_id = auth.uid()
        )
    );

-- 7. Create function to reset CV processing count monthly
CREATE OR REPLACE FUNCTION reset_monthly_cv_count()
RETURNS void AS $$
BEGIN
    UPDATE companies 
    SET 
        cv_processed_count = 0,
        cv_processing_reset_date = NOW()
    WHERE 
        cv_processing_reset_date < NOW() - INTERVAL '1 month'
        OR cv_processing_reset_date IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to check if company can process more CVs
CREATE OR REPLACE FUNCTION can_process_cv(company_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    max_cvs INTEGER;
    company_plan VARCHAR;
BEGIN
    -- Get company's current plan and CV count
    SELECT 
        c.cv_processed_count,
        p.max_cvs,
        c.selected_plan
    INTO current_count, max_cvs, company_plan
    FROM companies c
    LEFT JOIN plans p ON p.plan_name = c.selected_plan
    WHERE c.company_id = company_uuid;
    
    -- If no plan or max_cvs is null, allow processing (unlimited)
    IF company_plan IS NULL OR max_cvs IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if current count is less than max
    RETURN current_count < max_cvs;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to increment CV processing count
CREATE OR REPLACE FUNCTION increment_cv_count(company_uuid UUID)
RETURNS void AS $$
BEGIN
    -- Update company's CV count
    UPDATE companies 
    SET cv_processed_count = cv_processed_count + 1
    WHERE company_id = company_uuid;
    
    -- Insert usage tracking record
    INSERT INTO company_usage_tracking (company_id, usage_type, usage_count)
    VALUES (company_uuid, 'cv_processing', 1);
    
    -- Reset monthly count if needed
    PERFORM reset_monthly_cv_count();
END;
$$ LANGUAGE plpgsql;

