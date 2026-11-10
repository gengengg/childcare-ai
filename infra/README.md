# 온퇴근 서버 이전 가이드 (네이버클라우드 · 원화 결제)

지금 온퇴근은 해외 서비스 4곳에 나뉘어 있고, 모두 **달러로 결제**돼요.

| 역할 | 지금 | 이전 후 |
|---|---|---|
| 회원가입·로그인, DB, 파일 | Supabase 클라우드 | **네이버클라우드 서버 1대** 안의 Supabase (오픈소스) |
| 앱 화면 | Vercel | 같은 서버 |
| AI 서버 | Railway | 같은 서버 |
| 도메인 | (없음) | **가비아 등 국내 등록업체** |
| AI 모델 | OpenAI | OpenAI 유지 (달러 결제. 원화로 하려면 CLOVA Studio로 바꿔야 함, 아래 참고) |

앱 코드는 거의 그대로예요. 앱은 Supabase 주소만 바꿔서 새 서버를 바라보게 돼요.

> **중요:** 기존 Supabase 는 이전이 끝나고 1~2주 확인할 때까지 **지우지 마세요.**
> 이전 스크립트는 기존 서버에서 읽기만 해서, 문제가 생기면 앱 주소만 되돌리면 돼요.

---

## 전체 순서 한눈에 보기

1. 준비물 챙기기 (계정, 결제수단, 키)
2. 도메인 사기 (가비아)
3. 네이버클라우드 서버 만들기
4. 도메인을 서버에 연결 (DNS)
5. 서버에 설치 (`install.sh` 한 번)
6. 데이터 옮기기 (회원·알림장·파일)
7. 로그인 연결 (구글·카카오)
8. 확인 후 주소 전환, 옛 서비스 정리

`[선생님]`은 직접 하셔야 하는 일이고, `[스크립트]`는 명령어 한 줄로 끝나는 일이에요.

---

## 1. 준비물 `[선생님]`

- 네이버클라우드 계정 + 결제수단 (원화) — https://www.ncloud.com
- 도메인 (2단계에서 구매)
- **메일 발송 서비스**: 회원가입·비밀번호 찾기 코드 메일을 보내려면 SMTP 정보가 필요해요.
  원화 결제되는 업무용 메일(예: 가비아 하이웍스, 네이버 웍스) 또는 메일 발송 서비스의 SMTP 주소·아이디·비밀번호를 준비해 주세요.
- OpenAI API 키 (지금 Railway 에 넣어 둔 것과 같은 키)
- 기존 Supabase 에서 가져올 두 가지 (6단계에서 사용, **채팅에 붙여넣지 마세요**)
  - DB 접속 주소: 대시보드 → 프로젝트 → **Connect** → **Session pooler** 주소 (비밀번호는 Project Settings → Database 에서 재설정 가능)
  - Secret key: Project Settings → **API Keys** → Secret key (`sb_secret_...`)

## 2. 도메인 사기 `[선생님]`

✅ **구매 완료: `ontoegeun.kr`** (가비아). 아래 안내는 모두 이 주소 기준이에요.

## 3. 네이버클라우드 서버 만들기 `[선생님]`

콘솔 → **Server** → 서버 생성

- 운영체제: **Ubuntu 24.04** (또는 22.04)
- 사양: **vCPU 2개, 메모리 4GB** 권장 (2GB 도 가능)
  - 온퇴근은 로그인·DB·파일 저장만 써서, 설치 스크립트가 안 쓰는 부가 기능(실시간·함수·커넥션 풀러)을 끄고 스왑 2GB 를 만들어요.
  - 이 스크립트는 **Ubuntu 서버면 어느 국내 클라우드든** 똑같이 동작해요 (네이버클라우드, 가비아 클라우드 등).
- 디스크: 50GB 이상
- **공인 IP** 할당
- **ACG(방화벽)** 인바운드 허용:
  - TCP 80, 443 — 모든 곳(0.0.0.0/0)
  - TCP 22 — **내 PC IP 만**
  - 그 외(5432, 8000 등)는 열지 않기

요금은 사양·약정에 따라 달라요. 콘솔의 요금 계산기에서 확인해 주세요.

## 4. 도메인을 서버에 연결 `[선생님]`

가비아 → My가비아 → 도메인 → **DNS 설정** 에서 A 레코드 4개를 추가해요. 값은 모두 **서버 공인 IP**.

| 호스트 | 용도 |
|---|---|
| `@` | 앱 화면 (`ontoegeun.kr`) |
| `www` | `ontoegeun.kr` 로 넘겨줌 |
| `api` | 로그인·DB (`api.ontoegeun.kr`) |
| `ai` | AI 서버 (`ai.ontoegeun.kr`) |

반영까지 몇 분~몇 시간 걸릴 수 있어요. 반영 전에 5단계를 하면 HTTPS 인증서 발급이 실패하니, PC에서 `nslookup api.ontoegeun.kr` 로 공인 IP가 나오는지 먼저 확인하세요.

## 5. 서버에 설치 `[스크립트]`

서버에 접속(SSH)한 뒤 root 로:

```bash
sudo -i
apt-get update && apt-get install -y git
git clone -b ui-revamp-ontoegeun https://github.com/gengengg/childcare-ai.git /opt/ontoegeun/app
cd /opt/ontoegeun/app
```

설정 파일 두 개를 만들어요.

```bash
cp infra/ontoegeun.env.example infra/ontoegeun.env
nano infra/ontoegeun.env      # 도메인 3개, SMTP 정보 입력 (구글·카카오는 7단계에서)
cp backend/.env.example backend/.env
nano backend/.env             # OPENAI_API_KEY 입력
```

설치:

```bash
sh infra/scripts/install.sh
```

이 스크립트가 하는 일:
- Docker 설치, **공식 Supabase self-hosted** 설치 (비밀번호·키 자동 생성)
- 도메인·메일 설정, HTTPS(자동 인증서) 설정
- 앱 화면을 새 주소로 빌드, AI 서버 실행
- 매일 새벽 백업 예약

끝나면 `https://ontoegeun.kr` 에서 로그인 화면이 떠야 해요(아직 데이터는 비어 있음).
관리 화면(Studio) 비밀번호는 `sh /opt/ontoegeun/supabase/run.sh secrets` 로 볼 수 있어요.

## 6. 데이터 옮기기 `[스크립트]`

옮기는 동안 새 글이 기존 서버에 저장되면 빠질 수 있어요. 선생님들께 **잠깐(약 10분) 쓰지 말아 달라고** 미리 알려 주세요.

```bash
# 1) DB: 회원 계정(비밀번호·구글 연결 유지), 알림장, 아이, 주간일지 등 전부
export OLD_DB_URL='postgresql://postgres.xxxx:비밀번호@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
sh /opt/ontoegeun/app/infra/scripts/migrate-db.sh

# 2) 파일: 활동지 PDF 등
export OLD_URL='https://xxxx.supabase.co'
export OLD_SECRET='sb_secret_...'
sh /opt/ontoegeun/app/infra/scripts/migrate-storage.sh
```

마지막에 테이블별 개수가 **기존 / 새 서버** 로 나란히 나와요. `<-- 다름!` 표시가 없으면 성공이에요.

- 비밀번호는 그대로라 같은 이메일·비밀번호로 로그인돼요. 다만 로그인 상태는 옮기지 않으니 **모두 한 번 다시 로그인**해야 해요.

## 7. 로그인 연결 `[선생님]`

### 구글
Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → 지금 쓰는 OAuth 클라이언트 →
**승인된 리디렉션 URI** 에 `https://api.ontoegeun.kr/auth/v1/callback` 추가.
클라이언트 ID·보안 비밀을 `infra/ontoegeun.env` 의 `GOOGLE_*` 에 넣고 `GOOGLE_ENABLED=true`.

### 카카오
Kakao Developers(https://developers.kakao.com) → 내 애플리케이션 → 앱 만들기
- 카카오 로그인 → **활성화 ON**
- 카카오 로그인 → **Redirect URI**: `https://api.ontoegeun.kr/auth/v1/callback`
- 보안 → **Client Secret** 코드 생성 + 활성화
- 동의항목: 닉네임, 이메일(가능하면 필수 동의)
- 앱 키의 **REST API 키** → `KAKAO_CLIENT_ID`, Client Secret → `KAKAO_SECRET`, `KAKAO_ENABLED=true`

참고: [Supabase 카카오 로그인 문서](https://supabase.com/docs/guides/auth/social-login/auth-kakao)

적용:

```bash
cd /opt/ontoegeun/app && sh infra/scripts/install.sh
```

(`KAKAO_ENABLED=true` 면 앱 로그인 화면에 노란 **카카오 로그인** 버튼이 나타나요.)

## 8. 주소 전환과 정리 `[선생님]`

1. 새 주소에서 로그인 → 보관함에 기존 알림장이 보이는지, 활동지 다운로드가 되는지, AI 초안이 만들어지는지 확인
2. 선생님들께 새 주소(`https://ontoegeun.kr`) 안내. 홈 화면에 추가한 앱은 새 주소로 다시 추가
3. 안드로이드 앱을 쓴다면 새 주소로 다시 빌드 (`web/.env` 를 새 주소로 바꾸고 `npm run cap:android`)
4. 1~2주 문제없으면 기존 서비스 정리: Vercel 프로젝트, Railway, Supabase 프로젝트(마지막에, 백업 받은 뒤)

---

## 코드가 바뀌었을 때 (업데이트)

```bash
cd /opt/ontoegeun/app && git pull && sh infra/scripts/update.sh
```

## 백업

- 매일 03:17 에 `/opt/ontoegeun/backups` 에 DB 전체와 파일을 저장, 14일 보관
- 서버 디스크가 고장 나도 남도록 **네이버클라우드 Object Storage 에 사본**을 두길 권해요.
  Object Storage 버킷과 인증키를 만든 뒤 `/opt/ontoegeun/backup.env` 에 넣으면 자동 업로드돼요 (`infra/scripts/backup.sh` 위쪽 주석 참고).
- 지금 바로 백업: `sh /opt/ontoegeun/app/infra/scripts/backup.sh`

### 백업에서 되살리기

```bash
cd /opt/ontoegeun/supabase
PGPW=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
gunzip -c /opt/ontoegeun/backups/db-YYYYMMDD-HHMM.sql.gz | \
  docker compose exec -T -e PGPASSWORD="$PGPW" db psql -h 127.0.0.1 -U supabase_admin -d postgres
```

---

## AI 도 원화로 바꾸려면

AI 모델(OpenAI)은 달러 결제예요. 원화로 하려면 네이버클라우드 **CLOVA Studio(HyperCLOVA X)** 로 바꿔야 해요.
`backend/main.py` 의 OpenAI 호출 부분을 바꾸고, 알림장·관찰일지 결과물 품질을 다시 확인해야 해서 별도 작업으로 진행해요.

## 파일 구성

| 파일 | 하는 일 |
|---|---|
| `scripts/install.sh` | 처음 설치 + 설정 다시 적용 |
| `scripts/update.sh` | 코드 업데이트 반영 |
| `scripts/migrate-db.sh` | 기존 Supabase → 새 서버 DB 이전 (기존은 읽기만) |
| `scripts/migrate-storage.sh` / `.mjs` | 파일(Storage) 이전 |
| `scripts/backup.sh` | 매일 백업 |
| `scripts/build-web.sh` | 앱 화면 빌드 |
| `docker-compose.ontoegeun.yml` | 공식 Supabase 위에 얹는 온퇴근 설정 (AI 서버, 도메인, 소셜 로그인, 메일 템플릿) |
| `caddy/Caddyfile` | 도메인 3개 HTTPS 연결 |
| `email-templates/` | 한국어 메일 (앱의 6자리 코드 입력과 맞춤) |
| `sql/after-restore.sql` | 이전 후 트리거·파일 권한 복원 |
| `ontoegeun.env.example` | 서버 설정 예시 |

공식 Supabase self-hosted 버전은 `install.sh` 의 `SUPABASE_REF` 에 고정돼 있어요 (현재 `self-hosted/v0.8.4`).
