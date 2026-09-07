import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App.tsx';
import { initTheme } from './lib/theme';

initTheme();

async function initNative() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#F9FAFB' });
  } catch {
    // 웹 폴백 시 무시
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {}
}

initNative();

// PWA 서비스 워커 등록 — Capacitor(WebView) 환경에서는 등록하지 않는다.
// (Capacitor 앱은 자체 asset 서빙이라 SW 불필요, PWA/브라우저에서만 설치 요건 충족용)
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 등록 실패해도 앱 동작에는 영향 없음
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
