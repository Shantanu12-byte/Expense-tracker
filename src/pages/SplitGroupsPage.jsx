import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency } from '../lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Users, Receipt, CheckCircle2, ChevronRight, UserPlus, Trash2 } from 'lucide-react'
import { TagChip, TransactionRow } from '../components/SharedUI'

export default function SplitGroupsPage() {
  const navigate = useNavigate()
  const { user, currency } = useApp()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  
  // Group Detail State
  const [members, setMembers] = useState([])
  const [groupExpenses, setGroupExpenses] = useState([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [showAddSplit, setShowAddSplit] = useState(false)

  // Split Expense Form
  const [splitTitle, setSplitTitle] = useState('')
  const [splitAmount, setSplitAmount] = useState('')
  const [paidBy, setPaidBy] = useState('')

  useEffect(() => {
    if (user) loadGroups()
  }, [user])

  const loadGroups = async () => {
    setLoading(true)
    // Fetch groups where user is a member or creator
    const { data, error } = await supabase
      .from('split_groups')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) toast.error('Failed to load groups')
    else setGroups(data || [])
    setLoading(false)
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    try {
      const { data, error } = await supabase.from('split_groups').insert({
        name: groupName,
        created_by: user.id
      }).select().single()
      
      if (error) throw error
      
      // Auto-add creator as member
      await supabase.from('split_members').insert({
        group_id: data.id,
        user_id: user.id,
        display_name: 'You'
      })

      toast.success('Group created!')
      setGroupName('')
      setShowAddGroup(false)
      loadGroups()
    } catch (err) {
      toast.error('Failed to create group')
    }
  }

  const loadGroupDetails = async (group) => {
    setSelectedGroup(group)
    const [memRes, expRes] = await Promise.all([
      supabase.from('split_members').select('*').eq('group_id', group.id),
      supabase.from('split_expenses').select('*').eq('group_id', group.id).order('date', { ascending: false })
    ])
    setMembers(memRes.data || [])
    setGroupExpenses(expRes.data || [])
    if (memRes.data?.length > 0) setPaidBy(memRes.data[0].id)
  }

  const handleAddMember = async () => {
    if (!newMemberName) return
    try {
      const { error } = await supabase.from('split_members').insert({
        group_id: selectedGroup.id,
        display_name: newMemberName
      })
      if (error) throw error
      setNewMemberName('')
      setShowAddMember(false)
      loadGroupDetails(selectedGroup)
    } catch (err) {
      toast.error('Failed to add member')
    }
  }

  const handleAddSplitExpense = async (e) => {
    e.preventDefault()
    const amount = parseFloat(splitAmount)
    if (!splitTitle || !amount || !paidBy) return

    try {
      const { data: exp, error: expErr } = await supabase.from('split_expenses').insert({
        group_id: selectedGroup.id,
        paid_by: paidBy,
        title: splitTitle,
        total_amount: amount,
        split_type: 'equal'
      }).select().single()

      if (expErr) throw expErr

      // Equal split shares
      const shareAmount = amount / members.length
      const shares = members.map(m => ({
        split_expense_id: exp.id,
        member_id: m.id,
        amount: shareAmount
      }))

      await supabase.from('split_shares').insert(shares)
      
      toast.success('Expense added to group')
      setSplitTitle('')
      setSplitAmount('')
      setShowAddSplit(false)
      loadGroupDetails(selectedGroup)
    } catch (err) {
      toast.error('Failed to add expense')
    }
  }

  if (selectedGroup) {
    return (
      <div className="page-container" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <header style={{ padding: '24px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => setSelectedGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={24} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="italic" style={{ fontSize: '20px' }}>{selectedGroup.name}</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{members.length} members</p>
          </div>
          <button onClick={() => setShowAddMember(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-orange)' }}>
            <UserPlus size={20} />
          </button>
        </header>

        {/* Members Quick List */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '24px' }} className="no-scrollbar">
          {members.map(m => (
            <TagChip key={m.id}>
              {m.display_name}
            </TagChip>
          ))}
        </div>

        <section className="section-gap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="label-caps">Group Expenses</h3>
            <button onClick={() => setShowAddSplit(true)} style={{ background: 'var(--text-primary)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
              + Add Bill
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groupExpenses.map(exp => (
              <TransactionRow 
                key={exp.id}
                icon="🧾"
                title={exp.title}
                subtitle={`Paid by ${members.find(m => m.id === exp.paid_by)?.display_name} • ${format(new Date(exp.date), 'dd MMM')}`}
                amount={exp.total_amount}
                currency={currency}
                isNegative={true}
              />
            ))}
          </div>
        </section>

        {/* Modals for Group Detail */}
        {showAddMember && (
          <div className="modal-overlay center" onClick={() => setShowAddMember(false)}>
            <div className="modal-content" style={{ maxWidth: '320px' }} onClick={e => e.stopPropagation()}>
              <h3 className="italic" style={{ fontSize: '18px', marginBottom: '16px' }}>Add Member</h3>
              <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="Name" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', marginBottom: '16px' }} autoFocus />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowAddMember(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleAddMember} className="btn-primary" style={{ flex: 1, background: 'var(--accent-orange)' }}>Add</button>
              </div>
            </div>
          </div>
        )}

        {showAddSplit && (
          <div className="modal-overlay center" onClick={() => setShowAddSplit(false)}>
            <div className="modal-content" style={{ maxWidth: '400px', width: '90%' }} onClick={e => e.stopPropagation()}>
              <h3 className="italic" style={{ fontSize: '18px', marginBottom: '20px' }}>Split an Expense</h3>
              <form onSubmit={handleAddSplitExpense}>
                <div style={{ marginBottom: '16px' }}>
                  <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Description</label>
                  <input type="text" value={splitTitle} onChange={e => setSplitTitle(e.target.value)} placeholder="e.g. Dinner" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)' }} required />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Amount</label>
                  <input type="number" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)' }} required />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label className="label-caps" style={{ display: 'block', marginBottom: '6px' }}>Paid By</label>
                  <select value={paidBy} onChange={e => setPaidBy(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                    {members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowAddSplit(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ flex: 1, background: 'var(--text-primary)' }}>Split Bill</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-container" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <header style={{ padding: '24px 0 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="italic" style={{ fontSize: '24px' }}>Split Expenses</h1>
      </header>

      <section className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="label-caps">Your Groups</h3>
          <button onClick={() => setShowAddGroup(true)} style={{ background: 'var(--accent-orange)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '99px', fontSize: '12px', fontWeight: 600 }}>
            + Create Group
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', background: 'var(--bg-surface)', borderRadius: '20px', color: 'var(--text-muted)' }}>
              <Users size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p>Split bills with friends easily.</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.id} className="glass-card pressable" onClick={() => loadGroupDetails(group)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                    🏘️
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '15px' }}>{group.name}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{format(new Date(group.created_at), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <ChevronRight size={20} color="var(--text-muted)" />
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Group Modal */}
      {showAddGroup && (
        <div className="modal-overlay center" onClick={() => setShowAddGroup(false)}>
          <div className="modal-content" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <h3 className="italic" style={{ fontSize: '20px', marginBottom: '16px' }}>Create Group</h3>
            <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Goa Trip, Flatmates" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', marginBottom: '20px' }} autoFocus />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddGroup(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleCreateGroup} className="btn-primary" style={{ flex: 1, background: 'var(--accent-orange)' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
