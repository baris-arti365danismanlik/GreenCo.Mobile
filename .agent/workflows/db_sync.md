---
description: Supabase veritabanı senkronizasyon sorunlarını giderme ve manuel değişiklikleri yerele çekme adımları.
---
# Supabase DB Senkronizasyon Kılavuzu

Bolt.ai gibi başka bir ortamdan projeyi devraldığınızda veya SQL Editör üzerinden manuel değişiklikler yaptığınızda, yerel `migrations` klasörünüz ile sunucu (remote) veritabanı uyumsuz hale gelebilir. Bunu düzeltmek için aşağıdaki adımları izleyin.

## 1. Migrasyon Geçmişini Onarma (Repair)

Yerel bilgisayarınızda bulunmayan ama sunucuda işlenmiş görünen eski migrasyon kayıtlarını "yok saymak" (reverted olarak işaretlemek) için bu komutu çalıştırın. Bu işlem verilerinizi silmez, sadece versiyon takibini düzeltir.

```powershell
npx.cmd supabase migration repair --status reverted 20251127073311 20251127073734 20251201093244 20251201142513 20251203120224 20251204125527 20251204125549 20251204125615 20251204193339 20251208165751 20251208184113 20251208184530 20251209134704 20251210084753 20251210105207 20251210105422 20251211133749 20251212152100 20251215102808
```

## 2. Uzak Değişiklikleri Yerele Çekme (Pull)

SQL Editör üzerinden yaptığınız manuel değişiklikleri (yeni tablolar, policyler, sütunlar) yerel bilgisayarınıza bir migrasyon dosyası olarak indirmek için bu komutu kullanın.

```powershell
npx.cmd supabase db pull
```

Bu komut çalıştıktan sonra `supabase/migrations` klasöründe yeni bir dosya oluşacak ve veritabanınızın o anki **TÜM** yapısını içerecektir.

## 3. Yeni Değişiklikleri Gönderme (Push)

Artık yerel ile sunucu eşitlendi. Bundan sonra yapacağınız değişiklikler için (benim oluşturduğum `create_project_technical_invoices` gibi) tekrar `push` komutunu güvenle kullanabilirsiniz.

```powershell
npx.cmd supabase db push
```

## Özet Akış

1.  SQL Editörden Hakediş tablosunu oluşturun (Şu anlık işiniz görülsün).
2.  Müsait bir zamanda sırasıyla: `repair` -> `pull` komutlarını çalıştırarak projeyi eşitleyin.
