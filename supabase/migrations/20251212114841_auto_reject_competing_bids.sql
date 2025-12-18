/*
  # Auto-reject Competing Bids

  1. Changes
    - Creates a trigger that automatically rejects competing bids when one bid is accepted
    - When a bid status changes to 'accepted', all other bids with the same bid_type for that request are set to 'rejected'
    - This ensures only one bid per type (quote, diagnostic_service, info_request) can be accepted

  2. Logic
    - Trigger fires on UPDATE of technical_service_bids table
    - Only acts when status changes to 'accepted'
    - Rejects all other bids with same request_id and bid_type
*/

-- Function to auto-reject competing bids
CREATE OR REPLACE FUNCTION auto_reject_competing_bids()
RETURNS TRIGGER AS $$
BEGIN
  -- If a bid is accepted, reject all other bids with the same bid_type for that request
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    UPDATE technical_service_bids
    SET status = 'rejected'
    WHERE request_id = NEW.request_id
      AND bid_type = NEW.bid_type
      AND id != NEW.id
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_reject_competing_bids ON technical_service_bids;
CREATE TRIGGER trigger_auto_reject_competing_bids
  AFTER UPDATE ON technical_service_bids
  FOR EACH ROW
  EXECUTE FUNCTION auto_reject_competing_bids();

-- Fix existing data: reject pending bids where another bid of same type was accepted
UPDATE technical_service_bids tsb1
SET status = 'rejected'
WHERE status = 'pending'
  AND EXISTS (
    SELECT 1 
    FROM technical_service_bids tsb2 
    WHERE tsb2.request_id = tsb1.request_id 
      AND tsb2.bid_type = tsb1.bid_type
      AND tsb2.id != tsb1.id
      AND tsb2.status = 'accepted'
  );
