import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ScopeProvider } from './context/ScopeContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import { ProtectedRoute } from './components/ProtectedRoute.jsx'
import { NavBar } from './components/NavBar.jsx'
import { SidebarShell } from './components/SidebarShell.jsx'
import { SignUpPage } from './pages/SignUpPage.jsx'
import { SignInPage } from './pages/SignInPage.jsx'
import { AcceptInvitePage } from './pages/AcceptInvitePage.jsx'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { TeamPage } from './pages/TeamPage.jsx'
import { PersonPage } from './pages/PersonPage.jsx'
import { ConferencePage } from './pages/ConferencePage.jsx'
import { ConferenceIndexPage } from './pages/ConferenceIndexPage.jsx'
import { MilestonesPage } from './pages/MilestonesPage.jsx'
import { AdminPage } from './pages/AdminPage.jsx'
import { StudentsPage } from './pages/StudentsPage.jsx'
import { GoalsPage } from './pages/GoalsPage.jsx'
import { InterventionsPage } from './pages/InterventionsPage.jsx'
import { ObservationsPage } from './pages/ObservationsPage.jsx'
import { AddObservationPage } from './pages/AddObservationPage.jsx'
import { UsersPage } from './pages/UsersPage.jsx'
import { SettingsPage } from './pages/SettingsPage.jsx'
// Public marketing site
import { MarketingLayout } from './marketing/MarketingLayout.jsx'
import { HomePage } from './marketing/pages/HomePage.jsx'
import { FeaturesPage } from './marketing/pages/FeaturesPage.jsx'
import { AboutPage } from './marketing/pages/AboutPage.jsx'
import { PricingPage } from './marketing/pages/PricingPage.jsx'
import { ContactPage } from './marketing/pages/ContactPage.jsx'
import { FAQPage } from './marketing/pages/FAQPage.jsx'
import { SecurityPage } from './marketing/pages/SecurityPage.jsx'
import { PrivacyPage } from './marketing/pages/PrivacyPage.jsx'
import { TermsPage } from './marketing/pages/TermsPage.jsx'
import { NotFoundPage } from './marketing/pages/NotFoundPage.jsx'

function PublicLayout({ children }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScopeProvider>
        <ToastProvider>
        <ConfirmProvider>
        <Routes>
          {/* Public marketing site (its own nav/footer + light/dark theme) */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            {/* 404 — anything not matched by an app/auth route below */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Auth */}
          <Route path="/signup" element={<PublicLayout><SignUpPage /></PublicLayout>} />
          <Route path="/signin" element={<PublicLayout><SignInPage /></PublicLayout>} />
          <Route path="/accept-invite/:token" element={<PublicLayout><AcceptInvitePage /></PublicLayout>} />
          <Route path="/forgot-password" element={<PublicLayout><ForgotPasswordPage /></PublicLayout>} />
          <Route path="/reset-password" element={<PublicLayout><ResetPasswordPage /></PublicLayout>} />

          {/* Authenticated application */}
          <Route
            element={
              <ProtectedRoute>
                <SidebarShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/observations/new" element={<AddObservationPage />} />
            <Route path="/observations" element={<ObservationsPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/interventions" element={<InterventionsPage />} />
            <Route path="/teams/:teamId" element={<TeamPage />} />
            <Route path="/people/:personId" element={<PersonPage />} />
            <Route path="/people/:personId/conference" element={<ConferencePage />} />
            <Route path="/conference" element={<ConferenceIndexPage />} />
            <Route path="/milestones" element={<MilestonesPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        </ConfirmProvider>
        </ToastProvider>
        </ScopeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
