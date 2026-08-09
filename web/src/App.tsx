import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AppLayout, SubLayout } from './layout/AppLayout';
import { OnboardingGate } from './layout/OnboardingGate';
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

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <OnboardingGate>
          <Routes>
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
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </OnboardingGate>
      </BrowserRouter>
    </ToastProvider>
  );
}
