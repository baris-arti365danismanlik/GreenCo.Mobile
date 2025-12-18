-- Test kullanıcıları oluşturma scripti
-- Bu scripti manuel olarak Supabase Dashboard SQL Editor'de çalıştırın

-- Not: Supabase auth.users tablosuna direkt insert yapamıyoruz
-- Bu yüzden Supabase Dashboard'dan veya Admin API'den oluşturmalıyız

-- Ancak, profillerini hazırlayabiliriz (user_id'ler sonra eşleştirilecek)

-- Önce bir test firması oluşturalım
INSERT INTO companies (name, tax_number, address, contact_person, contact_phone)
VALUES
  ('Greenco Test A.Ş.', '1234567890', 'İstanbul, Türkiye', 'Test Yetkili', '5559999999')
ON CONFLICT (tax_number) DO NOTHING;

-- Test kullanıcıları için notlar:
-- 1. Admin: 5551111111@greenco.com / admin123
-- 2. Proje Yöneticisi: 5552222222@greenco.com / manager123
-- 3. Operasyon: 5553333333@greenco.com / ops123
-- 4. Personel: 5554444444@greenco.com / staff123
