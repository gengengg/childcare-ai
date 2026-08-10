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

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <AuthGate>
            <OnboardingGate>
              <Routes>
                <Route path="login" element={<LoginScreen />} />
                <Route path="nickname" element={<NicknameScreen />} />
                <Route path="find-id" element={<FindIdScreen />} />
                <Route path="find-password" element={<FindPasswordScreen />} />
                <Route path="reset-password" element={<ResetPasswordScreen />} />
                <Route element={<AppLayout />}>
                  <Route index element={<WriteScreen />} />
                  <Route path="records" element={<RecordsScreen />} />
                  <Route path="children" element={<ChildrenScreen />} />
                </Route>
                <Route element={<SubLayout />}>
                  <Route path="record/:childId" element={<RecordEditorScreen />} />
                  <Route path="class-activity" element={<ClassActivityScreen />} />
                  <Route path="observation" element={<ObservationScreen />} />
                  <Route path="style-setup" element={<StyleSetupScreen />} />
                  <Route path="onboarding" element={<OnboardingScreen />} />
                  <Route path="manage-children" element={<ManageChildrenScreen />} />
                  <Route path="calendar" element={<CalendarScreen />} />
                  <Route
                    path="weekly-diary/:className/:year/:month/:week"
                    element={<WeeklyDiaryScreen />}
                  />
                  <Route path="settings" element={<SettingsScreen />} />
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
