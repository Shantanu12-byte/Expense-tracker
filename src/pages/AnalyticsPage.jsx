import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency, getCategoryColor, getCategoryIcon, getCategoryName, getMonthRange } from '../lib/utils'
import { format, subMonths, startOfMonth, endOfMonth, getDay, differenceInDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { syncSubscriptions } from '../lib/subscriptionUtils'
import { motion } from 'framer-motion'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AnalyticsPage() {
  const { user, categories, currency } = useApp()
  const [loading, setLoading] = useState(true)
  const [currentMonthData, setCurrentMonthData] = useState([])
  const [prevMonthData, setPrevMonthData] = useState([])
  const [dayOfWeekData, setDayOfWeekData] = useState([])
  const [avgDaily, setAvgDaily] = useState(0)
  const [insights, setInsights] = useState([])
  const [topCategories, setTopCategories] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [goals, setGoals] = useState([])
  const [paceHistory, setPaceHistory] = useState([])
  const [isMounted, setIsMounted] = useState(false)

  const load = useCallback(async () => {
    if (!user || !categories.length) return
    setLoading(true)
    await syncSubscriptions(user, categories)
    await Promise.all([loadComparison(), loadDayOfWeek(), loadSubscriptions(), loadGoals(), loadPaceHistory()])
    setIsMounted(true)
    setLoading(false)
  }, [user, categories])

  useEffect(() => { load() }, [load])

  const loadComparison = async () => {
    const { start: curStart, end: curEnd } = getMonthRange(0)
    const { start: prevStart, end: prevEnd } = getMonthRange(-1)

    const [curRes, prevRes] = await Promise.all([
      supabase.from('expenses').select('category_id, amount, date').eq('user_id', user.id).gte('date', curStart).lte('date', curEnd),
      supabase.from('expenses').select('category_id, amount').eq('user_id', user.id).gte('date', prevStart).lte('date', prevEnd),
    ])

    const curExpenses = curRes.data || []
    const prevExpenses = prevRes.data || []

    // Group by category
    const curGrouped = groupByCategory(curExpenses)
    const prevGrouped = groupByCategory(prevExpenses)

    const allCatIds = new Set([...Object.keys(curGrouped), ...Object.keys(prevGrouped)])
    const comparison = Array.from(allCatIds).map(catId => ({
      name: getCategoryName(categories, catId),
      icon: getCategoryIcon(categories, catId),
      color: getCategoryColor(categories, catId),
      current: curGrouped[catId] || 0,
      previous: prevGrouped[catId] || 0,
    })).sort((a, b) => b.current - a.current).slice(0, 6)

    setCurrentMonthData(comparison)
    setPrevMonthData(comparison)

    // Avg daily
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const curTotal = curExpenses.reduce((s, e) => s + e.amount, 0)
    setAvgDaily(curTotal / Math.min(new Date().getDate(), daysInMonth))

    // Top 3
    const top = comparison.slice(0, 3)
    setTopCategories(top)

    // Insights
    const insightList = []
    comparison.forEach(cat => {
      if (cat.previous > 0 && cat.current > 0) {
        const diff = ((cat.current - cat.previous) / cat.previous) * 100
        if (Math.abs(diff) >= 10) {
          insightList.push({
            text: `You spent ${Math.abs(diff).toFixed(0)}% ${diff > 0 ? 'more' : 'less'} on ${cat.name} compared to last month`,
            type: diff > 0 ? 'warning' : 'success',
            icon: cat.icon,
          })
        }
      }
    })
    setInsights(insightList.slice(0, 3))
  }

  const loadDayOfWeek = async () => {
    const { start, end } = getMonthRange(0)
    const { data } = await supabase.from('expenses').select('date, amount').eq('user_id', user.id).gte('date', start).lte('date', end)

    const dayTotals = Array(7).fill(0)
    const dayCounts = Array(7).fill(0)
    ;(data || []).forEach(exp => {
      const d = new Date(exp.date)
      // getDay() returns 0=Sun, so adjust to Mon=0
      const dayIdx = (d.getDay() + 6) % 7
      dayTotals[dayIdx] += exp.amount
      dayCounts[dayIdx]++
    })

    setDayOfWeekData(DAYS.map((day, i) => ({
      name: day,
      value: dayCounts[i] > 0 ? dayTotals[i] / dayCounts[i] : 0
    })))
  }

  const loadSubscriptions = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
    setSubscriptions(data || [])
  }

  const loadGoals = async () => {
    if (!user) return
    const { data } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', false)
    setGoals(data || [])
  }

  const loadPaceHistory = async () => {
    if (!user) return
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse()
    const history = []

    const startOfRange = format(startOfMonth(months[0]), 'yyyy-MM-dd')
    const endOfRange = format(endOfMonth(months[months.length - 1]), 'yyyy-MM-dd')

    const { data: profile } = await supabase.from('profiles').select('monthly_budget').eq('id', user.id).single()
    const budget = profile?.monthly_budget || 0

    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('amount, date')
      .eq('user_id', user.id)
      .gte('date', startOfRange)
      .lte('date', endOfRange)

    months.forEach(month => {
      const monthStr = format(month, 'yyyy-MM')
      const total = (allExpenses || [])
        .filter(e => e.date.startsWith(monthStr))
        .reduce((s, e) => s + e.amount, 0)
      
      const over = Math.max(0, total - budget)
      const under = Math.min(total, budget)

      history.push({
        month: format(month, 'MMM'),
        under,
        over,
        total,
        budget
      })
    })
    setPaceHistory(history)
  }

  const groupByCategory = (expenses) => {
    const map = {}
    expenses.forEach(e => { map[e.category_id] = (map[e.category_id] || 0) + e.amount })
    return map
  }

  const CustomTooltip = useMemo(() => ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="custom-tooltip" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '8px 12px', borderRadius: '8px' }}>
        <p className="label-caps" style={{ marginBottom: '4px' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontSize: '14px', fontWeight: 500, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span>{p.name}:</span>
            <span className="amount">{formatCurrency(p.value, currency)}</span>
          </p>
        ))}
      </div>
    )
  }, [currency])

  if (loading) return (
    <div style={{ padding: '40px 20px' }}>
      <div className="shimmer" style={{ height: '60px', borderRadius: '12px', marginBottom: '24px' }} />
      <div className="shimmer" style={{ height: '200px', borderRadius: '16px', marginBottom: '24px' }} />
      <div className="shimmer" style={{ height: '200px', borderRadius: '16px', marginBottom: '24px' }} />
    </div>
  )

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="page-container" 
      style={{ background: 'var(--bg-base)', minHeight: '100vh' }}
    >
      {/* Header */}
      <header style={{ padding: '24px 0 32px' }}>
        <h1 className="italic" style={{ fontSize: '28px', color: 'var(--text-primary)' }}>Insights</h1>
        <p className="label-caps" style={{ marginTop: '4px' }}>
          {format(new Date(), 'MMM')} vs {format(subMonths(new Date(), 1), 'MMM')} comparison
        </p>
      </header>

      <div className="page-enter">
        {/* Month Comparison Chart */}
        <section className="section-gap">
          <h2 className="label-caps" style={{ marginBottom: '16px' }}>Category Comparison</h2>
          <div style={{ height: '240px', width: '100%' }}>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentMonthData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tickFormatter={(v) => currentMonthData.find(d => d.name === v)?.icon || v} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.5 }} />
                  <Bar dataKey="current" name="This Month" fill="var(--text-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previous" name="Last Month" fill="var(--bg-muted)" stroke="var(--border-strong)" strokeWidth={1} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Spending Habits Chart */}
        <section className="section-gap">
          <h2 className="label-caps" style={{ marginBottom: '16px' }}>Spending habits</h2>
          <div style={{ height: '180px', width: '100%' }}>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.5 }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {dayOfWeekData.map((entry, i) => (
                      <Cell key={i} fill="var(--accent-orange)" opacity={entry.amount > 0 ? 1 : 0.2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        {/* Active Subscriptions */}
        <section className="section-gap">
          <h2 className="label-caps" style={{ marginBottom: '16px' }}>Active Subscriptions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subscriptions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px' }}>No recurring expenses yet</p>
            ) : (
              subscriptions.map(sub => (
                <div key={sub.id} style={{ 
                  background: 'var(--bg-surface)', padding: '14px 16px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--shadow)'
                }}>
                  <div style={{ fontSize: '20px' }}>{sub.emoji || '📅'}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>{sub.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Next: {sub.next_renewal_date ? format(new Date(sub.next_renewal_date), 'dd MMM') : 'N/A'}
                    </p>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-orange)' }}>
                    {formatCurrency(sub.amount, currency)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Insight Cards */}
        <section className="section-gap">
          <h2 className="label-caps" style={{ marginBottom: '16px' }}>Observations</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {insights.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No major trends detected yet</p>
            ) : (
              insights.map((ins, i) => (
                <div key={i} style={{
                  background: 'var(--bg-surface)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow)',
                  borderLeft: `4px solid ${ins.type === 'success' ? 'var(--accent-green)' : 'var(--accent-orange)'}`,
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{ins.icon}</span>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-ui)' }}>
                    {ins.text}
                  </p>
                </div>
              ))
            )}
            
            {/* General Insight Card */}
            <div style={{
              background: 'var(--bg-surface)',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: 'var(--shadow)',
              borderLeft: '4px solid var(--text-primary)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>☕</span>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-ui)' }}>
                Your average daily spend is <span className="amount">{formatCurrency(avgDaily, currency)}</span>. Keeping this under control will help you reach your monthly budget goal.
              </p>
            </div>
          </div>
        </section>

        {/* Monthly Pace History */}
        <section className="section-gap">
          <h2 className="label-caps" style={{ marginBottom: '16px' }}>Monthly Pace History</h2>
          <div style={{ height: '220px', background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paceHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0].payload
                    return (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
                        <p style={{ fontSize: '12px', fontWeight: 600 }}>Spent: {formatCurrency(data.total, currency)}</p>
                        <p style={{ fontSize: '10px', color: data.total > data.budget ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                          {data.total > data.budget ? `Over by ${formatCurrency(data.over, currency)}` : 'Within budget'}
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="under" stackId="a" fill="var(--accent-green)" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="over" stackId="a" fill="var(--accent-orange)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
            Green: Spent within budget • Orange: Spent over budget
          </p>
        </section>

        {/* Goal Contribution Suggestion */}
        {goals.length > 0 && (
          <section className="section-gap">
            <div style={{
              background: 'var(--bg-surface)',
              padding: '20px',
              borderRadius: '16px',
              boxShadow: 'var(--shadow)',
              borderLeft: '4px solid var(--accent-green)',
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '24px' }}>🎯</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Savings Suggestion</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '4px' }}>
                    To hit all your goals on time, aim to save <span className="amount" style={{ color: 'var(--accent-green)' }}>
                      {(() => {
                        const today = new Date()
                        const endOfMon = endOfMonth(today)
                        const daysRemaining = differenceInDays(endOfMon, today) + 1
                        
                        const totalDaily = goals.reduce((sum, goal) => {
                          if (!goal.deadline) return sum
                          const daysLeft = differenceInDays(new Date(goal.deadline), today)
                          const remaining = goal.target_amount - (goal.saved_amount || 0)
                          if (daysLeft <= 0 || remaining <= 0) return sum
                          return sum + (remaining / daysLeft)
                        }, 0)
                        
                        return formatCurrency(totalDaily * daysRemaining, currency)
                      })()}
                    </span> this month.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </motion.div>
  )
}
