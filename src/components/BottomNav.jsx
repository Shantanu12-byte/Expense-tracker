import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, BarChart3, Settings, Plus } from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/history', icon: CalendarDays, label: 'History' },
  { path: '/add', icon: Plus, label: 'Add', isFab: true },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      height: '64px',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 100,
      width: '100%',
    }}>
      {navItems.map(({ path, icon: Icon, label, isFab }) => {
        const isActive = location.pathname === path

        if (isFab) {
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="pulse-ring"
              style={{
                width: '52px', height: '52px',
                borderRadius: '50%',
                background: 'var(--text-primary)',
                border: 'none',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(28,25,23,0.25)',
                transform: 'translateY(-20px)',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          )
        }

        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: isActive ? '2px' : '0',
              background: 'none', border: 'none', cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              flex: 1,
              height: '100%',
            }}
          >
            <Icon 
              size={22} 
              strokeWidth={isActive ? 2 : 1.5} 
              fill={isActive ? 'var(--text-primary)' : 'none'} 
            />
            {isActive && (
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 600, 
                fontFamily: 'var(--font-ui)',
                letterSpacing: '0.02em'
              }}>
                {label}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
