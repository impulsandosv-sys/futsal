import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, Suspense, lazy } from 'react'
import { useStore } from '@/store/store'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ROUTES } from '@/constants/routes'



const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const PlayersPage = lazy(() => import('@/pages/PlayersPage').then(m => ({ default: m.PlayersPage })))
const PlayerProfilePage = lazy(() => import('@/pages/PlayerProfilePage').then(m => ({ default: m.PlayerProfilePage })))
const WellnessPage = lazy(() => import('@/pages/WellnessPage').then(m => ({ default: m.WellnessPage })))
const SessionsPage = lazy(() => import('@/pages/SessionsPage').then(m => ({ default: m.SessionsPage })))
const MatchesPage = lazy(() => import('@/pages/MatchesPage').then(m => ({ default: m.MatchesPage })))
const InjuriesPage = lazy(() => import('@/pages/InjuriesPage').then(m => ({ default: m.InjuriesPage })))
const TestsPage = lazy(() => import('@/pages/TestsPage').then(m => ({ default: m.TestsPage })))
const StrengthPage = lazy(() => import('@/pages/StrengthPage').then(m => ({ default: m.StrengthPage })))
const TemplateListPage = lazy(() => import('@/pages/TemplateListPage').then(m => ({ default: m.TemplateListPage })))
const WeeklySummaryPage = lazy(() => import('@/pages/WeeklySummaryPage').then(m => ({ default: m.WeeklySummaryPage })))
const AlertsPage = lazy(() => import('@/pages/AlertsPage').then(m => ({ default: m.AlertsPage })))
const ImportPage = lazy(() => import('@/pages/ImportPage').then(m => ({ default: m.ImportPage })))
const CMJPage = lazy(() => import('@/pages/CMJPage').then(m => ({ default: m.CMJPage })))
const FollowUpDashboardPage = lazy(() => import('@/pages/FollowUpDashboardPage').then(m => ({ default: m.FollowUpDashboardPage })))
const GovernancePage = lazy(() => import('@/pages/GovernancePage').then(m => ({ default: m.GovernancePage })))
const DailyDecisionPage = lazy(() => import('@/pages/DailyDecisionPage').then(m => ({ default: m.DailyDecisionPage })))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }
  return <>{children}</>
}

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="p-8 text-xs text-surface-400">Cargando...</div>}>
    {children}
  </Suspense>
)

const routes = [
  { path: ROUTES.DASHBOARD, Component: DashboardPage },
  { path: ROUTES.JUGADORAS, Component: PlayersPage },
  { path: ROUTES.JUGADORA_PROFILE, Component: PlayerProfilePage },
  { path: ROUTES.WELLNESS, Component: WellnessPage },
  { path: ROUTES.SESIONES, Component: SessionsPage },
  { path: ROUTES.PARTIDOS, Component: MatchesPage },
  { path: ROUTES.LESIONES, Component: InjuriesPage },
  { path: ROUTES.TESTS, Component: TestsPage },
  { path: ROUTES.FUERZA, Component: StrengthPage },
  { path: ROUTES.PLANTILLAS_FUERZA, Component: TemplateListPage },
  { path: ROUTES.SEMANAL, Component: WeeklySummaryPage },
  { path: ROUTES.ALERTAS, Component: AlertsPage },
  { path: ROUTES.DECISION_DIARIA, Component: DailyDecisionPage },
  { path: ROUTES.IMPORTAR, Component: ImportPage },
  { path: ROUTES.CMJ, Component: CMJPage },
  { path: ROUTES.SEGUIMIENTO, Component: FollowUpDashboardPage },
  { path: ROUTES.TEMPORADAS, Component: GovernancePage },
]

function App() {
  const loadAll = useStore((s) => s.loadAll)
  const isAuthenticated = useStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (isAuthenticated) {
      loadAll()
    }
  }, [isAuthenticated, loadAll])

  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<SuspenseWrapper><LoginPage /></SuspenseWrapper>} />
        {routes.map(({ path, Component }) => (
          <Route key={path} path={path} element={
            <ProtectedRoute>
              <Layout>
                <ErrorBoundary>
                  <SuspenseWrapper>
                    <Component />
                  </SuspenseWrapper>
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          } />
        ))}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
