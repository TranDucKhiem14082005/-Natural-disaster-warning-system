import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout';
import { RequireRole } from './components/require-role';
import { Spinner } from './components/ui';
import { HomePage } from './features/overview/home-page';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './features/auth/auth-pages';
import { AlertsPage, AlertDetailPage } from './features/alerts/alert-pages';
import { SosPage, SosTrackPage } from './features/sos/sos-pages';
import { GuidesPage, GuideDetailPage, ContactsPage } from './features/guides/guide-pages';

// Map-heavy and staff-only screens load on demand to keep the first paint small.
const named = <T, K extends keyof T>(loader: () => Promise<T>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] as unknown as React.ComponentType })));

const MapPage = named(() => import('./features/map/map-page'), 'MapPage');
const EventsPage = named(() => import('./features/events/event-pages'), 'EventsPage');
const EventDetailPage = named(() => import('./features/events/event-pages'), 'EventDetailPage');
const SheltersPage = named(() => import('./features/shelters/shelter-pages'), 'SheltersPage');
const EvacuationPage = named(() => import('./features/shelters/shelter-pages'), 'EvacuationPage');
const ReportsPage = named(() => import('./features/reports/report-pages'), 'ReportsPage');
const ReportDetailPage = named(() => import('./features/reports/report-pages'), 'ReportDetailPage');
const NewReportPage = named(() => import('./features/reports/report-pages'), 'NewReportPage');
const DashboardPage = named(() => import('./features/dashboard/dashboard-page'), 'DashboardPage');
const ProfilePage = named(() => import('./features/profile/profile-page'), 'ProfilePage');
const NotificationsPage = named(() => import('./features/notifications/notifications-page'), 'NotificationsPage');
const SosBoardPage = named(() => import('./features/sos/sos-board-page'), 'SosBoardPage');
const ManageLayout = named(() => import('./features/manage/manage-layout'), 'ManageLayout');
const AlertsManagePage = named(() => import('./features/manage/alerts-manage-page'), 'AlertsManagePage');
const AlertEditorPage = named(() => import('./features/manage/alert-editor-page'), 'AlertEditorPage');
const ReportsReviewPage = named(() => import('./features/manage/reports-review-page'), 'ReportsReviewPage');
const EventsManagePage = named(() => import('./features/manage/events-manage-page'), 'EventsManagePage');
const SheltersManagePage = named(() => import('./features/manage/shelters-manage-page'), 'SheltersManagePage');
const StatsPage = named(() => import('./features/manage/stats-page'), 'StatsPage');
const AdminLayout = named(() => import('./features/admin/admin-pages'), 'AdminLayout');
const UsersPage = named(() => import('./features/admin/admin-pages'), 'UsersPage');
const CatalogPage = named(() => import('./features/admin/admin-pages'), 'CatalogPage');
const ActivityLogsPage = named(() => import('./features/admin/admin-pages'), 'ActivityLogsPage');

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />

          <Route path="map" element={<MapPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="alerts/:id" element={<AlertDetailPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="shelters" element={<SheltersPage />} />
          <Route path="evacuation" element={<EvacuationPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="reports/new" element={<RequireRole><NewReportPage /></RequireRole>} />
          <Route path="guides" element={<GuidesPage />} />
          <Route path="guides/:slug" element={<GuideDetailPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="sos" element={<SosPage />} />
          <Route path="sos/track/:code" element={<SosTrackPage />} />

          <Route path="dashboard" element={<RequireRole><DashboardPage /></RequireRole>} />
          <Route path="profile" element={<RequireRole><ProfilePage /></RequireRole>} />
          <Route path="notifications" element={<RequireRole><NotificationsPage /></RequireRole>} />
          <Route path="sos-board" element={<RequireRole roles={['rescuer', 'officer', 'admin']}><SosBoardPage /></RequireRole>} />

          <Route path="manage" element={<RequireRole roles={['officer', 'admin']}><ManageLayout /></RequireRole>}>
            <Route index element={<Navigate to="alerts" replace />} />
            <Route path="alerts" element={<AlertsManagePage />} />
            <Route path="alerts/new" element={<AlertEditorPage />} />
            <Route path="alerts/:id" element={<AlertEditorPage />} />
            <Route path="reports" element={<ReportsReviewPage />} />
            <Route path="events" element={<EventsManagePage />} />
            <Route path="shelters" element={<SheltersManagePage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>

          <Route path="admin" element={<RequireRole roles={['admin']}><AdminLayout /></RequireRole>}>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="logs" element={<ActivityLogsPage />} />
          </Route>

          <Route path="*" element={<p className="py-12 text-center text-slate-600">Không tìm thấy trang.</p>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
