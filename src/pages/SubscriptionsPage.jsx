import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency } from '../lib/utils'
import { format, addMonths, addYears } from 'date-fns'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, Calendar, ExternalLink, Bell } from 'lucide-react'
import { syncSubscriptions } from '../lib/subscriptionUtils'
import { motion } from 'framer-motion'

export default function SubscriptionsPage() {
  const navigate = useNavigate()
  const { user, categories, currency } = useApp()
  const [loading, setLoading] = useState(true)
  const [subs, setSubs] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [cycle, setCycle] = useState('monthly')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState('Entertainment')

  useEffect(() => {
    if (user && categories.length > 0) loadSubs()
  }, [user, categories])

  const loadSubs = async (force = false) => {
    setLoading(true)
    if (user && categories.length > 0) {
      await syncSubscriptions(user, categories, force)
    }
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('next_renewal_date', { ascending: true })
    setSubs(data || [])
    setLoading(false)
  }

  const handleAddSub = async (e) => {
    e.preventDefault()
    if (!name || !amount) return

    try {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        name,
        amount: parseFloat(amount),
        billing_cycle: cycle,
        next_renewal_date: date,
        category
      })
      if (error) throw error
      toast.success('Subscription added!')
      setShowAdd(false)
      loadSubs(true) // Force sync for newly added sub
    } catch (err) {
      toast.error('Failed to add subscription')
    }
  }

  const deleteSub = async (id) => {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (error) toast.error('Failed to remove')
    else {
      toast.success('Removed')
      loadSubs()
    }
  }

  const totalMonthly = subs.reduce((acc, sub) => {
    if (sub.billing_cycle === 'monthly') return acc + sub.amount
    if (sub.billing_cycle === 'yearly') return acc + (sub.amount / 12)
    return acc
  }, 0)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="page-container" 
      style={{ background: 'var(--bg-base)', minHeight: '100vh' }}
    >
      <header style={{ padding: '24px 0 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="italic" style={{ fontSize: '24px' }}>Subscriptions</h1>
      </header>

      {/* Summary Card */}
      <section className="section-gap">
        <div style={{ background: 'var(--text-primary)', color: 'white', padding: '24px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <p className="label-caps" style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Monthly Commitment</p>
          <h2 className="amount" style={{ fontSize: '32px' }}>{formatCurrency(totalMonthly, currency)}</h2>
        </div>
      </section>

      {/* Subs List */}
      <section className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="label-caps">Active Services</h3>
          <button onClick={() => setShowAdd(true)} style={{ background: 'var(--accent-orange)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Add New
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {subs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-surface)', borderRadius: '16px', color: 'var(--text-muted)' }}>
              No active subscriptions tracked.
            </div>
          ) : (
            subs.map(sub => (
              <div key={sub.id} style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  {sub.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '15px' }}>{sub.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Next: {format(new Date(sub.next_renewal_date), 'dd MMM')} • {sub.billing_cycle}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>{formatCurrency(sub.amount, currency)}</p>
                  <button onClick={() => deleteSub(sub.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer' }}>Remove</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay center" onClick={() => setShowAdd(false)}>
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 className="italic" style={{ fontSize: '20px', marginBottom: '20px' }}>New Subscription</h3>
            <form onSubmit={handleAddSub}>
              <div style={{ marginBottom: '16px' }}>
                <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Service Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Netflix" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', outline: 'none' }} required />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Amount</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', outline: 'none' }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Cycle</label>
                  <select value={cycle} onChange={e => setCycle(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', outline: 'none' }}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half_yearly">Half Yearly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Next Renewal</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', outline: 'none' }} required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, background: 'var(--accent-orange)' }}>Add Sub</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
