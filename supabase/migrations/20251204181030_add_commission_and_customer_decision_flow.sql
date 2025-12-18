/*
  # Add Commission Rate and Customer Decision Flow

  ## Changes

  1. Tables Modified
    - `companies`
      - Add `commission_rate` (numeric, default 0, e.g., 0.15 for 15%)
      - This is the commission percentage added to technical service bids
    
    - `technical_service_requests`
      - Add `diagnostic_report` (text, nullable) - Report from diagnostic service
      - Add `customer_additional_info` (text, nullable) - Info provided by customer after info_request
      - Add `selected_bid_id` (uuid, foreign key to technical_service_bids) - Which bid customer selected

  2. Enums Updated
    - `technical_service_request_status` - Add new statuses:
      - `awaiting_customer_decision`: Bids collected, waiting for customer to choose
      - `diagnostic_in_progress`: Diagnostic service being performed
      - `awaiting_additional_info`: Waiting for customer to provide requested information

  3. Workflow
    - After bids collected → status changes to `awaiting_customer_decision`
    - Customer can:
      1. Accept a bid → status to `approved`
      2. Provide additional info → status to `awaiting_additional_info`, then back to `bidding`
      3. Request diagnostic service → status to `diagnostic_in_progress`, then back to `bidding`

  4. Notes
    - Commission rate applied to all bid amounts shown to customer
    - Same commission rate used for standard quotes and diagnostic services
    - Diagnostic report stored in technical_service_requests for reference
*/

-- Add new statuses to technical_service_request_status enum
ALTER TYPE technical_service_request_status ADD VALUE IF NOT EXISTS 'awaiting_customer_decision';
ALTER TYPE technical_service_request_status ADD VALUE IF NOT EXISTS 'diagnostic_in_progress';
ALTER TYPE technical_service_request_status ADD VALUE IF NOT EXISTS 'awaiting_additional_info';

-- Add commission_rate to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE companies 
    ADD COLUMN commission_rate NUMERIC(5,4) DEFAULT 0 NOT NULL;
    
    -- Add comment explaining the column
    COMMENT ON COLUMN companies.commission_rate IS 'Commission percentage (e.g., 0.15 for 15%) applied to technical service bids';
  END IF;
END $$;

-- Add diagnostic_report to technical_service_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'diagnostic_report'
  ) THEN
    ALTER TABLE technical_service_requests 
    ADD COLUMN diagnostic_report TEXT;
    
    COMMENT ON COLUMN technical_service_requests.diagnostic_report IS 'Report from diagnostic service if customer chose diagnostic option';
  END IF;
END $$;

-- Add customer_additional_info to technical_service_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'customer_additional_info'
  ) THEN
    ALTER TABLE technical_service_requests 
    ADD COLUMN customer_additional_info TEXT;
    
    COMMENT ON COLUMN technical_service_requests.customer_additional_info IS 'Additional information provided by customer after info_request';
  END IF;
END $$;

-- Add selected_bid_id to technical_service_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'selected_bid_id'
  ) THEN
    ALTER TABLE technical_service_requests 
    ADD COLUMN selected_bid_id UUID REFERENCES technical_service_bids(id);
    
    COMMENT ON COLUMN technical_service_requests.selected_bid_id IS 'The bid selected by customer';
  END IF;
END $$;

-- Add index for selected_bid_id
CREATE INDEX IF NOT EXISTS idx_tech_requests_selected_bid 
ON technical_service_requests(selected_bid_id);
