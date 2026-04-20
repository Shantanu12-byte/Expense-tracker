import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency, getCategoryColor, getCategoryIcon, getCategoryName } from '../lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Trash2, Filter } from 'lucide-react'

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
        <h1 className="italic" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px' }}>
          {format(currentMonth, 'MMMM yyyy')}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="label-caps">Total Spent: {formatCurrency(monthTotal, currency)}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setCurrentMonth(m => subMonth(m))} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentMonth(m => addMonth(m))} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
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
      {showPanel && selectedDay && (
        <section className="page-enter">
          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="italic" style={{ fontSize: '20px' }}>{format(selectedDay, 'EEEE, dd MMM')}</h3>
            <button onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dayExpenses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No transactions</p>
            ) : (
              dayExpenses.map(exp => (
                <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    {getCategoryIcon(categories, exp.category_id)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>{exp.note || getCategoryName(categories, exp.category_id)}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{exp.payment_method} • {format(new Date(exp.date), 'dd MMM')}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="amount" style={{ fontSize: '16px', marginBottom: '4px' }}>{formatCurrency(exp.amount, currency)}</p>
                    <button 
                      onClick={() => setDeleteId(exp.id)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

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
