import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { DEFAULT_CATEGORIES, PAYMENT_METHODS, formatCurrency } from '../lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { LogOut, Plus, X, Edit2, Check, Download, ChevronRight, Palette, Trash2 } from 'lucide-react'

const CURRENCIES = [
  { code: 'INR', label: '₹ Indian Rupee' },
  { code: 'USD', label: '$ US Dollar' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'GBP', label: '£ British Pound' },
]

const DEFAULT_PRESETS = [
  { label: 'Lunch', amount: 100, icon: '🍽️', categoryName: 'Food' },
  { label: 'Auto', amount: 50, icon: '🛺', categoryName: 'Transport' },
  { label: 'Coffee', amount: 60, icon: '☕', categoryName: 'Food' },
  { label: 'Metro', amount: 40, icon: '🚇', categoryName: 'Transport' },
  { label: 'Grocery', amount: 300, icon: '🛒', categoryName: 'Shopping' },
  { label: 'Medicine', amount: 150, icon: '💊', categoryName: 'Health' },
]

export default function SettingsPage() {
  const { user, profile, categories, currency, refreshCategories, refreshProfile } = useApp()
  const [budget, setBudget] = useState(profile?.monthly_budget || '')
  const [selectedCurrency, setSelectedCurrency] = useState(profile?.currency || 'INR')
  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('expense_presets')
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS
  })
  const [showAddCat, setShowAddCat] = useState(false)
  const [showAddPreset, setShowAddPreset] = useState(false)
  const [editCat, setEditCat] = useState(null)
  const [newCat, setNewCat] = useState({ name: '', icon: '📦', color: '#7c3aed' })
  const [newPreset, setNewPreset] = useState({ label: '', amount: '', icon: '💰', categoryName: 'Food' })
  const [savingBudget, setSavingBudget] = useState(false)
  const [exportStart, setExportStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [exportEnd, setExportEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [deleteConfirmCat, setDeleteConfirmCat] = useState(null)

  useEffect(() => {
    if (profile) {
      setBudget(profile.monthly_budget || '')
      setSelectedCurrency(profile.currency || 'INR')
    }
  }, [profile])

  const saveBudget = async () => {
    setSavingBudget(true)
    const { error } = await supabase.from('profiles').update({
      monthly_budget: budget ? parseFloat(budget) : null,
      currency: selectedCurrency,
    }).eq('id', user.id)
    if (error) { toast.error('Failed to save'); setSavingBudget(false); return }
    await refreshProfile()
    toast.success('Settings saved!')
    setSavingBudget(false)
  }

  const updateProfile = async (updates) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) { toast.error('Failed to update'); return }
    await refreshProfile()
  }

  const addCategory = async () => {
    if (!newCat.name.trim()) { toast.error('Enter category name'); return }
    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      name: newCat.name,
      icon: newCat.icon,
      color: newCat.color,
      is_default: false,
    })
    if (error) { toast.error('Failed to add'); return }
    await refreshCategories()
    setNewCat({ name: '', icon: '📦', color: '#7c3aed' })
    setShowAddCat(false)
    toast.success('Category added!')
  }

  const updateCategory = async () => {
    if (!editCat?.name.trim()) return
    const { error } = await supabase.from('categories').update({
      name: editCat.name, icon: editCat.icon, color: editCat.color,
    }).eq('id', editCat.id)
    if (error) { toast.error('Failed to update'); return }
    await refreshCategories()
    setEditCat(null)
    toast.success('Category updated!')
  }

  const deleteCategory = async (cat) => {
    // Reassign expenses to "Others"
    const othersCat = categories.find(c => c.name === 'Others')
    if (othersCat) {
      await supabase.from('expenses').update({ category_id: othersCat.id }).eq('category_id', cat.id).eq('user_id', user.id)
    }
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) { toast.error('Failed to delete'); return }
    await refreshCategories()
    setDeleteConfirmCat(null)
    toast.success('Category deleted, expenses moved to Others')
  }

  const exportCSV = async () => {
    const { data } = await supabase.from('expenses').select('*')
      .eq('user_id', user.id).gte('date', exportStart).lte('date', exportEnd)
      .order('date', { ascending: false })

    if (!data || data.length === 0) { toast.error('No expenses in this range'); return }

    const headers = ['Date', 'Category', 'Amount', 'Note', 'Payment Method']
    const rows = data.map(e => [
      e.date,
      categories.find(c => c.id === e.category_id)?.name || 'Others',
      e.amount,
      e.note || '',
      e.payment_method || '',
    ])

    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${exportStart}_to_${exportEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded!')
  }

  const savePresets = (updated) => {
    setPresets(updated)
    localStorage.setItem('expense_presets', JSON.stringify(updated))
  }

  const addPreset = () => {
    if (!newPreset.label || !newPreset.amount) { toast.error('Fill all fields'); return }
    const updated = [...presets, { ...newPreset, amount: parseFloat(newPreset.amount) }]
    savePresets(updated)
    setNewPreset({ label: '', amount: '', icon: '💰', categoryName: 'Food' })
    setShowAddPreset(false)
    toast.success('Preset added!')
  }

  const removePreset = (i) => {
    const updated = presets.filter((_, idx) => idx !== i)
    savePresets(updated)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
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
        <h1 className="italic" style={{ fontSize: '28px', color: 'var(--text-primary)' }}>Settings</h1>
      </header>

      <div className="page-enter">
        {/* Profile Card */}
        <section style={{ 
          background: 'var(--bg-surface)', 
          padding: '24px', 
          borderRadius: '16px', 
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: 500, color: 'white',
            fontFamily: 'var(--font-display)'
          }}>
            {profile?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="italic" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{profile?.full_name || 'User'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>{user?.email}</p>
          </div>
        </section>

        {/* Settings List */}
        <section className="section-gap">
          <h3 className="label-caps" style={{ marginBottom: '12px' }}>Preferences</h3>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <label className="label-caps" style={{ display: 'block', marginBottom: '8px' }}>Monthly Budget</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="number"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="input-field"
                  style={{ flex: 1, border: 'none', background: 'var(--bg-base)', borderRadius: '8px' }}
                />
                <button onClick={saveBudget} className="btn-primary" style={{ height: '44px', padding: '0 16px', fontSize: '14px', background: 'var(--text-primary)' }}>
                  Update
                </button>
              </div>
            </div>

            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <label className="label-caps" style={{ display: 'block', marginBottom: '8px' }}>Currency</label>
              <select
                value={selectedCurrency}
                onChange={e => { setSelectedCurrency(e.target.value); saveBudget() }}
                style={{ width: '100%', background: 'var(--bg-base)', border: 'none', padding: '12px', borderRadius: '8px', fontFamily: 'var(--font-ui)', fontSize: '14px' }}
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="section-gap">
          <h3 className="label-caps" style={{ marginBottom: '12px' }}>Data & Export</h3>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div 
              onClick={exportCSV}
              style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Download size={18} color="var(--text-secondary)" />
                <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}>Export Expenses as CSV</span>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </div>
            
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="label-caps" style={{ fontSize: '10px' }}>From</label>
                <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} style={{ width: '100%', border: 'none', background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', fontSize: '12px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label-caps" style={{ fontSize: '10px' }}>To</label>
                <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} style={{ width: '100%', border: 'none', background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', fontSize: '12px' }} />
              </div>
            </div>
          </div>
        </section>

        {/* Preferences & Pace Alert */}
        <section className="section-gap">
          <h3 className="label-caps" style={{ marginBottom: '12px' }}>Preferences</h3>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: profile?.pace_alert_enabled ? '20px' : '0' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>Spending Pace Alerts</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Get notified if you're spending too fast</p>
              </div>
              <button 
                onClick={() => updateProfile({ pace_alert_enabled: !profile.pace_alert_enabled })}
                style={{ 
                  width: '44px', height: '24px', borderRadius: '12px',
                  background: profile?.pace_alert_enabled ? 'var(--accent-green)' : 'var(--bg-muted)',
                  border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.2s ease'
                }}
              >
                <div style={{ 
                  width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '3px', left: profile?.pace_alert_enabled ? '23px' : '3px',
                  transition: 'all 0.2s ease'
                }} />
              </button>
            </div>

            {profile?.pace_alert_enabled && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500 }}>Alert Threshold</label>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-orange)' }}>{profile?.pace_alert_threshold || 80}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" max="100" step="5"
                  value={profile?.pace_alert_threshold || 80}
                  onChange={(e) => updateProfile({ pace_alert_threshold: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-orange)' }}
                />
              </div>
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section className="section-gap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="label-caps">Categories</h3>
            <button 
              onClick={() => setShowAddCat(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
            >
              + Add New
            </button>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            {categories.map((cat, i) => (
              <div key={cat.id} style={{ 
                padding: '16px 20px', 
                borderBottom: i === categories.length - 1 ? 'none' : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{cat.name}</span>
                {!cat.is_default && (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setEditCat(cat)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>
                      Edit
                    </button>
                    <button onClick={() => setDeleteConfirmCat(cat)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        {/* Quick Add Presets */}
        <section className="section-gap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="label-caps">Quick Presets</h3>
            <button 
              onClick={() => setShowAddPreset(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
            >
              + Add Preset
            </button>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            {presets.length === 0 ? (
              <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No presets added yet</p>
            ) : (
              presets.map((p, i) => (
                <div key={i} style={{ 
                  padding: '16px 20px', 
                  borderBottom: i === presets.length - 1 ? 'none' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '18px' }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>{p.label}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.categoryName}</p>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-orange)' }}>₹{p.amount}</span>
                  <button onClick={() => removePreset(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Sign Out */}
        <div style={{ marginTop: '48px', marginBottom: '40px' }}>
          <button onClick={handleSignOut} style={{
            width: '100%', 
            padding: '16px', 
            borderRadius: '12px', 
            border: 'none',
            background: 'var(--accent-orange)', 
            color: 'white', 
            fontWeight: 600, 
            fontSize: '16px',
            fontFamily: 'var(--font-display)',
            cursor: 'pointer', 
            boxShadow: '0 4px 12px rgba(200,96,42,0.2)'
          }}>
            Sign Out
          </button>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', marginTop: '16px', fontFamily: 'var(--font-ui)', letterSpacing: '0.05em' }}>
            VERSION 2.1.0 • MADE WITH CARE
          </p>
        </div>
        </div>

        {/* Modals */}
        {showAddCat && (
          <div className="modal-overlay center" onClick={() => setShowAddCat(false)}>
            <div className="modal-content center-modal" style={{ maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Add Category</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} placeholder="Category name" className="input-field" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" value={newCat.icon} onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))} placeholder="Icon (emoji)" className="input-field" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={newCat.color} onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))} style={{ width: '48px', height: '44px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'none' }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Color</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowAddCat(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={addCategory} className="btn-primary" style={{ flex: 1 }}>Add</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editCat && (
          <div className="modal-overlay center" onClick={() => setEditCat(null)}>
            <div className="modal-content center-modal" style={{ maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Edit Category</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" value={editCat.name} onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))} className="input-field" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" value={editCat.icon} onChange={e => setEditCat(p => ({ ...p, icon: e.target.value }))} placeholder="Icon" className="input-field" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={editCat.color} onChange={e => setEditCat(p => ({ ...p, color: e.target.value }))} style={{ width: '48px', height: '44px', borderRadius: '8px', border: 'none', cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Color</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setEditCat(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={updateCategory} className="btn-primary" style={{ flex: 1 }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddPreset && (
          <div className="modal-overlay center" onClick={() => setShowAddPreset(false)}>
            <div className="modal-content center-modal" style={{ maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Add Quick Preset</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" value={newPreset.label} onChange={e => setNewPreset(p => ({ ...p, label: e.target.value }))} placeholder="Label (e.g. Lunch)" className="input-field" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" value={newPreset.icon} onChange={e => setNewPreset(p => ({ ...p, icon: e.target.value }))} placeholder="Icon" className="input-field" />
                  <input type="number" value={newPreset.amount} onChange={e => setNewPreset(p => ({ ...p, amount: e.target.value }))} placeholder="Amount" className="input-field" />
                </div>
                <select value={newPreset.categoryName} onChange={e => setNewPreset(p => ({ ...p, categoryName: e.target.value }))} className="input-field" style={{ colorScheme: 'dark' }}>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowAddPreset(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={addPreset} className="btn-primary" style={{ flex: 1 }}>Add</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteConfirmCat && (
          <div className="modal-overlay center" onClick={() => setDeleteConfirmCat(null)}>
            <div className="modal-content center-modal" style={{ maxWidth: '320px' }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ fontWeight: 700, marginBottom: '6px' }}>Delete "{deleteConfirmCat.name}"?</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem' }}>All expenses will be moved to "Others"</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setDeleteConfirmCat(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={() => deleteCategory(deleteConfirmCat)} style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)', color: 'white', fontWeight: 600, cursor: 'pointer',
                }}>Delete</button>
              </div>
            </div>
          </div>
        )}
    </motion.div>
  )
}
