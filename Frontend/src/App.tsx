import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { RequireRole } from './components/require-role';
import { Spinner } from './components/ui';
import { PublicLayout } from './layouts/public-layout';
import { useAuth } from './store/auth-context';
import { PORTAL_HOME } from './utils/roles';
import { HomePage } from './features/overview/home-page';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './features/auth/auth-pages';
import { AlertsPage, AlertDetailPage } from './features/alerts/alert-pages';
import { SosPage, SosTrackPage } from './features/sos/sos-pages';
import { GuidesPage, GuideDetailPage, ContactsPage } from './features/guides/guide-pages';

// Map-heavy and staff-only screens load on demand to keep the first paint small.
const named = <T, K extends keyof T>(loader: () => Promise<T>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] as unknown as ComponentType })));

const RescuerLayout = named(() => import('./layouts/rescuer-layout'), 'RescuerLayout');
const ConsoleLayout = named(() => import('./layouts/console-layout'), 'ConsoleLayout');

const MapPage = named(() => import('./features/map/map-page'), 'MapPage');
const EventsPage = named(() => import('./features/events/event-pages'), 'EventsPage');
const EventDetailPage = named(() => import('./features/events/event-pages'), 'EventDetailPage');
const SheltersPage = named(() => import('./features/shelters/shelter-pages'), 'SheltersPage');
const EvacuationPage = named(() => import('./features/shelters/shelter-pages'), 'EvacuationPage');
const ReportsPage = named(() => import('./features/reports/report-pages'), 'ReportsPage');
const ReportDetailPage = named(() => import('./features/reports/report-pages'), 'ReportDetailPage');
const NewReportPage = named(() => import('./features/reports/report-pages'), 'NewReportPage');
const MyReportsPage = named(() => import('./features/reports/report-pages'), 'MyReportsPage');
const CitizenHomePage = named(() => import('./features/citizen/citizen-home-page'), 'CitizenHomePage');
const ProfilePage = named(() => import('./features/profile/profile-page'), 'ProfilePage');
const NotificationsPage = named(() => import('./features/notifications/notifications-page'), 'NotificationsPage');

const RescuerTasksPage = named(() => import('./features/rescuer/rescuer-tasks-page'), 'RescuerTasksPage');
const RescuerTaskPage = named(() => import('./features/rescuer/rescuer-task-page'), 'RescuerTaskPage');
const RescuerMapPage = named(() => import('./features/rescuer/rescuer-map-page'), 'RescuerMapPage');
const RescuerHistoryPage = named(() => import('./features/rescuer/rescuer-history-page'), 'RescuerHistoryPage');

const OfficerDashboardPage = named(() => import('./features/manage/officer-dashboard-page'), 'OfficerDashboardPage');
const SosDispatchPage = named(() => import('./features/manage/sos-dispatch-page'), 'SosDispatchPage');
const AlertsManagePage = named(() => import('./features/manage/alerts-manage-page'), 'AlertsManagePage');
const AlertEditorPage = named(() => import('./features/manage/alert-editor-page'), 'AlertEditorPage');
const ReportsReviewPage = named(() => import('./features/manage/reports-review-page'), 'ReportsReviewPage');
const EventsManagePage = named(() => import('./features/manage/events-manage-page'), 'EventsManagePage');
const SheltersManagePage = named(() => import('./features/manage/shelters-manage-page'), 'SheltersManagePage');
const StatsPage = named(() => import('./features/manage/stats-page'), 'StatsPage');

const AdminDashboardPage = named(() => import('./features/admin/admin-dashboard-page'), 'AdminDashboardPage');
const UsersPage = named(() => import('./features/admin/admin-pages'), 'UsersPage');
const CatalogPage = named(() => import('./features/admin/admin-pages'), 'CatalogPage');
const ActivityLogsPage = named(() => import('./features/admin/admin-pages'), 'ActivityLogsPage');

/** Sends a signed-in user to their own portal (old /dashboard links, "Của tôi" for staff). */
function PortalHome() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={user ? PORTAL_HOME[user.role] : '/login'} replace />;
}

function LegacyManageRedirect() {
  const { '*': rest } = useParams();
  return <Navigate to={`/officer/${rest ?? ''}`} replace />;
}

function LegacySosBoardRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'rescuer' ? '/rescuer' : '/officer/sos'} replace />;
}

function NotFound() {
  return <p className="py-16 text-center text-slate-600">Không tìm thấy trang.</p>;
}

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Public site + citizen area */}
        <Route element={<PublicLayout />}>
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
          <Route path="reports/new" element={<RequireRole><NewReportPage /></RequireRole>} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="guides" element={<GuidesPage />} />
          <Route path="guides/:slug" element={<GuideDetailPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="sos" element={<SosPage />} />
          <Route path="sos/track/:code" element={<SosTrackPage />} />

          <Route path="me" element={<RequireRole roles={['citizen']} redirectOthers><CitizenHomePage /></RequireRole>} />
          <Route path="me/profile" element={<RequireRole><ProfilePage /></RequireRole>} />
          <Route path="me/notifications" element={<RequireRole><NotificationsPage /></RequireRole>} />
          <Route path="me/reports" element={<RequireRole><MyReportsPage /></RequireRole>} />

          <Route path="dashboard" element={<PortalHome />} />
          <Route path="profile" element={<Navigate to="/me/profile" replace />} />
          <Route path="notifications" element={<Navigate to="/me/notifications" replace />} />
          <Route path="sos-board" element={<LegacySosBoardRedirect />} />
          <Route path="manage/*" element={<LegacyManageRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Rescue team field app */}
        <Route path="rescuer" element={<RequireRole roles={['rescuer']} redirectOthers><RescuerLayout /></RequireRole>}>
          <Route index element={<RescuerTasksPage />} />
          <Route path="sos/:id" element={<RescuerTaskPage />} />
          <Route path="map" element={<RescuerMapPage />} />
          <Route path="history" element={<RescuerHistoryPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Officer console (admins share it) */}
        <Route path="officer" element={<RequireRole roles={['officer', 'admin']} redirectOthers><ConsoleLayout /></RequireRole>}>
          <Route index element={<OfficerDashboardPage />} />
          <Route path="sos" element={<SosDispatchPage />} />
          <Route path="alerts" element={<AlertsManagePage />} />
          <Route path="alerts/new" element={<AlertEditorPage />} />
          <Route path="alerts/:id" element={<AlertEditorPage />} />
          <Route path="reports" element={<ReportsReviewPage />} />
          <Route path="events" element={<EventsManagePage />} />
          <Route path="shelters" element={<SheltersManagePage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Admin console */}
        <Route path="admin" element={<RequireRole roles={['admin']} redirectOthers><ConsoleLayout /></RequireRole>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="logs" element={<ActivityLogsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
