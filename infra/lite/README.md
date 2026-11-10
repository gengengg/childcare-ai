# 온퇴근 경량판 — 네이버클라우드 Micro(1년 무료) + Supabase 무료

| 역할 | 어디서 | 비용 |
|---|---|---|
| 로그인 · DB · 파일 | Supabase (지금 프로젝트 그대로, 서울 리전) | 무료 |
| 앱 화면 `ontoegeun.kr` | 네이버클라우드 Micro (Vercel 대체) | 1년 무료 |
| AI 서버 `ai.ontoegeun.kr` | 네이버클라우드 Micro (Railway 대체) | 1년 무료 |
| 매일 DB 백업 | 네이버클라우드 Micro | 무료 |

데이터 이전은 없어요. 회원·알림장은 Supabase 에 그대로 있어요.
사용자가 늘어 서버를 통째로 옮길 때는 `infra/README.md` (전체 이전판)를 쓰면 돼요.

## 1. 가비아 DNS

A 레코드 (값 = Micro 서버 공인 IP)

| 호스트 | 용도 |
|---|---|
| `@` | 앱 화면 |
| `www` | `ontoegeun.kr` 로 넘겨줌 |
| `ai` | AI 서버 |

## 2. 서버에 설치

```bash
sudo -i
apt-get update && apt-get install -y git
git clone -b ui-revamp-ontoegeun https://github.com/gengengg/childcare-ai.git /opt/ontoegeun/app
cd /opt/ontoegeun/app
cp infra/lite/lite.env.example infra/lite/.env
nano infra/lite/.env          # SUPABASE_PUBLISHABLE_KEY, (권장) SUPABASE_DB_URL
cp backend/.env.example backend/.env
nano backend/.env             # OPENAI_API_KEY
sh infra/lite/install.sh
```

## 3. Supabase 주소 설정 `[선생님]`

Supabase 대시보드 → **Authentication → URL Configuration**
- **Site URL**: `https://ontoegeun.kr`
- **Redirect URLs** 에 추가: `https://ontoegeun.kr/**`, `https://www.ontoegeun.kr/**`
  (기존 vercel 주소는 확인이 끝날 때까지 남겨 두기)

구글 로그인은 Supabase 쪽 주소를 쓰기 때문에 Google Cloud 설정은 바꿀 필요 없어요.

## 4. 확인 후 정리

1. `https://ontoegeun.kr` 에서 로그인 → 보관함 → AI 초안 만들기까지 확인
2. 선생님들께 새 주소 안내
3. 1~2주 뒤 Vercel · Railway 해지

## 업데이트 / 백업

```bash
cd /opt/ontoegeun/app && git pull && sh infra/lite/update.sh   # 코드 업데이트
sh /opt/ontoegeun/app/infra/lite/backup.sh                     # 지금 백업
```

백업은 매일 03:17, `/opt/ontoegeun/backups` 에 14일 보관.

되살리기 (Supabase SQL 접속 주소로):

```bash
gunzip -c /opt/ontoegeun/backups/public-YYYYMMDD-HHMM.sql.gz | \
  docker run --rm -i --network host postgres:17 psql "$SUPABASE_DB_URL"
```
