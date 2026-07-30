import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency, getMonthRange, getCategoryIcon, getCategoryName, getCategoryColor } from '../lib/utils'
import { format, subDays, startOfWeek, subWeeks, subMonths, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Target, Edit2, Trash2, ChevronRight, Receipt, ArrowRight, Users, X, Gauge } from 'lucide-react'
import toast from 'react-hot-toast'
import SMSReviewModal from '../components/SMSReviewModal'
import { syncSubscriptions } from '../lib/subscriptionUtils'
import { parseSMS } from '../lib/smsParser'
import { motion, AnimatePresence } from 'framer-motion'

const TREND_TABS = ['14 Days', '8 Weeks', '6 Months']

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, profile, categories, currency } = useApp()

  const [todayTotal, setTodayTotal] = useState(0)
  const [weekTotal, setWeekTotal] = useState(0)
  const [monthTotal, setMonthTotal] = useState(0)
  const [categoryData, setCategoryData] = useState([])
  const [pendingSMSCount, setPendingSMSCount] = useState(0)
  const [showSMSReview, setShowSMSReview] = useState(false)
  const [isPaceBannerDismissed, setIsPaceBannerDismissed] = useState(localStorage.getItem(`pace_dismiss_${format(new Date(), 'yyyy-MM-dd')}`) === 'true')
  const [trendData, setTrendData] = useState([])
  const [recentExpenses, setRecentExpenses] = useState([])
  const [trendTab, setTrendTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [goals, setGoals] = useState([])
  const [isMounted, setIsMounted] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    await syncSubscriptions(user, categories)
    await Promise.all([
      loadTotals(),
      loadCategoryBreakdown(),
      loadRecentExpenses(),
      loadPendingSMS(),
      loadGoals(),
    ])
    setIsMounted(true)
    setLoading(false)
  }, [user, categories])

  useEffect(() => { loadDashboard() }, [loadDashboard])
  useEffect(() => { loadTrendData() }, [trendTab, user])

  // Handle Share Target
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const sharedText = searchParams.get('text')
    if (sharedText && user) {
      handleSharedSMS(sharedText)
    }
  }, [searchParams, user])

  const handleSharedSMS = async (text) => {
    const result = parseSMS(text)
    if (!result || result.isRefund) {
      toast.error('Could not parse transaction from this message')
      setSearchParams({})
      return
    }

    const { error } = await supabase.from('sms_imports').insert({
      user_id: user.id,
      sms_body: text,
      amount: result.amount,
      merchant: result.merchant,
      category: result.category,
      payment_method: result.paymentMethod,
      is_parsed: true
    })

    if (!error) {
      setSearchParams({}) // Clear params
      loadPendingSMS() // Refresh count
      setShowSMSReview(true) // Open modal
    }
  }

  // Realtime subscription
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${user.id}` }, () => {
        loadDashboard()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, loadDashboard])

  const loadTotals = async () => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const { start: monthStart, end: monthEnd } = getMonthRange()

    const [todayRes, weekRes, monthRes] = await Promise.all([
      supabase.from('expenses').select('amount').eq('user_id', user.id).eq('date', today),
      supabase.from('expenses').select('amount').eq('user_id', user.id)
        .gte('date', format(weekStart, 'yyyy-MM-dd')).lte('date', today),
      supabase.from('expenses').select('amount').eq('user_id', user.id)
        .gte('date', monthStart).lte('date', monthEnd),
    ])

    setTodayTotal(todayRes.data?.reduce((s, e) => s + e.amount, 0) || 0)
    setWeekTotal(weekRes.data?.reduce((s, e) => s + e.amount, 0) || 0)
    setMonthTotal(monthRes.data?.reduce((s, e) => s + e.amount, 0) || 0)
  }

  const loadCategoryBreakdown = async () => {
    const { start, end } = getMonthRange()
    const { data } = await supabase
      .from('expenses')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)

    if (!data || !categories.length) return

    const grouped = {}
    data.forEach(e => {
      grouped[e.category_id] = (grouped[e.category_id] || 0) + e.amount
    })
    const total = Object.values(grouped).reduce((s, v) => s + v, 0)
    const result = Object.entries(grouped)
      .map(([catId, amt]) => ({
        name: getCategoryName(categories, catId),
        value: amt,
        color: getCategoryColor(categories, catId),
        icon: getCategoryIcon(categories, catId),
        pct: total > 0 ? ((amt / total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    setCategoryData(result)
  }

  const loadTrendData = async () => {
    if (!user) return
    const now = new Date()
    let points = []

    if (trendTab === 0) {
      // Last 14 days
      for (let i = 13; i >= 0; i--) {
        const d = subDays(now, i)
        points.push({ label: format(d, 'dd MMM'), date: format(d, 'yyyy-MM-dd') })
      }
      const { data } = await supabase.from('expenses').select('date, amount').eq('user_id', user.id)
        .gte('date', points[0].date).lte('date', today)
      const map = {}
      data?.forEach(e => { map[e.date] = (map[e.date] || 0) + e.amount })
      setTrendData(points.map(p => ({ name: p.label, amount: map[p.date] || 0 })))
    } else if (trendTab === 1) {
      // Last 8 weeks
      for (let i = 7; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
        const we = new Date(ws); we.setDate(ws.getDate() + 6)
        points.push({ label: format(ws, 'dd MMM'), start: format(ws, 'yyyy-MM-dd'), end: format(we, 'yyyy-MM-dd') })
      }
      const { data } = await supabase.from('expenses').select('date, amount').eq('user_id', user.id)
        .gte('date', points[0].start).lte('date', today)
      setTrendData(points.map(p => {
        const amt = data?.filter(e => e.date >= p.start && e.date <= p.end).reduce((s, e) => s + e.amount, 0) || 0
        return { name: p.label, amount: amt }
      }))
    } else {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i)
        points.push({ label: format(d, 'MMM yy'), start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') })
      }
      const { data } = await supabase.from('expenses').select('date, amount').eq('user_id', user.id)
        .gte('date', points[0].start).lte('date', today)
      setTrendData(points.map(p => {
        const amt = data?.filter(e => e.date >= p.start && e.date <= p.end).reduce((s, e) => s + e.amount, 0) || 0
        return { name: p.label, amount: amt }
      }))
    }
  }

  const loadRecentExpenses = async () => {
    const { data } = await supabase
      .from('expenses').select('id, amount, note, date, category_id, payment_method').eq('user_id', user.id)
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(10)
    setRecentExpenses(data || [])
  }

  const loadPendingSMS = async () => {
    if (!user) return
    const { count } = await supabase
      .from('sms_imports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending')
    setPendingSMSCount(count || 0)
  }

  const loadGoals = async () => {
    if (!user) return
    const { data } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .order('deadline', { ascending: true })
      .limit(5)
    setGoals(data || [])
  }

  const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Expense deleted')
    setDeleteId(null)
    loadDashboard()
  }

  const budget = profile?.monthly_budget
  const budgetPct = budget ? Math.min((monthTotal / budget) * 100, 100) : 0

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="custom-tooltip" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '8px 12px', borderRadius: '8px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</p>
        <p style={{ color: 'var(--accent-orange)', fontFamily: 'var(--font-display)', fontSize: '16px' }}>{formatCurrency(payload[0].value, currency)}</p>
      </div>
    )
  }

  if (loading && recentExpenses.length === 0) return <LoadingSkeleton />

  const displayName = profile?.full_name?.split(' ')[0] || user.user_metadata?.full_name?.split(' ')[0] || 'User'

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="page-container" 
      style={{ padding: '0 20px 100px' }}
    >
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0 32px' }}>
        <div>
          <p className="label-caps" style={{ marginBottom: '2px' }}>✨ Good {getGreeting()},</p>
          <h1 className="italic" style={{ fontSize: '28px', color: 'var(--text-primary)' }}>
            {displayName}
          </h1>
        </div>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'var(--bg-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)'
        }}>
          {profile?.full_name?.split(' ').map(n => n[0]).join('') || 'A'}
        </div>
      </header>

      {/* Hero Spending Card */}
      <section className="section-gap">
        <div style={{
          background: 'var(--text-primary)',
          borderRadius: '16px',
          padding: '24px',
          color: 'var(--bg-surface)',
          boxShadow: '0 12px 32px rgba(28,25,23,0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <p className="label-caps" style={{ color: '#A8A29E', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Spent this month
          </p>
          <h2 className="amount" style={{ fontSize: '48px', lineHeight: 1, marginBottom: '24px' }}>
            {formatCurrency(monthTotal, currency)}
          </h2>
          
          {budget ? (() => {
            const today = new Date()
            const dayOfMonth = today.getDate()
            const daysInMonth = getDaysInMonth(today)
            const budgetUsedPct = (monthTotal / budget) * 100
            const dayProgressPct = (dayOfMonth / daysInMonth) * 100
            const expectedSpend = (dayOfMonth / daysInMonth) * budget
            const delta = monthTotal - expectedSpend
            const dailyAllowance = Math.max(0, (budget - monthTotal) / Math.max(1, daysInMonth - dayOfMonth))
            
            // Pace state
            let paceStatus = 'on'
            let paceColor = 'rgba(255,255,255,0.2)'
            if (budgetUsedPct > dayProgressPct + 5) { paceStatus = 'fast'; paceColor = 'var(--accent-orange)' }
            else if (budgetUsedPct < dayProgressPct - 5) { paceStatus = 'slow'; paceColor = 'var(--accent-green)' }

            return (
              <>
                <div style={{ marginBottom: '12px', position: 'relative', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px' }}>
                  {/* Day Progress Layer */}
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${dayProgressPct}%`, background: 'rgba(255,255,255,0.05)', borderRadius: '99px' }} />
                  {/* Spend Progress Layer */}
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(100, budgetUsedPct)}%`, background: paceStatus === 'fast' ? 'var(--accent-orange)' : (paceStatus === 'slow' ? 'var(--accent-green)' : 'white'), borderRadius: '99px', transition: 'width 1s ease' }} />
                  {/* Today Marker */}
                  <div style={{ position: 'absolute', top: '-4px', left: `${dayProgressPct}%`, height: '14px', width: '2px', background: 'rgba(255,255,255,0.4)', borderRadius: '1px' }} />
                </div>
                
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: '#78716C', display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {paceStatus === 'fast' ? `Spending fast — ${formatCurrency(Math.abs(delta), currency)} over expected` : 
                     paceStatus === 'slow' ? `Great pace — ${formatCurrency(Math.abs(delta), currency)} under budget` : 
                     'On pace'}
                  </span>
                  <span style={{ fontWeight: 600, color: '#A8A29E' }}>{formatCurrency(dailyAllowance, currency)}/day left</span>
                </p>
              </>
            )
          })() : (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: '#78716C' }}>
              Set a monthly budget to see your pace
            </p>
          )}
        </div>
      </section>

      {/* Goals Quick Scroll */}
      {goals.length > 0 && (
        <section className="section-gap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="label-caps">Your Goals</h3>
            <button onClick={() => navigate('/savings')} style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', fontSize: '11px', fontWeight: 600 }}>
              View All
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }} className="no-scrollbar">
            {goals.map(goal => {
              const pct = Math.min(100, Math.round(((goal.saved_amount || 0) / goal.target_amount) * 100))
              return (
                <div 
                  key={goal.id} 
                  onClick={() => navigate('/savings')}
                  style={{ 
                    flexShrink: 0, width: '140px', background: 'var(--bg-surface)', padding: '12px', 
                    borderRadius: '16px', border: '1px solid var(--border)', cursor: 'pointer' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{goal.emoji}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.title}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-muted)', borderRadius: '99px', overflow: 'hidden', marginBottom: '4px' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: goal.color || 'var(--accent-orange)', borderRadius: '99px' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{pct}% complete</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Pace Alert Banner */}
      {(() => {
        if (!budget || !profile?.pace_alert_enabled || isPaceBannerDismissed) return null;
        
        const today = new Date()
        const dayOfMonth = today.getDate()
        if (dayOfMonth < 4) return null; // Too early in the month

        const daysInMonth = getDaysInMonth(today)
        const budgetUsedPct = (monthTotal / budget) * 100
        const dayProgressPct = (dayOfMonth / daysInMonth) * 100
        const threshold = profile?.pace_alert_threshold || 80

        if (budgetUsedPct > threshold && dayProgressPct < 70) {
          const dailyRate = monthTotal / dayOfMonth
          const projectedEmptyDay = Math.floor(budget / dailyRate)
          const dailyAllowance = Math.max(0, (budget - monthTotal) / (daysInMonth - dayOfMonth))

          return (
            <section className="section-gap" style={{ position: 'relative' }}>
              <div style={{
                background: 'var(--accent-orange-light)',
                padding: '16px 20px',
                borderRadius: '16px',
                display: 'flex',
                gap: '12px',
                border: '1px solid rgba(200,96,42,0.1)'
              }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-orange)', 
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                  <Gauge size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--accent-orange)', marginBottom: '2px' }}>
                    You've used {Math.round(budgetUsedPct)}% of your budget but it's only day {dayOfMonth}.
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    At this rate, you'll run out on the {projectedEmptyDay}{projectedEmptyDay === 1 ? 'st' : projectedEmptyDay === 2 ? 'nd' : projectedEmptyDay === 3 ? 'rd' : 'th'}. 
                    You have <span style={{ fontWeight: 600 }}>{formatCurrency(dailyAllowance, currency)}/day</span> left.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    localStorage.setItem(`pace_dismiss_${format(new Date(), 'yyyy-MM-dd')}`, 'true')
                    setIsPaceBannerDismissed(true)
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </section>
          )
        }
        return null
      })()}

      {/* Quick Stats Row */}
      <section className="section-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <StatCard label="Today" value={todayTotal} currency={currency} />
        <StatCard label="This Week" value={weekTotal} currency={currency} />
        <StatCard label="Avg/Day" value={monthTotal / (new Date().getDate())} currency={currency} />
      </section>

      {/* Advanced Features Quick Access */}
      <section className="section-gap" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <button onClick={() => navigate('/subscriptions')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Receipt size={20} color="var(--accent-orange)" />
          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subs</span>
        </button>
        <button onClick={() => navigate('/savings')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Target size={20} color="var(--accent-green)" />
          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goals</span>
        </button>
        <button onClick={() => navigate('/splits')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Users size={20} color="#3b82f6" />
          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Splits</span>
        </button>
      </section>
      
      {/* SMS Review Banner */}
      {pendingSMSCount > 0 && (
        <section className="section-gap">
          <div 
            onClick={() => setShowSMSReview(true)}
            style={{
              background: 'var(--accent-green-light)',
              padding: '16px 20px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              border: '1px solid rgba(74,124,89,0.1)'
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'var(--accent-green)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Receipt size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--accent-green)' }}>
                {pendingSMSCount} new transactions found
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Parsed from your bank SMS alerts
              </p>
            </div>
            <ArrowRight size={18} color="var(--accent-green)" />
          </div>
        </section>
      )}

      {/* Category Breakdown */}
      <section className="section-gap">
        <h3 className="italic" style={{ fontSize: '20px', marginBottom: '16px' }}>Where it goes</h3>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', margin: '0 -20px', padding: '0 20px' }} className="no-scrollbar">
          {categoryData.map((cat, i) => (
            <div key={i} style={{
              flexShrink: 0,
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: '140px'
            }}>
              <span style={{ fontSize: '20px' }}>{cat.icon}</span>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{cat.name}</p>
                <p className="amount" style={{ fontSize: '16px' }}>{formatCurrency(cat.value, currency)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Spending Trend */}
      <section className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="italic" style={{ fontSize: '20px' }}>Spending trend</h3>
          <div style={{ display: 'flex', background: 'var(--bg-muted)', padding: '2px', borderRadius: '99px' }}>
            {['D', 'W', 'M'].map((t, i) => (
              <button key={t} onClick={() => setTrendTab(i)} style={{
                padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, border: 'none',
                background: trendTab === i ? 'var(--text-primary)' : 'transparent',
                color: trendTab === i ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: '180px', width: '100%' }}>
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} padding={{ left: 10, right: 10 }} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="var(--accent-orange)" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 4, fill: 'var(--accent-orange)', stroke: 'white', strokeWidth: 2 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Recent Transactions */}
      <section>
        <h3 className="label-caps" style={{ marginBottom: '16px' }}>Recent</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recentExpenses.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '14px' }}>No transactions yet</p>
          ) : (
            recentExpenses.map((exp, i) => (
              <div key={exp.id} style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px 0',
                borderBottom: i === recentExpenses.length - 1 ? 'none' : '1px solid var(--border)'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'var(--bg-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  {getCategoryIcon(categories, exp.category_id)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 500, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {exp.note || getCategoryName(categories, exp.category_id)}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {format(new Date(exp.date), 'dd MMM')} • {exp.payment_method}
                  </p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <p className="amount" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                    {formatCurrency(exp.amount, currency)}
                  </p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(exp.id)
                    }}
                    style={{ 
                      background: 'none', border: 'none', color: 'var(--text-muted)', 
                      cursor: 'pointer', padding: '4px', borderRadius: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-orange)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="modal-overlay center" onClick={() => setDeleteId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '320px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '12px' }}>Delete transaction?</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setDeleteId(null)} className="btn-primary" style={{ flex: 1, background: 'var(--bg-muted)', color: 'var(--text-primary)' }}>Cancel</button>
              <button onClick={() => deleteExpense(deleteId)} className="btn-primary" style={{ flex: 1, background: 'var(--accent-orange)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* SMS Review Modal */}
      {showSMSReview && (
        <SMSReviewModal 
          onClose={() => setShowSMSReview(false)} 
          onUpdate={loadDashboard}
        />
      )}
    </motion.div>
  )
}

const StatCard = ({ label, value, currency }) => (
  <div style={{
    background: 'var(--bg-muted)',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  }}>
    <span className="label-caps" style={{ fontSize: '10px' }}>{label}</span>
    <span className="amount" style={{ fontSize: '20px' }}>{formatCurrency(value, currency)}</span>
  </div>
)

const LoadingSkeleton = () => (
  <div style={{ padding: '40px 20px' }}>
    <div className="shimmer" style={{ height: '180px', borderRadius: '16px', marginBottom: '24px' }} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
      <div className="shimmer" style={{ height: '70px', borderRadius: '12px' }} />
      <div className="shimmer" style={{ height: '70px', borderRadius: '12px' }} />
      <div className="shimmer" style={{ height: '70px', borderRadius: '12px' }} />
    </div>
    <div className="shimmer" style={{ height: '100px', borderRadius: '12px' }} />
  </div>
)

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
