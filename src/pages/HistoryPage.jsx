import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency, getCategoryColor, getCategoryIcon, getCategoryName, hexToRgba } from '../lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Trash2, Filter } from 'lucide-react'
import { TransactionRow } from '../components/SharedUI'

export default function HistoryPage() {
  const { user, categories, currency } = useApp()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [expenses, setExpenses] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [dayExpenses, setDayExpenses] = useState([])
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const loadExpenses = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    let query = supabase.from('expenses').select('id, amount, note, date, category_id, payment_method').eq('user_id', user.id)
      .gte('date', start).lte('date', end).order('date', { ascending: false })

    if (filterCategory) query = query.eq('category_id', filterCategory)
    if (filterPayment) query = query.eq('payment_method', filterPayment)

    const { data } = await query
    setExpenses(data || [])
    setLoading(false)
  }, [user, currentMonth, filterCategory, filterPayment])

  useEffect(() => { loadExpenses() }, [loadExpenses])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = startOfMonth(currentMonth).getDay()

  const getDayTotal = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return expenses.filter(e => e.date === dayStr).reduce((s, e) => s + e.amount, 0)
  }

  const selectDay = (day) => {
    setSelectedDay(day)
    const dayStr = format(day, 'yyyy-MM-dd')
    setDayExpenses(expenses.filter(e => e.date === dayStr))
    setShowPanel(true)
  }

  const deleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Deleted!')
    setDeleteId(null)
    setDayExpenses(prev => prev.filter(e => e.id !== id))
    loadExpenses()
  }

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0)

  const weeks = []
  let week = []
  // Fill initial empty days
  for (let i = 0; i < firstDayOfWeek; i++) week.push(null)
  
  days.forEach(day => {
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    week.push(day)
  })
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  const getWeekTotal = (weekDays) => {
    return weekDays
      .filter(d => d !== null)
      .reduce((sum, day) => sum + getDayTotal(day), 0)
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div>
            <h1 className="italic" style={{ fontSize: '32px', color: 'var(--text-primary)', lineHeight: 1 }}>{format(currentMonth, 'MMMM')}</h1>
            <h1 className="italic" style={{ fontSize: '32px', color: 'var(--text-muted)', lineHeight: 1 }}>{format(currentMonth, 'yyyy')}</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setCurrentMonth(m => subMonth(m))} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentMonth(m => addMonth(m))} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <p className="label-caps">Total Spent: {formatCurrency(monthTotal, currency)}</p>
      </header>

      {/* Calendar Grid */}
      <section style={{ marginBottom: '40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '12px' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {weeks.map((weekDays, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {weekDays.map((day, j) => {
                if (!day) return <div key={`empty-${j}`} />
                const total = getDayTotal(day)
                const isSelected = selectedDay && isSameDay(day, selectedDay)
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={j}
                    onClick={() => selectDay(day)}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--text-primary)' : 'transparent',
                      color: isSelected ? 'white' : 'var(--text-primary)',
                      position: 'relative',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontWeight: isToday ? 600 : 400 }}>{format(day, 'd')}</span>
                    {total > 0 && !isSelected && (
                      <div style={{
                        position: 'absolute', bottom: '6px',
                        width: '3px', height: '3px', borderRadius: '50%',
                        background: 'var(--accent-orange)'
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
            {getWeekTotal(weekDays) > 0 && (
              <div style={{ 
                textAlign: 'right', 
                fontSize: '10px', 
                color: 'var(--text-muted)', 
                fontFamily: 'var(--font-ui)',
                marginTop: '4px'
              }}>
                Week: {formatCurrency(getWeekTotal(weekDays), currency)}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Detail Panel */}
      <AnimatePresence>
        {showPanel && selectedDay && (
          <motion.section 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              bottom: 0, left: 0, right: 0,
              background: 'var(--bg-surface)',
              padding: '24px 20px 100px',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -8px 32px rgba(28,25,23,0.1)',
              zIndex: 100
            }}
          >
            <div style={{ width: '32px', height: '4px', background: 'var(--bg-muted)', borderRadius: '99px', margin: '0 auto 24px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="italic" style={{ fontSize: '20px' }}>{format(selectedDay, 'EEEE, dd MMM')}</h3>
              <button onClick={() => setShowPanel(false)} className="pressable" style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {dayExpenses.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No transactions</p>
              ) : (
                dayExpenses.map(exp => (
                  <TransactionRow 
                    key={exp.id}
                    icon={getCategoryIcon(categories, exp.category_id)}
                    title={exp.note || getCategoryName(categories, exp.category_id)}
                    subtitle={`${exp.payment_method} • ${format(new Date(exp.date), 'dd MMM')}`}
                    amount={exp.amount}
                    currency={currency}
                    isNegative={true}
                    iconBg={hexToRgba(getCategoryColor(categories, exp.category_id), 0.15)}
                    iconColor={getCategoryColor(categories, exp.category_id)}
                    onClick={() => setDeleteId(exp.id)}
                  />
                ))
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
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
      {/* Delete Confirmation omitted for brevity in chunk but ensuring closing tag is correct */}
    </motion.div>
  )
}

const subMonth = (date) => { const d = new Date(date); d.setMonth(d.getMonth() - 1); return d }
const addMonth = (date) => { const d = new Date(date); d.setMonth(d.getMonth() + 1); return d }
