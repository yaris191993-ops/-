import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicHeader, SiteFooter } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { BoardPage } from './pages/BoardPage';
import { BookingPage } from './pages/BookingPage';
import { CheckPage } from './pages/CheckPage';
import { KioskPage } from './pages/KioskPage';

function AppShell() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/admin')) {
    return <AdminPage />;
  }

  if (pathname.startsWith('/kiosk')) {
    return <KioskPage />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/check" element={<CheckPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="*" element={<BookingPage />} />
        </Routes>
      </main>
      <SiteFooter tone="cream" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
