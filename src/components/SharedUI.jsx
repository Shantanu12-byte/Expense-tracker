import { format } from 'date-fns'

// Format Currency Utility for Shared UI
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function BalanceHeroCard({ title, amount, currency, deltaText, variant = 'surface', paceStatus }) {
  const isGreen = variant === 'green'
  return (
    <div className="glass-card" style={{
      background: isGreen ? 'var(--accent-green)' : 'var(--bg-surface)',
      color: isGreen ? 'white' : 'var(--text-primary)',
      border: isGreen ? 'none' : '1px solid var(--border)',
      padding: '24px',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <p className="label-caps" style={{ color: isGreen ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', marginBottom: '8px' }}>
        {title}
      </p>
      <h2 className="amount" style={{ fontSize: '48px', lineHeight: 1, marginBottom: deltaText ? '12px' : '0' }}>
        {formatCurrency(amount, currency)}
      </h2>
      {deltaText && (
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: isGreen ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)' }}>
          {deltaText}
        </p>
      )}
      {paceStatus && (
        <p style={{ marginTop: '16px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: isGreen ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
          {paceStatus}
        </p>
      )}
    </div>
  )
}

export function StatChip({ icon, label, amount, currency, type = 'neutral' }) {
  const color = type === 'income' ? 'var(--accent-green)' : type === 'expense' ? 'var(--accent-orange)' : 'var(--text-primary)'
  const bg = type === 'income' ? 'rgba(63, 108, 81, 0.15)' : type === 'expense' ? 'rgba(189, 83, 43, 0.15)' : 'var(--bg-muted)'
  return (
    <div className="glass-card pressable" style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      flex: 1
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: bg,
        color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px'
      }}>
        {icon}
      </div>
      <div>
        <p className="label-caps" style={{ marginBottom: '4px' }}>{label}</p>
        <p className="amount" style={{ fontSize: '20px', color, fontWeight: 600 }}>
          {formatCurrency(amount, currency)}
        </p>
      </div>
    </div>
  )
}

export function TransactionRow({ icon, title, subtitle, amount, currency, isNegative = true, onClick, iconBg, iconColor }) {
  return (
    <div className="pressable" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '16px 12px',
      borderBottom: '1px solid var(--border)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 0.2s ease',
      borderRadius: '8px'
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background: iconBg || 'var(--bg-muted)',
        color: iconColor || 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '20px',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtitle}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p className="amount" style={{ fontSize: '16px', color: isNegative ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
          {isNegative ? '-' : '+'}{formatCurrency(Math.abs(amount), currency)}
        </p>
      </div>
    </div>
  )
}

export function SectionHeader({ title, actionText, onAction, rightContent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
      <h3 className="italic" style={{ fontSize: '20px' }}>{title}</h3>
      {actionText && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>
          {actionText}
        </button>
      )}
      {rightContent}
    </div>
  )
}

export function ProgressBar({ percent, color, trackColor = 'var(--bg-muted)' }) {
  return (
    <div style={{ height: '6px', background: trackColor, borderRadius: '99px', overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, percent))}%`, background: color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
    </div>
  )
}

export function TagChip({ active, children, onClick, style = {} }) {
  return (
    <button onClick={onClick} className="tag pressable" style={{
      background: active ? 'var(--text-primary)' : 'var(--bg-muted)',
      color: active ? 'white' : 'var(--text-secondary)',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 16px',
      fontSize: '13px',
      whiteSpace: 'nowrap',
      ...style
    }}>
      {children}
    </button>
  )
}

export function GoalCard({ icon, title, current, target, currency, onClick, iconBg, iconColor, showViewAll }) {
  const pct = target > 0 ? (current / target) * 100 : 0
  const isOffTrack = pct < 50 // simplistic status logic
  
  return (
    <div className="glass-card pressable" onClick={onClick} style={{ padding: '24px', cursor: 'pointer', marginBottom: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: iconBg || 'var(--bg-muted)', color: iconColor || 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)' }}>{title}</p>
        </div>
        {showViewAll && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>View All</span>}
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <p className="amount" style={{ fontSize: '32px', color: 'var(--text-primary)', lineHeight: 1 }}>
          {formatCurrency(current, currency)}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          of {formatCurrency(target, currency)} target
        </p>
      </div>

      <ProgressBar percent={pct} color={isOffTrack ? 'var(--accent-orange)' : 'var(--accent-green)'} />
      
      <div style={{ 
        marginTop: '16px', padding: '10px 12px', borderRadius: '8px', 
        background: isOffTrack ? 'rgba(189, 83, 43, 0.15)' : 'rgba(63, 108, 81, 0.15)',
        color: isOffTrack ? 'var(--accent-orange)' : 'var(--accent-green)',
        fontSize: '12px', fontWeight: 600
      }}>
        {isOffTrack ? "You're behind schedule" : "You're on track!"}
      </div>
    </div>
  )
}

export function BudgetRow({ icon, name, cadence, spent, limit, currency, iconBg, iconColor }) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0
  const color = pct > 90 ? 'var(--accent-orange)' : pct > 75 ? '#D4AF37' : 'var(--accent-green)'
  
  return (
    <div className="glass-card pressable" style={{ padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: iconBg || 'var(--bg-muted)', color: iconColor || 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '2px' }}>{name}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cadence}</p>
      </div>
      <div style={{ textAlign: 'right', width: '100px' }}>
        <p className="amount" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '2px' }}>
          {formatCurrency(spent, currency)}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>
          of {formatCurrency(limit, currency)}
        </p>
        <ProgressBar percent={pct} color={color} />
      </div>
    </div>
  )
}
