/*
  # Auto Bid Selection for Customer Decision

  ## Overview
  This migration implements automatic bid selection system where customers see 
  only anonymized, pre-selected bids to prevent fraud.

  ## Changes

  1. Tables Modified
    - `technical_service_bids`
      - Add `selected_for_customer` (boolean) - System/admin selected this bid for customer
      - Add `is_combined_info_request` (boolean) - This is a combined info request package
      - Add `combined_from_bid_ids` (uuid[]) - Original bid IDs if this is combined
      - Add `customer_approved` (boolean) - Customer chose this bid
      - Add `shown_to_customer_at` (timestamptz) - When shown to customer

  2. Functions Created
    - `auto_select_bids_for_customer(request_id)` - Automatically selects best bids:
      * Lowest price QUOTE bid
      * All INFO_REQUEST bids combined into one package
      * Lowest price DIAGNOSTIC bid

  3. Workflow
    - Manager reviews bids → calls auto_select function
    - System selects 1 of each type (if available)
    - Customer sees max 3 anonymized options
    - Customer selects 1 option
    - Selected company info is revealed

  4. Fraud Prevention
    - Company names hidden until customer decision
    - Automatic selection prevents bias
    - Single choice prevents comparison shopping
    - Future: Rating system to filter low-quality companies
*/

-- Add new columns to technical_service_bids
DO $$
BEGIN
  -- Selected for customer
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_bids' AND column_name = 'selected_for_customer'
  ) THEN
    ALTER TABLE technical_service_bids 
    ADD COLUMN selected_for_customer BOOLEAN DEFAULT false NOT NULL;
    
    COMMENT ON COLUMN technical_service_bids.selected_for_customer IS 
      'System/admin selected this bid to show to customer (max 1 per bid_type)';
  END IF;

  -- Is combined info request
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_bids' AND column_name = 'is_combined_info_request'
  ) THEN
    ALTER TABLE technical_service_bids 
    ADD COLUMN is_combined_info_request BOOLEAN DEFAULT false NOT NULL;
    
    COMMENT ON COLUMN technical_service_bids.is_combined_info_request IS 
      'True if this bid represents combined info_request bids from multiple companies';
  END IF;

  -- Combined from bid IDs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_bids' AND column_name = 'combined_from_bid_ids'
  ) THEN
    ALTER TABLE technical_service_bids 
    ADD COLUMN combined_from_bid_ids UUID[];
    
    COMMENT ON COLUMN technical_service_bids.combined_from_bid_ids IS 
      'Original bid IDs if this is a combined info_request package';
  END IF;

  -- Customer approved
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_bids' AND column_name = 'customer_approved'
  ) THEN
    ALTER TABLE technical_service_bids 
    ADD COLUMN customer_approved BOOLEAN DEFAULT false NOT NULL;
    
    COMMENT ON COLUMN technical_service_bids.customer_approved IS 
      'True if customer selected this bid';
  END IF;

  -- Shown to customer timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_bids' AND column_name = 'shown_to_customer_at'
  ) THEN
    ALTER TABLE technical_service_bids 
    ADD COLUMN shown_to_customer_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN technical_service_bids.shown_to_customer_at IS 
      'Timestamp when this bid was shown to customer';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bids_selected_for_customer 
ON technical_service_bids(request_id, selected_for_customer) 
WHERE selected_for_customer = true;

CREATE INDEX IF NOT EXISTS idx_bids_customer_approved 
ON technical_service_bids(request_id, customer_approved) 
WHERE customer_approved = true;

-- Function to auto-select best bids for customer
CREATE OR REPLACE FUNCTION auto_select_bids_for_customer(p_request_id UUID)
RETURNS TABLE(
  bid_type TEXT,
  selected_bid_id UUID,
  is_combined BOOLEAN,
  combined_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lowest_quote_id UUID;
  v_lowest_diagnostic_id UUID;
  v_info_request_ids UUID[];
  v_combined_bid_id UUID;
BEGIN
  -- Reset previous selections for this request
  UPDATE technical_service_bids
  SET selected_for_customer = false,
      shown_to_customer_at = NULL
  WHERE request_id = p_request_id;

  -- 1. Select LOWEST PRICE QUOTE
  SELECT id INTO v_lowest_quote_id
  FROM technical_service_bids
  WHERE request_id = p_request_id
    AND bid_type = 'quote'
    AND status = 'submitted'
  ORDER BY proposed_price ASC NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_lowest_quote_id IS NOT NULL THEN
    UPDATE technical_service_bids
    SET selected_for_customer = true,
        shown_to_customer_at = NOW()
    WHERE id = v_lowest_quote_id;

    RETURN QUERY SELECT 'quote'::TEXT, v_lowest_quote_id, false, 1;
  END IF;

  -- 2. Combine ALL INFO_REQUEST bids into one package
  SELECT ARRAY_AGG(id) INTO v_info_request_ids
  FROM technical_service_bids
  WHERE request_id = p_request_id
    AND bid_type = 'info_request'
    AND status = 'submitted';

  IF v_info_request_ids IS NOT NULL AND array_length(v_info_request_ids, 1) > 0 THEN
    -- Create a virtual combined bid (we'll mark one as combined)
    -- Pick the first one and mark it as combined package
    v_combined_bid_id := v_info_request_ids[1];
    
    UPDATE technical_service_bids
    SET selected_for_customer = true,
        is_combined_info_request = true,
        combined_from_bid_ids = v_info_request_ids,
        shown_to_customer_at = NOW()
    WHERE id = v_combined_bid_id;

    RETURN QUERY SELECT 
      'info_request'::TEXT, 
      v_combined_bid_id, 
      true, 
      array_length(v_info_request_ids, 1);
  END IF;

  -- 3. Select LOWEST PRICE DIAGNOSTIC
  SELECT id INTO v_lowest_diagnostic_id
  FROM technical_service_bids
  WHERE request_id = p_request_id
    AND bid_type = 'diagnostic'
    AND status = 'submitted'
  ORDER BY proposed_price ASC NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_lowest_diagnostic_id IS NOT NULL THEN
    UPDATE technical_service_bids
    SET selected_for_customer = true,
        shown_to_customer_at = NOW()
    WHERE id = v_lowest_diagnostic_id;

    RETURN QUERY SELECT 'diagnostic'::TEXT, v_lowest_diagnostic_id, false, 1;
  END IF;

  RETURN;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auto_select_bids_for_customer TO authenticated;

-- Add RLS policies for customer viewing selected bids (anonymized)
CREATE POLICY "Project managers can view selected bids for customer decision"
  ON technical_service_bids FOR SELECT
  TO authenticated
  USING (
    selected_for_customer = true
    AND EXISTS (
      SELECT 1 FROM technical_service_requests tsr
      JOIN projects_greenco p ON p.id = tsr.project_id
      JOIN project_managers pm ON pm.project_id = p.id
      WHERE tsr.id = technical_service_bids.request_id
        AND pm.manager_id = auth.uid()
    )
  );
