# GreenCo Proje Yönetim Sistemi - Detaylı Kullanım Kılavuzu

## İçindekiler
1. [Sistem Özeti](#sistem-özeti)
2. [Kullanıcı Rolleri ve Yetkileri](#kullanıcı-rolleri-ve-yetkileri)
3. [Modüller](#modüller)
4. [Veritabanı Yapısı](#veritabanı-yapısı)
5. [Kullanım Senaryoları](#kullanım-senaryoları)
6. [Mevcut Test Verileri](#mevcut-test-verileri)

---

## Sistem Özeti

GreenCo, şantiye ve teknik servis operasyonlarını yöneten kapsamlı bir mobil uygulamadır. İki ana modülden oluşur:

### Ana Modüller
1. **Personel Modülü**: Şantiye personel yönetimi, puantaj, hakediş
2. **Teknik Servis Modülü**: Arıza/bakım talepleri, teklif alma, servis yönetimi

---

## Kullanıcı Rolleri ve Yetkileri

### 1. Admin (Sistem Yöneticisi)
- **Yetkiler:**
  - Tüm sistemde tam yetki
  - Kullanıcı oluşturma/düzenleme/silme
  - Şirket yönetimi
  - Proje onaylama/reddetme
  - Personel talep onaylama
  - Hakediş onaylama/ödeme
  - Teknik servis fatura onaylama
  - Her iki modülde tam yetki

- **Ekranlar:**
  - Dashboard (genel istatistikler)
  - Kullanıcı yönetimi
  - Şirket yönetimi
  - Proje yönetimi
  - Personel yönetimi
  - Personel talepleri
  - Puantaj yönetimi
  - Hakediş yönetimi
  - Teknik servis talepleri
  - Teknik servis faturaları

### 2. Operasyon (Operations)
- **Yetkiler:**
  - Puantaj dönemleri görüntüleme (onaylanmış)
  - Hakediş oluşturma ve yönetme
  - Teknik servis hizmetlerini onaylama
  - Teknik servis faturalarını görüntüleme

- **Ekranlar:**
  - Dashboard
  - Projeler (tümü)
  - Puantaj dönemleri (invoice_pending durumunda olanlar)
  - Hakediş yönetimi
  - Teknik servis talepleri
  - Teknik servis faturaları

### 3. Proje Müdürü (Project Manager)
- **Yetkiler:**
  - Atandığı projeleri görüntüleme
  - Proje personelini görüntüleme
  - Puantaj onaylama/reddetme
  - Personel performansını değerlendirme (1-5 puan)
  - Teknik servis talebi oluşturma (technical modülü varsa)
  - Teknik servis hizmetini değerlendirme (technical modülü varsa)
  - Modül bazlı yetkilendirme (personnel/technical)

- **Ekranlar:**
  - Dashboard (atandığı projeler)
  - Proje detayları
  - Personel listesi ve puantaj
  - Puantaj onaylama
  - Teknik servis talepleri (technical modülü varsa)
  - Hizmet değerlendirme

- **Modül Kontrolü:**
  - `service_modules` array'inde 'personnel' varsa: Personel ekranlarına erişim
  - `service_modules` array'inde 'technical' varsa: Teknik servis ekranlarına erişim

### 4. Personel (Personnel)
- **Yetkiler:**
  - Kendi vardiyalarını görüntüleme
  - QR kod ile giriş/çıkış yapma
  - Lokasyon doğrulama ile giriş/çıkış

- **Ekranlar:**
  - Vardiya listesi
  - QR scanner
  - Profil

### 5. Teknik Modül Kullanıcısı (Technical)
- **Yetkiler:**
  - Teknik servis taleplerini görüntüleme (SADECE GÖRÜNTÜLEME)
  - Teknik servis firmalarını görüntüleme
  - Teklif durumlarını takip etme
  - **NOT: TALEBİN OLUŞTURAMAZ! Sadece görüntüleme yetkisi vardır**

- **Ekranlar:**
  - Dashboard
  - Teknik servis talepleri (read-only)
  - Teknik servis firmaları (read-only)
  - Teklif detayları (read-only)

- **Önemli:** Bu rol genellikle teknik departman çalışanları için kullanılır. Talep oluşturmak için Project Manager rolü (technical modülü ile) kullanılmalıdır.

### 6. Teknik Servis Firması (Technical Company)
- **Yetkiler:**
  - Uygun talepleri görüntüleme (uzmanlık alanı, bölge, marka)
  - Teklif verme (quote/info_request/diagnostic_service)
  - İşleri tamamlama
  - Servis raporu yükleme (fotoğraf/video)
  - Fatura görüntüleme

- **Ekranlar:**
  - Dashboard
  - Müsait talepler (filtreleme ile)
  - Teklifler
  - Aktif işler
  - Tanısal işler
  - İş detayları
  - Profil

- **Filtreleme:**
  - Uzmanlık alanına göre (specialties)
  - Bölgeye göre (city, district)
  - Yetkili marka servisiyse (authorized_brands)

---

## Modüller

### Modül 1: Personel Yönetimi

#### Özellikler:
1. **Proje Yönetimi**
   - Proje oluşturma (şirket, konum, tarih)
   - Proje müdürü atama
   - Geofence radius belirleme
   - QR kod oluşturma
   - Durum yönetimi (pending_approval, active, completed)

2. **Personel Yönetimi**
   - Personel kaydı (TC kimlik, doğum tarihi, pozisyon)
   - Personel tipi (İşçi, Usta, Şoför vb.)
   - Projeye atama
   - Ücret belirleme (günlük/saatlik/paket)

3. **Vardiya Yönetimi**
   - Vardiya oluşturma (tarih, saat)
   - Durum takibi (scheduled, in_progress, completed, cancelled)

4. **Puantaj Sistemi**
   - QR kod ile giriş/çıkış
   - Lokasyon doğrulama
   - Otomatik saat hesaplama
   - Performans değerlendirme (1-5 puan)
   - Performans notu

5. **Puantaj Dönemleri**
   - Dönem oluşturma (başlangıç-bitiş tarihi)
   - Proje müdürü onayı
   - Operasyon onayı
   - Durum yönetimi:
     - draft: Taslak
     - pending_manager: Proje müdürü onayı bekliyor
     - approved_manager: Proje müdürü onayladı
     - rejected_manager: Proje müdürü reddetti
     - final_approved: Nihai onay
     - invoice_pending: Hakediş bekleniyor
     - invoice_completed: Hakediş tamamlandı

6. **Hakediş Yönetimi**
   - Hakediş oluşturma (puantaj dönemi bazlı)
   - Personel bazlı hesaplama
   - Toplam tutar hesaplama
   - Durum yönetimi (pending, submitted, approved, paid, cancelled)
   - Onay akışı

### Modül 2: Teknik Servis Yönetimi

#### Özellikler:
1. **Servis Tipleri**
   - Asset-based (ekipman bazlı): Klima, Asansör, Yangın vb.
   - Location-based (lokasyon bazlı): Elektrik, Su Tesisatı vb.
   - Her tip için marka ve model seçimi

2. **Talep Oluşturma**
   - Servis tipi seçimi
   - Detaylı açıklama
   - Fotoğraf/video ekleme
   - Lokasyon bilgisi (şehir, ilçe, adres)
   - Asset bilgileri:
     - Marka ve model
     - Seri numarası
     - Asset kodu
     - Kat/Alan bilgisi
     - Garanti bitiş tarihi
     - Yetkili servise gönderim tercihi

3. **Teklif Sistemi (3 Aşamalı)**

   **Aşama 1: İlk Teklifler (3 Seçenek)**
   - Quote (Fiyat Teklifi): Kesin fiyat teklifi
   - Info Request (Bilgi Talebi): Ek bilgi isteme
   - Diagnostic Service (Tanısal Hizmet): Yerinde inceleme

   **Aşama 2: Müşteri Seçimi**
   - Sistem/admin her tip için 1 teklif seçer (selected_for_customer=true)
   - Müşteri görüntüler ve birini seçer
   - Info Request seçilirse: Bilgi verildikten sonra yeni teklif turu
   - Diagnostic seçilirse: Tanı yapılır, rapor sunulur, yeni teklif turu
   - Quote seçilirse: Direkt işe başlanır

   **Aşama 3: İş Ataması**
   - Seçilen teklif based on assignment oluşturulur
   - Firma işi tamamlar
   - Rapor, fotoğraf, video yükler
   - Proje müdürü değerlendirir
   - Operasyon onaylar

4. **Teknik Servis Firmaları**
   - Firma kaydı (şirket adı, vergi no, banka bilgileri)
   - Uzmanlık alanları (service_type_id)
   - Yetkili marka servisleri (brand_id)
   - Bölge bilgisi (city, district)
   - Rating sistemi (0-5)

5. **Teklif Filtreleme (Firmaya Görünen)**
   Bir talep firmaya gösterilir ancak ve ancak:
   - Firma uzmanlık alanında (specialties tablosunda kayıt var)
   - Firma bölgede (city, district eşleşmesi)
   - Yetkili servis gerekliyse: Firma o marka için yetkili

6. **Servis Tamamlama**
   - Problem açıklaması
   - Çözüm açıklaması
   - Kullanılan parçalar
   - İşçilik maliyeti
   - Parça maliyeti
   - Garanti süresi (ay)
   - Fotoğraf/video eklentiler

7. **Değerlendirme**
   - Proje müdürü değerlendirmesi (1-5 puan)
   - Detaylı geri bildirim
   - Hizmet tamamlama durumu:
     - satisfactory: Tatmin edici
     - incomplete: Eksik
     - unsatisfactory: Tatmin edici değil
     - requires_rework: Yeniden yapım gerekli

8. **Teknik Servis Faturası**
   - Dönemsel fatura (başlangıç-bitiş tarihi)
   - Teknik servis firması bazlı
   - Tamamlanmış işleri içerir
   - Komisyon oranı hesaplanır (companies.commission_rate)
   - Durum yönetimi (draft, pending, approved, paid, rejected)
   - Onay akışı (operasyon onayı)

---

## Veritabanı Yapısı

### Ana Tablolar

#### 1. **profiles** (Kullanıcı Profilleri)
- Tüm kullanıcıların bilgileri
- `role`: personnel, project_manager, operations, admin, technical, technical_company
- `service_modules`: ['personnel', 'technical'] array
- `technical_company_id`: Teknik servis firması bağlantısı
- `personnel_type_id`: Personel tipi (İşçi, Usta, Şoför)
- RLS: Her kullanıcı kendi bilgisini görebilir, admin hepsini görebilir

#### 2. **companies** (Müşteri Şirketleri)
- Müşteri şirket bilgileri
- `is_tech_service_company`: Teknik servis firması mı?
- `commission_rate`: Teknik servis komisyon oranı (0.15 = %15)
- RLS: Admin tümünü, PM/Operations atandığı şirketleri görebilir

#### 3. **technical_service_companies** (Teknik Servis Firmaları)
- Servis firmaları bilgileri
- Banka hesabı bilgileri
- Rating ve iş sayısı istatistikleri
- RLS: Admin ve ilgili firma görebilir

#### 4. **projects_greenco** (Projeler)
- Proje bilgileri
- Geofence ve QR kod bilgileri
- `status`: pending_approval, active, completed
- RLS: Admin tümünü, PM atandıklarını, Operations tümünü görebilir

#### 5. **project_managers** (Proje - Proje Müdürü İlişkisi)
- Many-to-many ilişki
- Bir projenin birden fazla PM'i olabilir
- Bir PM birden fazla projede görev alabilir

#### 6. **project_assignments** (Proje - Personel Atamaları)
- Personelin projeye ataması
- Ücret bilgileri (hourly_rate, daily_rate, overtime_rate)
- `worker_id`: Çalışan ID (profiles tablosu)
- `personnel_id`: Personel ID (aynı worker_id ile)

#### 7. **shifts** (Vardiyalar)
- Planlanan vardiyalar
- `status`: scheduled, in_progress, completed, cancelled
- RLS: Admin ve PM görebilir, personel kendisininkini görebilir

#### 8. **attendance_records** (Puantaj Kayıtları)
- Giriş/çıkış zamanları
- QR kod ve lokasyon doğrulaması
- `performance_rating`: 1-5 puan
- `performance_notes`: Performans notu
- Toplam çalışma saati hesaplanır
- RLS: Admin ve PM görebilir/düzenleyebilir

#### 9. **timesheet_periods** (Puantaj Dönemleri)
- Dönemsel puantaj özeti
- `status`: draft, pending_manager, approved_manager, invoice_pending, invoice_completed
- Toplam saat ve personel sayısı
- RLS: Admin tümünü, PM atandıklarını, Operations onaylanmışları görebilir

#### 10. **invoices** (Hakediş Faturaları)
- Puantaj dönemi bazlı hakediş
- `personnel_breakdown`: JSON array (personel detayları)
- `status`: pending, submitted, approved, paid, cancelled
- Toplam tutar ve hesaplamalar
- RLS: Admin ve Operations görebilir/düzenleyebilir

#### 11. **personnel_types** (Personel Tipleri)
- İşçi, Usta, Şoför, Mühendis vb.
- Admin tarafından yönetilir

#### 12. **personnel_requests** (Personel Talepleri)
- Yeni proje/personel talepleri
- Proje müdürü bilgileri
- Personel pozisyonları (JSON array)
- `status`: pending, awaiting_assignment, approved, rejected, completed
- RLS: Admin onaylama yetkisi

### Teknik Servis Tabloları

#### 13. **technical_service_types** (Servis Tipleri)
- Klima, Asansör, Yangın, Elektrik vb.
- `category_type`: asset_based, location_based
- `requires_asset_selection`: Ekipman seçimi gerekli mi?

#### 14. **asset_brands** (Marka Listesi)
- Daikin, Mitsubishi, York vb.
- `service_type_id`: Hangi servis tipi için

#### 15. **asset_models** (Model Listesi)
- Her marka için modeller
- `brand_id`: Hangi marka

#### 16. **technical_service_company_specialties** (Firma Uzmanlık Alanları)
- Firmanın hangi servis tiplerinde çalıştığı
- Many-to-many ilişki

#### 17. **technical_company_authorized_brands** (Yetkili Marka Servisleri)
- Firmanın hangi markalarda yetkili servis olduğu
- Many-to-many ilişki

#### 18. **technical_service_requests** (Teknik Servis Talepleri)
- Servis talep detayları
- `status`: pending_review, info_needed, bidding, approved, in_progress, completed, cancelled, awaiting_customer_decision, diagnostic_in_progress, awaiting_additional_info
- `current_bid_round`: Mevcut teklif turu (1, 2, 3...)
- `selected_bid_id`: Müşterinin seçtiği teklif
- Lokasyon ve asset bilgileri
- RLS: Admin tümünü, Technical/PM kendi şirketlerini, TC uygun olanları görebilir

#### 19. **technical_service_bids** (Teklifler)
- `bid_type`: quote, info_request, diagnostic_service
- `bid_round`: Kaçıncı tur teklifi (1, 2, 3...)
- `selected_for_customer`: Müşteriye gösterilecek teklif
- `customer_approved`: Müşteri bu teklifi seçti
- `status`: pending, accepted, rejected, withdrawn
- RLS: Admin, ilgili firma, talep sahibi görebilir

#### 20. **technical_service_assignments** (İş Atamaları)
- Kabul edilen tekliften oluşan iş
- Servis raporu (problem, çözüm, parçalar)
- Maliyet bilgileri
- PM değerlendirmesi (rating, feedback, status)
- Operasyon onayı
- `invoice_id`: Hangi faturaya dahil
- RLS: Admin, firma, PM görebilir

#### 21. **technical_service_assignment_attachments** (İş Eklentileri)
- Servis tamamlama fotoğraf/videoları
- Firma tarafından yüklenir
- Storage bucket: 'technical-attachments'

#### 22. **technical_service_invoices** (Teknik Servis Faturaları)
- Dönemsel faturalar
- `assignment_ids`: Hangi işler dahil (array)
- `job_details`: İş detayları (JSON array)
- `status`: draft, pending, approved, paid, rejected
- Komisyon dahil toplam tutar
- RLS: Admin ve Operations onaylama yetkisi, firma kendi faturalarını görebilir

#### 23. **technical_service_reviews** (Değerlendirmeler)
- Assignment bazlı değerlendirme
- 1-5 puan ve yorum
- Firma rating ortalaması güncellenir

---

## Kullanım Senaryoları

### Senaryo 1: Personel Modülü - Yeni Proje ve Puantaj

#### Adım 1: Proje Oluşturma (Admin)
1. Admin dashboard'a giriş
2. "Yeni Proje" butonuna tıkla
3. Bilgileri doldur:
   - Şirket seçimi
   - Proje adı
   - Lokasyon (adres, koordinat, geofence)
   - Başlangıç/bitiş tarihleri
4. Kaydet (status: pending_approval)

#### Adım 2: Proje Müdürü Atama (Admin)
1. Proje detayına gir
2. "Proje Müdürü Ata" seçeneği
3. Müdür seçimi (service_modules: ['personnel'])
4. Atama tamamlanır (project_managers tablosuna kayıt)

#### Adım 3: Projeyi Onaylama (Admin)
1. Proje durumunu "active" yap
2. QR kod otomatik oluşturulur

#### Adım 4: Personel Atama (Admin/PM)
1. "Personel Ata" ekranı
2. Mevcut personel seçimi veya yeni oluşturma
3. Ücret belirleme (günlük/saatlik)
4. Atama kaydı (project_assignments)

#### Adım 5: Vardiya Oluşturma (Admin/PM)
1. Tarih seçimi
2. Personel seçimi
3. Saat aralığı (08:00-17:00)
4. Vardiya kaydı (shifts)

#### Adım 6: Giriş/Çıkış (Personel)
1. Personel uygulamaya giriş
2. QR scanner açılır
3. Proje QR kodu taranır
4. Lokasyon doğrulaması
5. Giriş kaydedilir (attendance_records - check_in)
6. İş bitiminde tekrar QR tara
7. Çıkış kaydedilir (check_out)
8. Toplam saat otomatik hesaplanır

#### Adım 7: Performans Değerlendirme (PM)
1. PM puantaj ekranına giriş
2. Personel seçimi
3. Rating (1-5 puan)
4. Not ekleme
5. Kaydetme (attendance_records güncellenir)

#### Adım 8: Puantaj Dönem Oluşturma (Operations)
1. Dönem seçimi (örn: 1-5 Aralık)
2. Proje seçimi
3. Toplam saat/personel otomatik hesaplanır
4. Oluştur (status: pending_manager)

#### Adım 9: Puantaj Onaylama (PM)
1. PM onay ekranına giriş
2. Puantaj detaylarını incele
3. Onayla veya reddet
4. Onaylandıysa (status: approved_manager)

#### Adım 10: Hakediş Oluşturma (Operations)
1. Onaylanan puantaj dönemini seç
2. "Hakediş Oluştur"
3. Personel bazlı hesaplama otomatik yapılır
4. Toplam tutar hesaplanır
5. Fatura kaydedilir (status: submitted)

#### Adım 11: Hakediş Onaylama (Admin)
1. Admin hakediş listesine giriş
2. Hakediş detayını incele
3. Onayla (status: approved)
4. Ödeme işaretleme (status: paid)

### Senaryo 2: Teknik Servis Modülü - Arıza Talebi ve Teklif Alma

#### Adım 1: Servis Talebi Oluşturma (Admin/Operations-Technical/PM-Technical Modülü)
**Not:**
- **Admin**: Her zaman oluşturabilir (tüm modüllere erişim)
- **Operations**: Eğer `service_modules` içinde `'technical'` varsa oluşturabilir
- **Project Manager**: Eğer `service_modules` içinde `'technical'` varsa oluşturabilir
- **"Technical" rolü**: OLUŞTURAMAZ! Sadece görüntüleme yetkisi vardır

1. "Yeni Talep" ekranı
2. Servis tipi seçimi (örn: Klima)
3. Bilgileri doldur:
   - Başlık ve açıklama
   - Lokasyon (şehir, ilçe, adres, kat/alan)
   - Marka ve model seçimi (örn: Daikin - VRV IV)
   - Seri numarası, asset kodu
   - Garanti bilgisi
   - Yetkili servis tercihi (checkbox)
   - Fotoğraf/video ekleme
4. Kaydet (status: pending_review)

#### Adım 2: Admin İncelemesi ve Teklif Açma (Admin)
1. Admin talep detayına giriş
2. Bilgileri kontrol et
3. "Teklif Sürecini Başlat"
4. Durum: bidding olur
5. `current_bid_round`: 1 olur
6. Uygun firmalara bildirim (uzmanlık, bölge, marka kontrolü)

#### Adım 3: Teklif Verme (Technical Company)
1. Firma "Müsait Talepler" ekranında görür
2. Talep detayına girer
3. 3 seçenekten birini seçer:
   - **Quote (Fiyat Teklifi)**: Kesin fiyat ve süre
   - **Info Request (Bilgi Talebi)**: "Ekipmanın montaj tarihini ve son bakım tarihini öğrenebilir miyim?"
   - **Diagnostic Service (Tanısal Hizmet)**: "Yerinde inceleme yapmam gerekiyor, ücret: 500 TL"
4. Teklif kaydedilir (bid_type, bid_round: 1, status: pending)

#### Adım 4: Teklif Seçimi ve Müşteriye Sunma (Admin)
1. Admin her bid_type için en iyi 1 teklif seçer
2. `selected_for_customer`: true yapılır
3. Talep durumu: awaiting_customer_decision olur

#### Adım 5: Müşteri Seçimi (Admin/Operations-Technical/PM-Technical Modülü)

**Senaryo A: Quote Seçilirse**
1. Müşteri Quote'u seçer
2. `customer_approved`: true olur
3. Assignment oluşturulur (status: approved)
4. Firma işe başlar

**Senaryo B: Info Request Seçilirse**
1. Müşteri Info Request'i seçer
2. Ek bilgi girer: "Montaj tarihi: 2020, Son bakım: 2023"
3. `customer_additional_info` alanına kaydedilir
4. Talep durumu: awaiting_additional_info olur
5. `current_bid_round`: 2 olur
6. Firmalar yeni teklifler verir (sadece Quote)
7. Admin tekrar seçim yapar
8. Müşteri tekrar seçer

**Senaryo C: Diagnostic Service Seçilirse**
1. Müşteri Diagnostic'i seçer
2. Assignment oluşturulur (tanısal iş)
3. Firma yerinde inceleme yapar
4. Rapor yazar: `diagnostic_report` alanına kaydedilir
5. Fotoğraf/video yükler
6. Talep durumu: diagnostic_in_progress olur
7. Tanı tamamlanınca `current_bid_round`: 2 olur
8. Firmalar yeni teklifler verir (sadece Quote)
9. Admin seçim yapar
10. Müşteri seçer

#### Adım 6: İş Tamamlama (Technical Company)
1. Firma "Aktif İşler" ekranından işi açar
2. İş detaylarını doldurur:
   - Problem açıklaması
   - Çözüm açıklaması
   - Kullanılan parçalar
   - İşçilik maliyeti
   - Parça maliyeti
   - Garanti süresi (ay)
3. Fotoğraf/video yükler (technical-attachments bucket)
4. "İşi Tamamla" butonuna tıklar
5. `completion_date` kaydedilir
6. PM'e bildirim gider

#### Adım 7: PM Değerlendirmesi (PM)
1. PM "Tamamlanan Hizmetler" ekranına giriş
2. İş detayını inceler
3. Fotoğraf/videoları kontrol eder
4. Değerlendirme yapar:
   - Rating (1-5 puan)
   - Detaylı geri bildirim
   - Hizmet durumu (satisfactory/incomplete/unsatisfactory/requires_rework)
5. Onaylar
6. `pm_approved`: true olur
7. Operations'a bildirim gider

#### Adım 8: Operations Onayı (Operations)
1. Operations "Teknik Servis Talepleri" ekranına giriş
2. Tamamlanan işleri inceler
3. PM değerlendirmesini kontrol eder
4. Onaylar
5. `operations_approved`: true olur
6. İş tamamen tamamlanır (request status: completed)

#### Adım 9: Fatura Oluşturma (Operations)
1. Operations "Teknik Servis Faturaları" ekranı
2. "Yeni Fatura" butonuna tıklar
3. Dönem seçimi (örn: 1-31 Aralık)
4. Firma seçimi
5. Tamamlanmış işler otomatik getirilir
6. Komisyon otomatik hesaplanır (örn: %15)
7. Fatura kaydedilir (status: pending)
8. Toplam tutar: (İş bedelleri toplamı) + (Komisyon tutarı)

#### Adım 10: Fatura Onaylama (Admin/Operations)
1. Fatura detayını incele
2. İş detaylarını kontrol et
3. Onayla (status: approved)
4. Ödeme işaretleme (status: paid)

---

## Mevcut Test Verileri

### Kullanıcılar (Tüm Şifreler: GreenCo2025!)

#### Admin
- **Telefon:** +905551111111
- **Modüller:** Personnel + Technical

#### Operations
- **Telefon:** +905556663322
- **Modüller:** Personnel + Technical

#### Proje Müdürleri
1. **Hasan Çelik**
   - **Telefon:** +905452222001
   - **Modüller:** Personnel + Technical
   - **Proje:** kale kilit - Test Şantiyesi

2. **Zeynep Arslan**
   - **Telefon:** +905452222002
   - **Modüller:** Personnel
   - **Proje:** Metro İnşaat - Personel Şantiyesi

#### Personel (kale kilit Projesi)
1. **Ali Yılmaz** - İşçi (+905551111001)
2. **Mehmet Kaya** - İşçi (+905551111002)
3. **Ahmet Demir** - Usta (+905551111003)

#### Personel (Metro İnşaat Projesi)
1. **Kemal Öztürk** - İşçi (+905551111004)
2. **Fatih Aydın** - Usta (+905551111005)
3. **Burak Şahin** - Şoför (+905551111006)

#### Teknik Servis Firmaları
1. **Kadıköy Klima** - Kadıköy, İstanbul
   - Uzmanlık: Klima Servisi
   - Yetkili: Daikin, Mitsubishi, LG
   - **Telefon:** +905551234501

2. **Üsküdar Asansör** - Üsküdar, İstanbul
   - Uzmanlık: Asansör Bakım/Onarım
   - **Telefon:** +905551234502

3. **Beşiktaş Yangın** - Beşiktaş, İstanbul
   - Uzmanlık: Yangın Sistemleri
   - **Telefon:** +905551234503

4. **Şişli Elektrik** - Şişli, İstanbul
   - Uzmanlık: Elektrik İşleri
   - **Telefon:** +905551234504

5. **Kartal Jeneratör** - Kartal, İstanbul
   - Uzmanlık: Jeneratör Bakım/Onarım
   - **Telefon:** +905551234505

6. **Maltepe Su** - Maltepe, İstanbul
   - Uzmanlık: Su Tesisatı
   - **Telefon:** +905551234506

### Projeler

#### 1. kale kilit - Test Şantiyesi
- **Şirket:** kale kilit
- **Proje Müdürü:** Hasan Çelik
- **Personel:** 3 kişi
- **Lokasyon:** Kadıköy, İstanbul
- **Durum:** Active
- **Puantaj Dönemi:** 1-5 Aralık 2024 (135 saat, invoice_pending)
- **Hakediş:** INV-2024-12-001 (9,000 TL, submitted)

#### 2. Metro İnşaat - Personel Şantiyesi
- **Şirket:** kale kilit
- **Proje Müdürü:** Zeynep Arslan
- **Personel:** 3 kişi
- **Lokasyon:** Ataşehir, İstanbul
- **Durum:** Active
- **Puantaj Dönemi:** 25-30 Kasım 2024 (162 saat, invoice_pending)
- **Hakediş:** INV-2024-11-002 (11,400 TL, submitted)

### Servis Tipleri
1. Klima Servisi (asset_based)
2. Asansör Bakım/Onarım (asset_based)
3. Yangın Sistemleri (asset_based)
4. Elektrik İşleri (location_based)
5. Jeneratör Bakım/Onarım (asset_based)
6. Su Tesisatı (location_based)
7. Doğalgaz Tesisatı (location_based)
8. Isıtma Sistemleri (asset_based)
9. Soğutma Sistemleri (asset_based)
10. Havalandırma Sistemleri (asset_based)

### Markalar (Örnek - Klima)
1. Daikin
2. Mitsubishi Electric
3. LG
4. Samsung
5. Carrier
6. Toshiba
7. Fujitsu
8. Panasonic
9. Gree
10. Midea

---

## Önemli Notlar

### RLS (Row Level Security) Kuralları
- Her tablo RLS aktif
- Kullanıcılar sadece yetkili oldukları verileri görebilir
- JWT metadata kullanılır (auth.jwt())
- Profiles tablosuna doğrudan referans vermekten kaçınılır (recursion önleme)

### Offline Support
- Puantaj kayıtları offline çalışabilir
- `is_synced` flag'i ile senkronizasyon yönetimi
- AsyncStorage kullanımı

### Geofence
- Projede `geofence_radius_meters` belirlenir (varsayılan: 100m)
- Giriş/çıkış sırasında lokasyon kontrol edilir
- `check_in_location_verified` ve `check_out_location_verified` flag'leri

### QR Kod Sistemi
- Her proje için unique QR kod (`qr_code_secret`)
- Giriş/çıkış sırasında QR kod taranır
- `check_in_qr_verified` ve `check_out_qr_verified` flag'leri

### Storage Buckets
1. **avatars**: Kullanıcı profil resimleri
2. **technical-attachments**: Teknik servis fotoğraf/videoları

### Otomatik Hesaplamalar
- **Toplam saat:** check_out_time - check_in_time
- **Puantaj dönemi toplamları:** Tüm attendance_records toplamı
- **Hakediş tutarı:** (Personel sayısı) × (Günlük/saatlik ücret) × (Gün/saat sayısı)
- **Teknik servis komisyonu:** Toplam tutar × (commission_rate)

### İş Akışları

#### Puantaj Akışı
```
draft → pending_manager → approved_manager → invoice_pending → invoice_completed
          ↓ (reddetme)
      rejected_manager
```

#### Teknik Servis Akışı
```
pending_review → bidding → awaiting_customer_decision → approved → in_progress → completed
                    ↓ (bilgi/tanı)
            awaiting_additional_info / diagnostic_in_progress
                    ↓
            bidding (round 2) → awaiting_customer_decision → ...
```

#### Hakediş Akışı
```
pending → submitted → approved → paid
            ↓
        cancelled
```

#### Teknik Servis Fatura Akışı
```
draft → pending → approved → paid
          ↓
      rejected
```

---

## API Endpoints (Edge Functions)

### Kullanıcı Yönetimi
- **create-user**: Yeni kullanıcı oluşturma (admin yetkisi gerekli)
- **create-first-admin**: İlk admin kullanıcı oluşturma
- **create-technical-company-users**: Teknik servis firması kullanıcı oluşturma
- **delete-technical-company-users**: Teknik servis firması kullanıcı silme
- **reset-all-passwords**: Tüm kullanıcı şifrelerini sıfırlama
- **get-all-profiles**: Tüm profilleri getirme
- **get-manager-personnel**: Proje müdürünün personelini getirme

---

## Sonuç

Bu sistem, şantiye personel yönetimi ve teknik servis operasyonlarını tek bir platformda birleştiren kapsamlı bir çözümdür. Modüler yapısı sayesinde farklı kullanıcı rolleri için özelleştirilmiş deneyimler sunar ve detaylı yetkilendirme sistemi ile veri güvenliğini sağlar.

Sistem, gerçek zamanlı puantaj takibinden çoklu teklif alma süreçlerine, performans değerlendirmeden fatura yönetimine kadar tüm operasyonel ihtiyaçları karşılar.
