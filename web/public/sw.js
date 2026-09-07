// 최소 서비스 워커 — PWA 설치 요건(fetch 핸들러 등록)을 충족하기 위한 것.
// 앱 자체는 Supabase/OpenAI 백엔드 의존이라 오프라인 캐싱은 하지 않음.
// 새 배포가 나오면 사용자가 앱을 다시 열었을 때 최신 페이지를 받도록 network-first 로만 동작.

const VERSION = 'v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 네트워크 우선. 오프라인이면 브라우저 기본 오류 화면.
  // (SPA 라우팅은 index.html 재요청으로 처리되므로 별도 로직 불필요)
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(fetch(req).catch(() => Response.error()));
});
