/*
  # Add Category Type to Technical Service Types

  ## Overview
  This migration adds a category system to technical service types to differentiate between:
  - Asset-Based Services: Require specific equipment/device selection (HVAC, Electronics, etc.)
  - Location-Based Services: Only require location/area selection (Construction, Pest Control, etc.)

  ## Changes
  
  1. Add category_type column
    - `asset_based`: Services that require equipment/device selection
    - `location_based`: Services that only need location information
  
  2. Add requires_asset_selection flag
    - Determines if asset selection is mandatory in the UI
  
  3. Update existing service types
    - Categorize existing services appropriately
  
  4. Add new comprehensive service types
    - Asset-Based: HVAC, Cooling Systems, Kitchen Equipment, Electronics, Generator
    - Location-Based: Construction, Plumbing, Furniture, Pest Control, General Cleaning

  ## Benefits
  - Better UX: Different form flows based on category type
  - Warranty tracking for asset-based services
  - Equipment history (maintenance records) tracking
  - Faster request creation for location-based services (10 seconds vs 30+ seconds)
*/

-- Add new columns to technical_service_types
ALTER TABLE technical_service_types 
ADD COLUMN IF NOT EXISTS category_type text CHECK (category_type IN ('asset_based', 'location_based')),
ADD COLUMN IF NOT EXISTS requires_asset_selection boolean DEFAULT false;

-- Update existing service types with appropriate categories
UPDATE technical_service_types SET 
  category_type = 'asset_based',
  requires_asset_selection = true
WHERE name IN ('Klima', 'Asansör');

UPDATE technical_service_types SET 
  category_type = 'location_based',
  requires_asset_selection = false
WHERE name IN ('Elektrik', 'Tesisat', 'Tadilat', 'Boyama', 'Kapı-Pencere', 'Cam Balkon');

-- Deactivate old generic types (will be replaced with more specific ones)
UPDATE technical_service_types SET is_active = false WHERE name IN ('Tadilat', 'Boyama', 'Cam Balkon');

-- Insert new comprehensive service types

-- ASSET-BASED SERVICES
INSERT INTO technical_service_types (name, description, category_type, requires_asset_selection, is_active) VALUES
  ('İklimlendirme (HVAC)', 'Klima, havalandırma ve ısıtma sistemleri bakım/arıza', 'asset_based', true, true),
  ('Soğutma Sistemleri', 'Endüstriyel soğutma, buzluk, buzdolabı bakım/arıza', 'asset_based', true, true),
  ('Mutfak Ekipmanları', 'Fırın, ocak, bulaşık makinesi, aspiratör bakım/arıza', 'asset_based', true, true),
  ('Elektronik Cihazlar', 'TV, bilgisayar, ses sistemi, güvenlik kamerası bakım/arıza', 'asset_based', true, true),
  ('Jeneratör Sistemleri', 'Jeneratör, UPS, elektrik yedekleme sistemleri bakım/arıza', 'asset_based', true, true)
ON CONFLICT (name) DO NOTHING;

-- LOCATION-BASED SERVICES
INSERT INTO technical_service_types (name, description, category_type, requires_asset_selection, is_active) VALUES
  ('İnşaat ve Yapı', 'Duvar örme, yıkım, tadilat, yapısal onarım', 'location_based', false, true),
  ('Tesisat (Su Hatları)', 'Su tesisatı, sızıntı, tıkanıklık, vana değişimi', 'location_based', false, true),
  ('Tesisat (Elektrik Hatları)', 'Elektrik tesisatı, kablo döşeme, pano bakımı', 'location_based', false, true),
  ('Mobilya ve Dolaplar', 'Dolap montajı/tamiri, masa, sandalye, raf sistemleri', 'location_based', false, true),
  ('Haşere İlaçlama', 'Böcek, haşere, fare ile mücadele ve ilaçlama', 'location_based', false, true),
  ('Genel Temizlik', 'Derin temizlik, cam temizliği, halı yıkama', 'location_based', false, true),
  ('Boya ve Badana', 'İç/dış cephe boyama, badana, dekoratif kaplama', 'location_based', false, true),
  ('Kapı ve Pencere', 'Kapı, pencere, cam balkon montaj/tamir', 'location_based', false, true)
ON CONFLICT (name) DO NOTHING;

-- Create index for faster filtering by category_type
CREATE INDEX IF NOT EXISTS idx_service_types_category ON technical_service_types(category_type) WHERE is_active = true;

-- Add helpful comment
COMMENT ON COLUMN technical_service_types.category_type IS 'asset_based: requires equipment selection | location_based: only requires location';
COMMENT ON COLUMN technical_service_types.requires_asset_selection IS 'If true, user must select a specific asset/equipment before creating request';
