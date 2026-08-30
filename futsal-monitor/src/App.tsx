import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, Suspense } from 'react'
import { useStore } from '@/store/store'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ROUTES } from '@/constants/routes'

import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DataQualityPage } from '@/pages/DataQualityPage'
import { PlayersPage } from '@/pages/PlayersPage'
import { PlayerProfilePage } from '@/pages/PlayerProfilePage'
import { WellnessPage } from '@/pages/WellnessPage'
import { SessionsPage } from '@/pages/SessionsPage'
import { MatchesPage } from '@/pages/MatchesPage'
import { CompetitiveLoadPage } from '@/pages/CompetitiveLoadPage'
import { InjuriesPage } from '@/pages/InjuriesPage'
import { TestsPage } from '@/pages/TestsPage'
import { StrengthPage } from '@/pages/StrengthPage'
import { TemplateListPage } from '@/pages/TemplateListPage'
import { WeeklySummaryPage } from '@/pages/WeeklySummaryPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { ImportPage } from '@/pages/ImportPage'
import { CMJPage } from '@/pages/CMJPage'
import { FollowUpDashboardPage } from '@/pages/FollowUpDashboardPage'
import { GovernancePage } from '@/pages/GovernancePage'
import { DailyDecisionPage } from '@/pages/DailyDecisionPage'
import { SeguimientoMenstrualPage } from '@/pages/SeguimientoMenstrualPage'
import { MicrocycleDashboardPage } from '@/pages/MicrocycleDashboardPage'

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
  { path: ROUTES.MICROCICLO, Component: MicrocycleDashboardPage },
  { path: ROUTES.CALIDAD_DATOS, Component: DataQualityPage },
  { path: ROUTES.JUGADORAS, Component: PlayersPage },
  { path: ROUTES.JUGADORA_PROFILE, Component: PlayerProfilePage },
  { path: ROUTES.WELLNESS, Component: WellnessPage },
  { path: ROUTES.SESIONES, Component: SessionsPage },
  { path: ROUTES.PARTIDOS, Component: MatchesPage },
  { path: ROUTES.CARGA_COMPETITIVA, Component: CompetitiveLoadPage },
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
  { path: ROUTES.SEGUIMIENTO_MENSTRUAL, Component: SeguimientoMenstrualPage },
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
