import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { AppProvider, useApp } from './context/AppContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { isConfigured } from './lib/supabase'

const SetupPage = lazy(() => import('./pages/SetupPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AddExpensePage = lazy(() => import('./pages/AddExpensePage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'))
const SavingsPage = lazy(() => import('./pages/SavingsPage'))
const SplitGroupsPage = lazy(() => import('./pages/SplitGroupsPage'))
import BottomNav from './components/BottomNav'

function AppRoutes() {
  const { user, authLoading } = useApp()
  const location = useLocation()

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-base)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '18px',
          background: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
        }}>💰</div>
        <div style={{
          width: '24px', height: '24px', border: '2px solid var(--border)',
          borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
      <AuthPage />
    </Suspense>
  )

  return (
    <div style={{
      maxWidth: '480px', margin: '0 auto',
      height: '100vh',
      background: 'var(--bg-base)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      perspective: '1200px',
    }}>
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden',
        paddingBottom: '80px', // Space for navbar
        WebkitOverflowScrolling: 'touch'
      }} className="no-scrollbar">
        <Suspense fallback={<div style={{ padding: '20px', background: 'var(--bg-base)' }} />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/add" element={<AddExpensePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/savings" element={<SavingsPage />} />
              <Route path="/splits" element={<SplitGroupsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  if (!isConfigured) {
    return (
      <>
        <SetupPage />
        <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', fontFamily: 'var(--font-ui)' } }} />
      </>
    )
  }

  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.875rem',
              fontWeight: 500,
              boxShadow: 'var(--shadow)',
            },
            success: {
              iconTheme: { primary: 'var(--accent-green)', secondary: 'white' },
            },
            error: {
              iconTheme: { primary: 'var(--accent-orange)', secondary: 'white' },
            },
          }}
        />
      </AppProvider>
    </BrowserRouter>
  )
}
