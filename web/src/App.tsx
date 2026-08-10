import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AppLayout, SubLayout } from './layout/AppLayout';
import { OnboardingGate } from './layout/OnboardingGate';
import { AuthGate } from './layout/AuthGate';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { WriteScreen } from './screens/WriteScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { ChildrenScreen } from './screens/ChildrenScreen';
import { RecordEditorScreen } from './screens/RecordEditorScreen';
import { ClassActivityScreen } from './screens/ClassActivityScreen';
import { ObservationScreen } from './screens/ObservationScreen';
import { StyleSetupScreen } from './screens/StyleSetupScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ManageChildrenScreen } from './screens/ManageChildrenScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NicknameScreen } from './screens/NicknameScreen';
import { FindIdScreen } from './screens/FindIdScreen';
import { FindPasswordScreen } from './screens/FindPasswordScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { WeeklyDiaryScreen } from './screens/WeeklyDiaryScreen';
import { WeeklyHubScreen } from './screens/WeeklyHubScreen';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate>
            <OnboardingGate>
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
                  {/* 5개 메인 탭 */}
                  <Route index element={<WriteScreen />} />
                  <Route path="records" element={<RecordsScreen />} />
                  <Route path="weekly" element={<WeeklyHubScreen />} />
                  <Route path="children" element={<ChildrenScreen />} />
                  <Route path="settings" element={<SettingsScreen />} />

                  {/* 서브 화면 (하단 탭 유지) */}
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
            </OnboardingGate>
          </AuthGate>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
