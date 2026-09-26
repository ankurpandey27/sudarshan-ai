import '@fontsource/inter-tight/latin-400.css';
import '@fontsource/inter-tight/latin-500.css';
import '@fontsource/inter-tight/latin-600.css';
import '@fontsource/inter-tight/latin-700.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import './styles.css';
import { EventsProvider } from './lib/events';
import { useSettings } from './lib/queries';
import { ToastProvider } from './components/toast';
import { Layout } from './components/layout';
import { Onboarding } from './pages/onboarding';
import { Dashboard } from './pages/dashboard';
import { Review } from './pages/review';
import { Questions } from './pages/questions';
import { Applications } from './pages/applications';
import { AnswersPage } from './pages/answers';
import { ProfilePage } from './pages/profile';
import { SettingsPage } from './pages/settings';

// Apply the saved theme before first paint.
try {
  const t = localStorage.getItem('jaa-theme');
  document.documentElement.dataset.theme = t ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch {
  document.documentElement.dataset.theme = 'light';
}

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: true } } });

function Gate({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useSettings();
  if (isLoading) {
    return (
      <div className="grid h-full place-items-center text-ink-3">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <p className="font-display text-3xl">Can't reach the agent</p>
          <p className="mt-2 text-ink-3">Make sure it is running (npm start), then refresh this page.</p>
        </div>
      </div>
    );
  }
  if (data && !data.onboarded) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <EventsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/setup" element={<Onboarding />} />
              <Route
                element={
                  <Gate>
                    <Layout />
                  </Gate>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="review" element={<Review />} />
                <Route path="questions" element={<Questions />} />
                <Route path="applications" element={<Applications />} />
                <Route path="answers" element={<AnswersPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </EventsProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
