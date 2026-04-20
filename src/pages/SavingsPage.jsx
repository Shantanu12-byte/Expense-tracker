import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { formatCurrency } from '../lib/utils'
import { format, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Target, TrendingUp, CheckCircle2, AlertCircle, Calendar, Smile } from 'lucide-react'
import confetti from 'canvas-confetti'

const GOAL_EMOJIS = ['✈️', '🏠', '📱', '💍', '🎓', '🏋️', '🚗', '💻', '🚲', '🏔️', '🎮', '⌚', '🎸', '📷', '🛋️', '🎨', '🎁', '🏖️', '🍵', '🍔']
const PRESET_COLORS = ['#C8602A', '#4A7C59', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444']

export default function SavingsPage() {
  const navigate = useNavigate()
  const { user, currency } = useApp()
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [contributeGoal, setContributeGoal] = useState(null)
  const [contribAmount, setContribAmount] = useState('')

  // New Goal State
  const [title, setTitle] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [color, setColor] = useState('#C8602A')
  const [initialSaved, setInitialSaved] = useState('')
  const [useInitial, setUseInitial] = useState(false)

  const loadGoals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('is_completed', { ascending: true })
      .order('deadline', { ascending: true })
    setGoals(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadGoals() }, [loadGoals])

  const handleAddGoal = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('savings_goals').insert({
        user_id: user.id,
        title,
        target_amount: parseFloat(targetAmount),
        saved_amount: useInitial ? parseFloat(initialSaved || 0) : 0,
        deadline: deadline || null,
        emoji,
        color
      })
      if (error) throw error
      toast.success('Goal created! Time to save. 🚀')
      setShowAdd(false)
      loadGoals()
      // Reset form
      setTitle(''); setTargetAmount(''); setDeadline(''); setEmoji('🎯'); setUseInitial(false); setInitialSaved('')
    } catch (err) {
      toast.error('Failed to create goal')
    }
  }

  const handleContribute = async () => {
    if (!contribAmount) return
    const amount = parseFloat(contribAmount)
    const newAmount = (contributeGoal.saved_amount || 0) + amount
    const isCompleted = newAmount >= contributeGoal.target_amount

    try {
      const { error } = await supabase.from('savings_goals')
        .update({ saved_amount: newAmount, is_completed: isCompleted })
        .eq('id', contributeGoal.id)
      
      if (error) throw error
      
      if (isCompleted && !contributeGoal.is_completed) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: [contributeGoal.color, '#ffffff']
        })
        toast.success(`Congratulations! You hit your goal: ${contributeGoal.title}! 🎊`, { duration: 5000 })
      } else {
        toast.success(`₹${amount} added to your goal!`)
      }
      
      setContributeGoal(null)
      setContribAmount('')
      loadGoals()
    } catch (err) {
      toast.error('Failed to update')
    }
  }

  const getDailyNeeded = (goal) => {
    if (!goal.deadline || goal.is_completed) return 0
    const daysLeft = differenceInDays(new Date(goal.deadline), new Date())
    const remaining = goal.target_amount - (goal.saved_amount || 0)
    if (daysLeft <= 0) return remaining > 0 ? remaining : 0
    return Math.ceil(remaining / daysLeft)
  }

  const isOnTrack = (goal) => {
    if (!goal.deadline || goal.is_completed) return true
    const totalDays = differenceInDays(new Date(goal.deadline), new Date(goal.created_at))
    const daysPassed = differenceInDays(new Date(), new Date(goal.created_at))
    const expectedProgress = (daysPassed / Math.max(1, totalDays)) * goal.target_amount
    return (goal.saved_amount || 0) >= expectedProgress * 0.9
  }

  const activeGoals = goals.filter(g => !g.is_completed)
  const completedGoals = goals.filter(g => g.is_completed)

  return (
    <div className="page-container" style={{ background: 'var(--bg-base)', minHeight: '100vh', paddingBottom: '120px' }}>
      <header style={{ padding: '24px 0 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="italic" style={{ fontSize: '24px' }}>Savings Goals</h1>
      </header>

      {goals.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏜️</div>
          <h2 className="italic" style={{ fontSize: '20px', marginBottom: '12px' }}>Set your first goal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' }}>A trip, a gadget, anything worth saving for.</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ padding: '16px 32px', borderRadius: '16px' }}>
            Create a goal
          </button>
        </div>
      ) : (
        <>
          <section className="section-gap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="label-caps">Active Goals</h3>
              <button onClick={() => setShowAdd(true)} style={{ background: 'var(--text-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '99px', fontSize: '12px', fontWeight: 600 }}>
                + New Goal
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {activeGoals.map(goal => {
                const pct = Math.min(100, Math.round(((goal.saved_amount || 0) / goal.target_amount) * 100))
                const daily = getDailyNeeded(goal)
                const onTrack = isOnTrack(goal)
                const isOverdue = goal.deadline && new Date(goal.deadline) < new Date()

                return (
                  <div key={goal.id} className="goal-card" style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '24px', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontSize: '32px' }}>{goal.emoji}</span>
                        <div>
                          <h4 style={{ fontSize: '18px', fontWeight: 700 }}>{goal.title}</h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Saved {formatCurrency(goal.saved_amount || 0, currency)} of {formatCurrency(goal.target_amount, currency)}
                          </p>
                        </div>
                      </div>
                      {goal.deadline && (
                        <div style={{
                          padding: '4px 10px', borderRadius: '6px', 
                          background: isOverdue ? 'rgba(239, 68, 68, 0.1)' : (onTrack ? 'rgba(74, 124, 89, 0.1)' : 'rgba(200, 96, 42, 0.1)'),
                          color: isOverdue ? '#EF4444' : (onTrack ? 'var(--accent-green)' : 'var(--accent-orange)'),
                          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase'
                        }}>
                          {isOverdue ? 'Overdue' : (onTrack ? 'On Track' : 'Needs catch up')}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ height: '10px', background: 'var(--bg-muted)', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: goal.color || 'var(--accent-orange)', borderRadius: '99px', transition: 'width 1s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: goal.color }}>{pct}%</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)', marginBottom: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                        {goal.deadline ? (
                          <>
                            <span>📅 {format(new Date(goal.deadline), 'dd MMM yyyy')}</span>
                            <span>⏳ {differenceInDays(new Date(goal.deadline), new Date())} days left</span>
                          </>
                        ) : (
                          <span>♾️ Open-ended</span>
                        )}
                      </div>
                      {goal.deadline && !isOverdue && (
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>
                          Need <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(daily, currency)}/day</span>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => setContributeGoal(goal)}
                      style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--bg-muted)', border: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                      + Add savings
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {completedGoals.length > 0 && (
            <section className="section-gap">
              <h3 className="label-caps" style={{ marginBottom: '16px', opacity: 0.6 }}>Completed</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {completedGoals.map(goal => (
                  <div key={goal.id} style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', opacity: 0.8 }}>
                    <span style={{ fontSize: '24px' }}>{goal.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '14px' }}>{goal.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target reached: {formatCurrency(goal.target_amount, currency)}</p>
                    </div>
                    <div style={{ color: 'var(--accent-green)' }}>
                      <CheckCircle2 size={24} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Add Goal Sheet */}
      {showAdd && (
        <div className="modal-overlay" style={{ alignItems: 'flex-end' }} onClick={() => setShowAdd(false)}>
          <div className="bottom-sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '32px', height: '4px', background: 'var(--bg-muted)', borderRadius: '99px', margin: '0 auto 24px' }} />
            <h3 className="italic" style={{ fontSize: '24px', marginBottom: '32px', textAlign: 'center' }}>What are you saving for?</h3>
            
            <form onSubmit={handleAddGoal}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  {GOAL_EMOJIS.map(e => (
                    <button 
                      key={e} type="button" 
                      onClick={() => setEmoji(e)}
                      style={{ fontSize: '24px', background: emoji === e ? 'var(--bg-muted)' : 'none', border: 'none', padding: '8px', borderRadius: '12px', cursor: 'pointer' }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" value={title} onChange={e => setTitle(e.target.value)} 
                  placeholder="Goal Title" 
                  style={{ width: '100%', border: 'none', borderBottom: '2px solid var(--border)', background: 'none', padding: '12px', fontSize: '20px', textAlign: 'center', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <label className="label-caps" style={{ display: 'block', marginBottom: '12px' }}>Target Amount</label>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px', color: 'var(--text-muted)' }}>{currency}</span>
                  <input 
                    type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} 
                    placeholder="0" 
                    style={{ border: 'none', background: 'none', fontSize: '48px', fontWeight: 700, width: '180px', textAlign: 'center', outline: 'none' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label className="label-caps" style={{ display: 'block', marginBottom: '12px' }}>Deadline</label>
                <input 
                  type="date" value={deadline} onChange={e => setDeadline(e.target.value)} 
                  style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-base)', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label className="label-caps" style={{ display: 'block', marginBottom: '12px' }}>Goal Color</label>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                  {PRESET_COLORS.map(c => (
                    <button 
                      key={c} type="button" 
                      onClick={() => setColor(c)}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text-primary)' : 'none', cursor: 'pointer' }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '32px', background: 'var(--bg-surface)', padding: '16px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Already saved some?</span>
                  <button 
                    type="button" onClick={() => setUseInitial(!useInitial)}
                    style={{ background: useInitial ? 'var(--accent-green)' : 'var(--bg-muted)', border: 'none', width: '40px', height: '22px', borderRadius: '11px', position: 'relative' }}
                  >
                    <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: useInitial ? '21px' : '3px', transition: '0.2s' }} />
                  </button>
                </div>
                {useInitial && (
                  <input 
                    type="number" value={initialSaved} onChange={e => setInitialSaved(e.target.value)} 
                    placeholder="Enter amount" 
                    style={{ width: '100%', marginTop: '12px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                  />
                )}
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '18px', borderRadius: '16px', fontSize: '16px', fontWeight: 700 }}>
                Set Savings Goal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Sheet */}
      {contributeGoal && (
        <div className="modal-overlay" style={{ alignItems: 'flex-end' }} onClick={() => setContributeGoal(null)}>
          <div className="bottom-sheet" style={{ padding: '24px 20px 40px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '32px', height: '4px', background: 'var(--bg-muted)', borderRadius: '99px', margin: '0 auto 24px' }} />
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <span style={{ fontSize: '48px' }}>{contributeGoal.emoji}</span>
              <h3 className="italic" style={{ fontSize: '20px', marginTop: '12px' }}>Saving for {contributeGoal.title}</h3>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label className="label-caps" style={{ display: 'block', textAlign: 'center', marginBottom: '12px' }}>Add to savings</label>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px', color: 'var(--text-muted)' }}>{currency}</span>
                <input 
                  type="number" value={contribAmount} onChange={e => setContribAmount(e.target.value)} 
                  placeholder="0" 
                  style={{ border: 'none', background: 'none', fontSize: '48px', fontWeight: 700, width: '180px', textAlign: 'center', outline: 'none' }}
                  autoFocus
                />
              </div>
            </div>

            <button onClick={handleContribute} className="btn-primary" style={{ width: '100%', padding: '18px', borderRadius: '16px', background: contributeGoal.color }}>
              Add to Goal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
