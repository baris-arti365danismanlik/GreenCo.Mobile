#!/bin/bash

# Supabase credentials
SUPABASE_URL="https://mtfqfzilbyyxwjfuhkdf.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZnFmemlsYnl5eHdqZnVoa2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMjM4NjEsImV4cCI6MjA3OTc5OTg2MX0.dNLoLj8Sjr3zMP_JYW3noaKp2bugsYsdwatmf_YMHRY"

# Admin credentials - Get token first
echo "🔐 Admin olarak giriş yapılıyor..."
ADMIN_LOGIN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "905551234567@greenco.app",
    "password": "GreenCo2025!"
  }')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin girişi başarısız!"
  echo $ADMIN_LOGIN
  exit 1
fi

echo "✅ Admin token alındı"

# Function to create user
create_user() {
  local phone=$1
  local full_name=$2
  local company_id=$3
  local city=$4
  local district=$5

  echo "📝 Oluşturuluyor: $full_name ($phone)"

  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/create-user" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"phone\": \"$phone\",
      \"password\": \"GreenCo2025!\",
      \"full_name\": \"$full_name\",
      \"role\": \"technical\",
      \"company_id\": \"$company_id\",
      \"city\": \"$city\",
      \"district\": \"$district\"
    }")

  if echo "$RESPONSE" | grep -q "successfully"; then
    echo "✅ $full_name oluşturuldu"
  else
    echo "⚠️  $full_name için hata:"
    echo "$RESPONSE"
  fi

  sleep 1
}

echo ""
echo "========================================="
echo "👥 Teknisyen firma kullanıcıları oluşturuluyor..."
echo "========================================="
echo ""

# Adana Firmaları
create_user "+905331111001" "Ali Yıldırım" "3f08355e-54db-46ae-8daf-7833990773a1" "Adana" "Seyhan"
create_user "+905331111002" "Mehmet Kaya" "05ee4f77-46d1-451c-9fea-7c35cf71c2ba" "Adana" "Çukurova"
create_user "+905331111003" "Ayşe Demir" "48940d1e-8348-44d6-805e-a0ca56a017af" "Adana" "Yüreğir"
create_user "+905331111004" "Fatma Şahin" "f12aa761-983e-4f09-ace4-cec62c53f37d" "Adana" "Sarıçam"
create_user "+905331111005" "Hasan Çelik" "47e399ac-46b7-4dec-ba04-8ebaf0066556" "Adana" "Karaisalı"
create_user "+905331111006" "Zeynep Arslan" "a7e99e79-d385-48e1-b483-4c29fd99c4db" "Adana" "Ceyhan"
create_user "+905331111007" "Murat Öztürk" "01ec7503-b3a9-448f-bbae-82eeb294e185" "Adana" "Kozan"

# İstanbul Firmaları
create_user "+902161111001" "Elif Aydın" "82d17c9c-f97d-43ef-b416-e8b15480ae7f" "İstanbul" "Kadıköy"
create_user "+902121111002" "Can Yılmaz" "5b3e1125-3d4a-4b36-b811-32d20f98d4a2" "İstanbul" "Beşiktaş"
create_user "+902122221003" "Deniz Kaya" "ea4212b3-e611-4385-bf2b-6895fb66f4a7" "İstanbul" "Şişli"
create_user "+902163331004" "Burak Demir" "70518784-b61c-4a76-aaa0-e5e66018a662" "İstanbul" "Ümraniye"
create_user "+902124441005" "Selin Yıldız" "c4b1897f-865d-49d8-bb7d-5c740e99d2a1" "İstanbul" "Sarıyer"
create_user "+902165551006" "Emre Şahin" "9b21e5c1-3faa-4eac-9774-1fb0c570e627" "İstanbul" "Maltepe"
create_user "+902166661007" "Derya Çelik" "5e656902-ac94-4acf-ae1d-94c8ad8e70be" "İstanbul" "Pendik"
create_user "+902127771008" "Kemal Arslan" "2d520782-1d1e-4140-9c23-f918e7423fd6" "İstanbul" "Bakırköy"
create_user "+902168881009" "Aysun Öztürk" "d3df8b28-54ee-4676-96a5-7bc2e39310aa" "İstanbul" "Çekmeköy"
create_user "+902129991010" "Serkan Aydın" "035fd707-7f50-491f-be49-66f40799a2b8" "İstanbul" "Eyüp"

echo ""
echo "========================================="
echo "✅ Tüm kullanıcılar oluşturuldu!"
echo "========================================="
echo ""
echo "Giriş bilgileri:"
echo "Şifre: GreenCo2025!"
echo ""
