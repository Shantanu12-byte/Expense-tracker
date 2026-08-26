import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency, PAYMENT_METHODS } from '../lib/utils'
import toast from 'react-hot-toast'
import { ArrowLeft, ChevronDown, Plus, Repeat, X, Check } from 'lucide-react'
import { format } from 'date-fns'
import { parseSMS } from '../lib/smsParser'
import { Wand2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TagChip } from '../components/SharedUI'

const DEFAULT_PRESETS = [
  { label: 'Lunch', amount: 100, icon: '🍽️', categoryName: 'Food' },
  { label: 'Auto', amount: 50, icon: '🛺', categoryName: 'Transport' },
  { label: 'Coffee', amount: 60, icon: '☕', categoryName: 'Food' },
  { label: 'Metro', amount: 40, icon: '🚇', categoryName: 'Transport' },
  { label: 'Grocery', amount: 300, icon: '🛒', categoryName: 'Shopping' },
  { label: 'Medicine', amount: 150, icon: '💊', categoryName: 'Health' },
]

export default function AddExpensePage() {
  const navigate = useNavigate()
  const { user, categories, currency } = useApp()

  const [amount, setAmount] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState('monthly')
  const [loading, setLoading] = useState(false)
  const [presets, setPresets] = useState(DEFAULT_PRESETS)
  const [showPresetEditor, setShowPresetEditor] = useState(false)
  const [editingPreset, setEditingPreset] = useState(null)
  const [showRecurringBanner, setShowRecurringBanner] = useState(false)
  const [dueTodayExpenses, setDueTodayExpenses] = useState([])

  const [todaySpendByCategory, setTodaySpendByCategory] = useState({})
  const [showSmartPaste, setShowSmartPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    // Load saved presets
    const saved = localStorage.getItem('expense_presets')
    if (saved) setPresets(JSON.parse(saved))

    // Check for recurring expenses due today
    checkRecurringDue()
    fetchTodaySpending()
  }, [user])

  const fetchTodaySpending = async () => {
    if (!user) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('expenses')
      .select('category_id, amount')
      .eq('user_id', user.id)
      .eq('date', today)
    
    const totals = {}
    data?.forEach(exp => {
      totals[exp.category_id] = (totals[exp.category_id] || 0) + exp.amount
    })
    setTodaySpendByCategory(totals)
  }

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      const food = categories.find(c => c.name === 'Food')
      setSelectedCategory(food || categories[0])
    }
  }, [categories])

  const checkRecurringDue = async () => {
    if (!user) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('recurring_expenses')
      .select('*, categories(*)')
      .eq('user_id', user.id)
      .lte('next_due_date', today)
    if (data && data.length > 0) {
      setDueTodayExpenses(data)
      setShowRecurringBanner(true)
    }
  }

  const handleSmartPaste = async () => {
    const parsed = parseSMS(pasteText)
    if (parsed && parsed.isParsed) {
      setAmount(parsed.amount.toString())
      setNote(parsed.note)
      setPaymentMethod(parsed.paymentMethod)
      setShowSmartPaste(false)
      
      // Log to sms_imports table
      try {
        await supabase.from('sms_imports').insert({
          user_id: user.id,
          raw_sms: pasteText,
          parsed_amount: parsed.amount,
          parsed_merchant: parsed.note.replace('Paid to ', ''),
          parsed_date: date,
          payment_method: parsed.paymentMethod,
          status: 'pending'
        })
      } catch (err) {
        console.error('Failed to log SMS import', err)
      }

      setPasteText('')
      toast.success('SMS parsed successfully!')
    } else {
      toast.error('Could not parse SMS. Please check the format.')
    }
  }

  const applyPreset = (preset) => {
    setAmount(preset.amount.toString())
    setNote(preset.label)
    const cat = categories.find(c => c.name === preset.categoryName)
    if (cat) setSelectedCategory(cat)
  }

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!selectedCategory) {
      toast.error('Please select a category')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        category_id: selectedCategory.id,
        amount: parseFloat(amount),
        note,
        date,
        payment_method: paymentMethod,
      })
      if (error) throw error

      if (isRecurring) {
        const nextDue = new Date(date)
        if (frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1)
        else if (frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
        else nextDue.setMonth(nextDue.getMonth() + 1)

        await supabase.from('recurring_expenses').insert({
          user_id: user.id,
          category_id: selectedCategory.id,
          amount: parseFloat(amount),
          note,
          frequency,
          next_due_date: format(nextDue, 'yyyy-MM-dd'),
        })
      }

      // Auto-deduct from account balance
      const expenseAmt = parseFloat(amount)
      if (paymentMethod === 'Cash') {
        const currentCash = parseFloat(localStorage.getItem(`cash_balance_${user.id}`)) || 0
        localStorage.setItem(`cash_balance_${user.id}`, (currentCash - expenseAmt).toString())
      } else if (paymentMethod === 'UPI') {
        const currentUpi = parseFloat(localStorage.getItem(`upi_balance_${user.id}`)) || 0
        localStorage.setItem(`upi_balance_${user.id}`, (currentUpi - expenseAmt).toString())
      }

      toast.success('Expense added! 💰')
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  const addRecurringToday = async (recurring) => {
    try {
      await supabase.from('expenses').insert({
        user_id: user.id,
        category_id: recurring.category_id,
        amount: recurring.amount,
        note: recurring.note,
        date: format(new Date(), 'yyyy-MM-dd'),
        payment_method: 'UPI',
      })
      // Update next due date
      const nextDue = new Date()
      if (recurring.frequency === 'daily') nextDue.setDate(nextDue.getDate() + 1)
      else if (recurring.frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
      else nextDue.setMonth(nextDue.getMonth() + 1)

      await supabase.from('recurring_expenses')
        .update({ next_due_date: format(nextDue, 'yyyy-MM-dd') })
        .eq('id', recurring.id)

      setDueTodayExpenses(prev => prev.filter(e => e.id !== recurring.id))
      if (dueTodayExpenses.length <= 1) setShowRecurringBanner(false)
      toast.success(`${recurring.note} added!`)
    } catch (err) {
      toast.error('Failed to add recurring expense')
    }
  }

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{ 
        height: '100vh', 
        background: 'var(--bg-base)', 
        maxWidth: '480px', 
        width: '100%',
        position: 'fixed', 
        bottom: 0, 
        left: 0,
        right: 0,
        margin: '0 auto',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.1)' }} onClick={() => navigate(-1)} />
      
      <div className="bottom-sheet" style={{ 
        padding: '12px 20px 40px', 
        minHeight: '85vh',
        boxShadow: '0 -8px 32px rgba(28,25,23,0.1)'
      }} onClick={e => e.stopPropagation()}>
        {/* Drag Handle */}
        <div style={{ width: '32px', height: '4px', background: 'var(--bg-muted)', borderRadius: '99px', margin: '0 auto 32px' }} />

        {/* Amount Input */}
        <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '32px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{currency}</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              style={{
                fontSize: '64px', 
                fontFamily: 'var(--font-display)',
                background: 'none', 
                border: 'none',
                color: 'var(--text-primary)', 
                outline: 'none', 
                width: '100%',
                maxWidth: '240px',
                textAlign: 'center',
              }}
              autoFocus
            />
          </div>
          
          <button 
            onClick={() => setShowSmartPaste(true)}
            style={{
              marginTop: '12px', background: 'var(--bg-muted)', border: 'none',
              padding: '6px 12px', borderRadius: '99px', fontSize: '11px',
              color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Wand2 size={12} />
            Smart Paste from SMS
          </button>
        </div>

        {/* Category Picker */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="label-caps">Category</h3>
            <button 
              onClick={() => navigate('/settings')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              Manage
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
            {categories.map(cat => {
              const isActive = selectedCategory?.id === cat.id
              return (
                <button
                  key={cat.id}
                  className="tag pressable"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 16px', borderRadius: '99px',
                    background: isActive ? 'var(--accent-green)' : 'var(--bg-muted)',
                    color: isActive ? 'var(--bg-surface)' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500 }}>{cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ marginBottom: '32px' }}>
          <h3 className="label-caps" style={{ marginBottom: '12px' }}>Quick Presets</h3>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
            {presets.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No presets yet. Add them in Settings.</p>
            ) : (
              presets.map((p, i) => (
                <button
                  key={i}
                  className="pressable"
                  onClick={() => applyPreset(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', borderRadius: '99px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    whiteSpace: 'nowrap', cursor: 'pointer', boxShadow: 'var(--shadow)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{p.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{p.label}</span>
                  <span style={{ fontSize: '13px', color: 'var(--accent-orange)', fontWeight: 600 }}>₹{p.amount}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Note Input */}
        <div style={{ marginBottom: '24px' }}>
          <label className="label-caps" style={{ display: 'block', marginBottom: '8px' }}>Note</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What was this for?"
            className="input-field"
            style={{ border: 'none', background: 'var(--bg-surface)' }}
          />
        </div>

        {/* Date Row */}
        <div style={{ marginBottom: '24px' }}>
          <label className="label-caps" style={{ display: 'block', marginBottom: '8px' }}>Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-field"
            style={{ border: 'none', background: 'var(--bg-surface)' }}
          />
        </div>

        {/* Payment Methods */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }} className="no-scrollbar">
            {PAYMENT_METHODS.map(m => (
              <TagChip
                key={m}
                active={paymentMethod === m}
                onClick={() => setPaymentMethod(m)}
                className="pressable"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                {m}
              </TagChip>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', height: '52px', borderRadius: '12px', fontSize: '16px', background: 'var(--text-primary)' }}
        >
          {loading ? 'Saving...' : 'Save Expense'}
        </button>
      </div>

      {/* Smart Paste Modal */}
      {showSmartPaste && (
        <div className="modal-overlay center" onClick={() => setShowSmartPaste(false)}>
          <div className="modal-content" style={{ maxWidth: '360px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 className="italic" style={{ fontSize: '20px', marginBottom: '12px' }}>Smart Paste</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Paste your UPI/Bank transaction SMS here to automatically fill details.
            </p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="e.g. HDFC Bank: Rs 500.00 debited from a/c ... to Zomato"
              style={{
                width: '100%', height: '120px', background: 'var(--bg-base)',
                border: '1px solid var(--border)', borderRadius: '12px',
                padding: '12px', fontFamily: 'var(--font-ui)', fontSize: '14px',
                outline: 'none', resize: 'none', marginBottom: '16px',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSmartPaste(false)} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>Cancel</button>
              <button onClick={handleSmartPaste} className="btn-primary" style={{ flex: 1, padding: '12px' }}>Import</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
