/*
  # Proje Yöneticileri ve Operations İçin Kapsamlı RLS Düzeltmesi

  1. Güvenlik Prensibi
    - Her kullanıcı SADECE yetkili olduğu firma/projeleri görebilir
    - Operations: company_id üzerinden yetkilendirilir
    - Project Manager: atandığı projeler üzerinden yetkilendirilir
    - Başka firmaların/projelerin verilerini göremezler

  2. Değişiklikler
    - Companies: Project Manager'lar sadece atandıkları projelerin firmalarını görebilir
    - Companies: Operations sadece kendi firmalarını görebilir (mevcut politika düzeltildi)
    - Projects: Operations sadece kendi firmalarının projelerini görebilir
    - Personnel Requests: Project Manager'lar atandıkları projelerin taleplerini görebilir
    - Technical Service Requests: Operations sadece kendi firmalarının taleplerini görebilir
    - Technical Service Requests: Project Manager'lar sadece kendi projelerine ait talepleri görebilir
*/

-- ============================================
-- COMPANIES TABLOSU
-- ============================================

-- Operations için mevcut geniş politikayı kaldır (zaten yeni eklendi)
-- Project Manager'lar için: Sadece atandıkları projelerin firmalarını görebilir
DROP POLICY IF EXISTS "Project managers can view assigned project companies" ON companies;

CREATE POLICY "Project managers can view assigned project companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM project_managers pm
      JOIN projects_greenco p ON p.id = pm.project_id
      WHERE pm.manager_id = auth.uid()
      AND p.company_id = companies.id
    )
  );

-- ============================================
-- PROJECTS TABLOSU
-- ============================================

-- Operations için mevcut geniş politikayı değiştir
DROP POLICY IF EXISTS "Operations and admins can view all projects" ON projects_greenco;
DROP POLICY IF EXISTS "Operations can update all projects" ON projects_greenco;

CREATE POLICY "Operations can view own company projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operations'
      AND profiles.company_id = projects_greenco.company_id
    )
  );

CREATE POLICY "Operations can update own company projects"
  ON projects_greenco
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operations'
      AND profiles.company_id = projects_greenco.company_id
    )
  );

-- Admin için ayrı politika (tüm projeleri görebilir)
CREATE POLICY "Admins can view all projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- PERSONNEL REQUESTS TABLOSU
-- ============================================

-- Project Manager'lar: Atandıkları projelerin personel taleplerini görebilir
DROP POLICY IF EXISTS "Project managers can view assigned project requests" ON personnel_requests;

CREATE POLICY "Project managers can view assigned project requests"
  ON personnel_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM project_managers pm
      WHERE pm.project_id = personnel_requests.project_id
      AND pm.manager_id = auth.uid()
    )
  );

-- Operations: Sadece kendi firmalarının projelerine ait talepleri görebilir
DROP POLICY IF EXISTS "Operations can view own requests" ON personnel_requests;

CREATE POLICY "Operations can view own company requests"
  ON personnel_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN projects_greenco pr ON pr.id = personnel_requests.project_id
      WHERE p.id = auth.uid()
      AND p.role = 'operations'
      AND p.company_id = pr.company_id
    )
  );

-- ============================================
-- TECHNICAL SERVICE REQUESTS TABLOSU
-- ============================================

-- Mevcut geniş politikaları kaldır
DROP POLICY IF EXISTS "Users with technical module can view requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations and admins can update requests" ON technical_service_requests;

-- Operations: Sadece kendi firmalarının teknik taleplerini görebilir
CREATE POLICY "Operations can view own company technical requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operations'
      AND 'technical' = ANY(profiles.service_modules)
      AND profiles.company_id = technical_service_requests.company_id
    )
  );

-- Project Manager: Sadece kendi projelerine ait teknik talepleri görebilir
CREATE POLICY "Project managers can view assigned project technical requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM project_managers pm
      WHERE pm.project_id = technical_service_requests.project_id
      AND pm.manager_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND 'technical' = ANY(profiles.service_modules)
      )
    )
  );

-- Admin: Tüm teknik talepleri görebilir
CREATE POLICY "Admins can view all technical requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Operations: Kendi firmalarının taleplerini güncelleyebilir
CREATE POLICY "Operations can update own company technical requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operations'
      AND 'technical' = ANY(profiles.service_modules)
      AND profiles.company_id = technical_service_requests.company_id
    )
  );

-- Project Manager: Kendi projelerinin taleplerini güncelleyebilir
CREATE POLICY "Project managers can update assigned project technical requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM project_managers pm
      WHERE pm.project_id = technical_service_requests.project_id
      AND pm.manager_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND 'technical' = ANY(profiles.service_modules)
      )
    )
  );

-- Admin: Tüm talepleri güncelleyebilir
CREATE POLICY "Admins can update all technical requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
