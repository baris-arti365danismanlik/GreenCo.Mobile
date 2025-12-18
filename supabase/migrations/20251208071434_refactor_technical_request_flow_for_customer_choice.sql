/*
  # Refactor Technical Request Flow for Customer Choice

  ## Overview
  Müşteri merkezli karar akışı. Sistem öneri yapmaz, sadece seçenekleri sunar.

  ## Changes

  1. **Tables Modified**
    - `technical_service_bids`
      - Add `bid_round` (integer, default 1) - Hangi tur teklif (1: ilk tur, 2+: ek bilgi/tanı sonrası)
      - İlk turda (round 1): 3 seçenek mevcut (quote, diagnostic_service, info_request)
      - Sonraki turlarda (round 2+): sadece quote verebilirler
    
    - `technical_service_requests`
      - Add `current_bid_round` (integer, default 1) - Şu anki teklif turu
      - Add `bid_deadline` (timestamptz) - Teklif verme son tarihi

  2. **Status Flow**
    - `pending_review` → Talep oluşturuldu, admin/manager inceliyor
    - `bidding` → Teklifler toplanıyor (technical companies teklif veriyor)
    - `awaiting_customer_decision` → Teklifler toplandı, müşteri (manager/operations) seçim yapıyor
    - `awaiting_additional_info` → Müşteri ek bilgi seçeneğini seçti, bilgi sağlanıyor
    - `diagnostic_in_progress` → Müşteri tanı servisi seçti, tanı yapılıyor
    - `approved` → Müşteri tamir teklifini seçti, onaylandı
    - `in_progress` → İş yapılıyor
    - `completed` → Tamamlandı
    - `cancelled` → İptal edildi

  3. **Workflow**
    
    **İlk Tur (bid_round = 1):**
    1. Müşteri talep oluşturur → `pending_review`
    2. Manager/Admin "Teklifleri Toplayın" → `bidding`
    3. Technical companies 3 seçenekten birini verir:
       - Tamir Teklifi (quote)
       - Tanı Servisi (diagnostic_service)
       - Ek Bilgi Talebi (info_request)
    4. Manager/Admin "Teklif Aşamasını Sonlandır" → `awaiting_customer_decision`
    5. Müşteri görür: (varsa) en iyi teklif, (varsa) en iyi servis, (varsa) konsolide ek bilgi
    
    **Müşteri Seçimi:**
    - **a) Tamir Teklifi seçtiyse** → `approved` → İş yapılır
    - **b) Ek Bilgi seçtiyse** → `awaiting_additional_info` → Bilgi sağlanır → Tekrar `bidding` (round 2, sadece quote)
    - **c) Tanı Servisi seçtiyse** → `diagnostic_in_progress` → Tanı yapılır → Rapor verilir → Tekrar `bidding` (round 2, sadece quote)

  4. **Constraints**
    - İlk turda (round 1): bid_type = 'quote' OR 'diagnostic_service' OR 'info_request'
    - Sonraki turlarda (round 2+): bid_type = 'quote' only

  5. **Notes**
    - Sistem asla karar vermez, sadece seçenekleri düzenler ve sunar
    - Müşteri her zaman seçim yapar
    - Ek bilgi/tanı sonrası teklifler sadece tamir teklifi (quote) olabilir
*/

-- Add bid_round to technical_service_bids
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_bids' AND column_name = 'bid_round'
  ) THEN
    ALTER TABLE technical_service_bids 
    ADD COLUMN bid_round INTEGER DEFAULT 1 NOT NULL;
    
    COMMENT ON COLUMN technical_service_bids.bid_round IS 'Teklif turu: 1 = ilk tur (3 seçenek), 2+ = ek bilgi/tanı sonrası (sadece quote)';
  END IF;
END $$;

-- Add current_bid_round to technical_service_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'current_bid_round'
  ) THEN
    ALTER TABLE technical_service_requests 
    ADD COLUMN current_bid_round INTEGER DEFAULT 1 NOT NULL;
    
    COMMENT ON COLUMN technical_service_requests.current_bid_round IS 'Şu anki teklif turu';
  END IF;
END $$;

-- Add bid_deadline to technical_service_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'bid_deadline'
  ) THEN
    ALTER TABLE technical_service_requests 
    ADD COLUMN bid_deadline TIMESTAMPTZ;
    
    COMMENT ON COLUMN technical_service_requests.bid_deadline IS 'Teklif verme son tarihi';
  END IF;
END $$;

-- Add constraint: after round 1, only quote bids allowed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'only_quotes_after_first_round'
  ) THEN
    ALTER TABLE technical_service_bids
    ADD CONSTRAINT only_quotes_after_first_round
    CHECK (
      (bid_round = 1) OR
      (bid_round > 1 AND bid_type = 'quote')
    );
  END IF;
END $$;

-- Add index for bid_round
CREATE INDEX IF NOT EXISTS idx_tech_bids_round 
ON technical_service_bids(request_id, bid_round);

-- Add index for current_bid_round
CREATE INDEX IF NOT EXISTS idx_tech_requests_current_round 
ON technical_service_requests(current_bid_round);
