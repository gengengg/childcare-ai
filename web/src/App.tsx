import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout, SubLayout } from './layout/AppLayout';
import { OnboardingGate } from './layout/OnboardingGate';
import { AuthGate } from './layout/AuthGate';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WriteScreen } from './screens/WriteScreen'; // 홈 화면은 lazy 안 함 (첫 화면)

// 나머지 화면은 lazy 로딩 → 초기 번들 크기 감소
const RecordsScreen = lazy(() =>
  import('./screens/RecordsScreen').then((m) => ({ default: m.RecordsScreen }))
);
const ChildrenScreen = lazy(() =>
  import('./screens/ChildrenScreen').then((m) => ({ default: m.ChildrenScreen }))
);
const RecordEditorScreen = lazy(() =>
  import('./screens/RecordEditorScreen').then((m) => ({ default: m.RecordEditorScreen }))
);
const ClassActivityScreen = lazy(() =>
  import('./screens/ClassActivityScreen').then((m) => ({ default: m.ClassActivityScreen }))
);
const ObservationScreen = lazy(() =>
  import('./screens/ObservationScreen').then((m) => ({ default: m.ObservationScreen }))
);
const StyleSetupScreen = lazy(() =>
  import('./screens/StyleSetupScreen').then((m) => ({ default: m.StyleSetupScreen }))
);
const OnboardingScreen = lazy(() =>
  import('./screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen }))
);
const ManageChildrenScreen = lazy(() =>
  import('./screens/ManageChildrenScreen').then((m) => ({ default: m.ManageChildrenScreen }))
);
const CalendarScreen = lazy(() =>
  import('./screens/CalendarScreen').then((m) => ({ default: m.CalendarScreen }))
);
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
);
const LoginScreen = lazy(() =>
  import('./screens/LoginScreen').then((m) => ({ default: m.LoginScreen }))
);
const NicknameScreen = lazy(() =>
  import('./screens/NicknameScreen').then((m) => ({ default: m.NicknameScreen }))
);
const FindIdScreen = lazy(() =>
  import('./screens/FindIdScreen').then((m) => ({ default: m.FindIdScreen }))
);
const FindPasswordScreen = lazy(() =>
  import('./screens/FindPasswordScreen').then((m) => ({ default: m.FindPasswordScreen }))
);
const ResetPasswordScreen = lazy(() =>
  import('./screens/ResetPasswordScreen').then((m) => ({ default: m.ResetPasswordScreen }))
);
const WeeklyDiaryScreen = lazy(() =>
  import('./screens/WeeklyDiaryScreen').then((m) => ({ default: m.WeeklyDiaryScreen }))
);
const WeeklyHubScreen = lazy(() =>
  import('./screens/WeeklyHubScreen').then((m) => ({ default: m.WeeklyHubScreen }))
);

/** 화면 전환 로딩 폴백 */
function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-clay-500 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AuthGate>
              <OnboardingGate>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    {/* 인증 관련 (하단 탭 없음) */}
                    <Route element={<SubLayout />}>
                      <Route path="login" element={<LoginScreen />} />
                      <Route path="nickname" element={<NicknameScreen />} />
                      <Route path="find-id" element={<FindIdScreen />} />
                      <Route path="find-password" element={<FindPasswordScreen />} />
                      <Route path="reset-password" element={<ResetPasswordScreen />} />
                      <Route path="onboarding" element={<OnboardingScreen />} />
                      <Route path="style-setup" element={<StyleSetupScreen />} />
                    </Route>

                    {/* 앱 메인 (하단 탭 항상 표시) */}
                    <Route element={<AppLayout />}>
                      <Route index element={<WriteScreen />} />
                      <Route path="records" element={<RecordsScreen />} />
                      <Route path="weekly" element={<WeeklyHubScreen />} />
                      <Route path="children" element={<ChildrenScreen />} />
                      <Route path="settings" element={<SettingsScreen />} />

                      <Route path="record/:childId" element={<RecordEditorScreen />} />
                      <Route path="class-activity" element={<ClassActivityScreen />} />
                      <Route path="observation" element={<ObservationScreen />} />
                      <Route path="manage-children" element={<ManageChildrenScreen />} />
                      <Route path="calendar" element={<CalendarScreen />} />
                      <Route
                        path="weekly-diary/:className/:year/:month/:week"
                        element={<WeeklyDiaryScreen />}
                      />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </OnboardingGate>
            </AuthGate>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
