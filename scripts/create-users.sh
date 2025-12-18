#!/bin/bash

SUPABASE_URL="https://mtfqfzilbyyxwjfuhkdf.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZnFmemlsYnl5eHdqZnVoa2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMjM4NjEsImV4cCI6MjA3OTc5OTg2MX0.dNLoLj8Sjr3zMP_JYW3noaKp2bugsYsdwatmf_YMHRY"

echo "🔐 Admin olarak giriş yapılıyor..."

# Login as admin
RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+905551111111",
    "password": "GreenCo2025!"
  }')

ADMIN_TOKEN=$(echo $RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin girişi başarısız!"
  exit 1
fi

echo "✅ Admin girişi başarılı!"
echo ""

# Create users
declare -a users=(
  '+905451111001|Ahmet Yılmaz|operations'
  '+905451111002|Mehmet Kaya|operations'
  '+905451111003|Ayşe Demir|operations'
  '+905451111004|Fatma Şahin|operations'
  '+905451111005|Ali Yıldız|operations'
  '+905452222001|Hasan Çelik|project_manager'
  '+905452222002|Zeynep Arslan|project_manager'
  '+905452222003|Murat Öztürk|project_manager'
  '+905452222004|Elif Aydın|project_manager'
  '+905452222005|Can Yılmaz|project_manager'
)

SUCCESS=0
FAILED=0

for user in "${users[@]}"; do
  IFS='|' read -r phone name role <<< "$user"

  echo "📱 ${name} (${phone}) oluşturuluyor..."

  RESULT=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/create-user" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"phone\": \"${phone}\",
      \"password\": \"GreenCo2025!\",
      \"full_name\": \"${name}\",
      \"role\": \"${role}\",
      \"service_modules\": [\"technical\"]
    }")

  if echo "$RESULT" | grep -q '"user_id"'; then
    echo "✅ ${name} başarıyla oluşturuldu!"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ ${name} oluşturulamadı: $RESULT"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "================================"
echo "📊 ÖZET"
echo "================================"
echo "✅ Başarılı: ${SUCCESS}"
echo "❌ Başarısız: ${FAILED}"
echo "📝 Toplam: 10"
echo "🔑 Şifre (hepsi): GreenCo2025!"
echo "================================"
