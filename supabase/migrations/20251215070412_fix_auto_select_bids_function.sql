/*
  # Fix Auto Select Bids Function

  ## Changes
  - Fix column name: proposed_price → bid_amount
  - Fix bid_type: diagnostic → diagnostic_service
  - Fix status check: submitted → pending (or NOT IN rejected/withdrawn)
*/

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
    AND status NOT IN ('rejected', 'withdrawn')
    AND bid_amount IS NOT NULL
  ORDER BY bid_amount ASC NULLS LAST, created_at ASC
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
    AND status NOT IN ('rejected', 'withdrawn');

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
    AND bid_type = 'diagnostic_service'
    AND status NOT IN ('rejected', 'withdrawn')
    AND bid_amount IS NOT NULL
  ORDER BY bid_amount ASC NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_lowest_diagnostic_id IS NOT NULL THEN
    UPDATE technical_service_bids
    SET selected_for_customer = true,
        shown_to_customer_at = NOW()
    WHERE id = v_lowest_diagnostic_id;

    RETURN QUERY SELECT 'diagnostic_service'::TEXT, v_lowest_diagnostic_id, false, 1;
  END IF;

  RETURN;
END;
$$;