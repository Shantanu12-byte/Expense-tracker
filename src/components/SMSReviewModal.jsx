import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency } from '../lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { X, Check, Trash2, Calendar, ShoppingBag, Coffee, Car, CreditCard, Utensils } from 'lucide-react'

const getIcon = (cat) => {
  switch (cat) {
    case 'Food': return <Utensils size={18} />
    case 'Transport': return <Car size={18} />
    case 'Shopping': return <ShoppingBag size={18} />
    case 'Entertainment': return <Coffee size={18} />
    default: return <CreditCard size={18} />
  }
}

export default function SMSReviewModal({ onClose, onUpdate }) {
  const { user, categories, currency } = useApp()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPending()
  }, [])

  const loadPending = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sms_imports')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPending(data || [])
    setLoading(false)
  }

  const handleAccept = async (item) => {
    try {
      // 1. Create real expense
      const { data: exp, error: expErr } = await supabase.from('expenses').insert({
        user_id: user.id,
        amount: item.parsed_amount,
        note: item.parsed_merchant,
        category_id: categories.find(c => c.name === (item.category || 'Others'))?.id || categories[0].id,
        date: item.parsed_date || format(new Date(), 'yyyy-MM-dd'),
        payment_method: item.payment_method || 'UPI'
      }).select().single()

      if (expErr) throw expErr

      // 2. Update import status
      await supabase.from('sms_imports')
        .update({ status: 'accepted', expense_id: exp.id })
        .eq('id', item.id)

      setPending(prev => prev.filter(p => p.id !== item.id))
      toast.success('Expense added ✓')
      if (onUpdate) onUpdate()
    } catch (err) {
      toast.error('Failed to accept')
    }
  }

  const handleIgnore = async (id) => {
    await supabase.from('sms_imports').update({ status: 'rejected' }).eq('id', id)
    setPending(prev => prev.filter(p => p.id !== id))
    if (onUpdate) onUpdate()
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end' }} onClick={onClose}>
      <div className="bottom-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 className="italic" style={{ fontSize: '24px' }}>Review transactions</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{pending.length} pending found in SMS</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              All caught up!
            </div>
          ) : (
            pending.map(item => (
              <div key={item.id} style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '20px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getIcon(item.category)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '16px' }}>{item.parsed_merchant}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', background: 'var(--bg-muted)', padding: '2px 8px', borderRadius: '4px' }}>{item.payment_method}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.parsed_date}</span>
                    </div>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: '18px' }}>{formatCurrency(item.parsed_amount, currency)}</p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleIgnore(item.id)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--bg-base)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
                    Ignore
                  </button>
                  <button onClick={() => handleAccept(item)} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--text-primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                    Add expense
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
