/*
  # Hakediş Durumlarına 'submitted' Ekle

  ## Değişiklikler
  
  ### Enum Güncelleme
  - invoice_status enum'ına 'submitted' değeri eklenir
  - Mevcut değerler: pending, approved, paid, cancelled
  - Yeni değer: submitted
  
  ## İş Akışı
  
  - pending: Operasyon tarafından oluşturuldu (taslak)
  - submitted: Admin'e gönderildi (faturalandırmaya hazır)
  - approved: (Artık kullanılmıyor)
  - paid: (Artık kullanılmıyor)
  - cancelled: İptal edildi
  
  ## Notlar
  
  - Enum'a yeni değer eklemek güvenlidir
  - Mevcut veriler etkilenmez
*/

-- invoice_status enum'ına 'submitted' ekle
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'submitted';
