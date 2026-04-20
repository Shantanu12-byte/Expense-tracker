import { supabase } from './supabase'
import { format, addMonths, addYears, isBefore, isSameDay } from 'date-fns'

export const syncSubscriptions = async (user, categories, force = false) => {
  if (!user || !categories?.length) return

  // Performance Optimization: Only sync once every 5 minutes to reduce DB load
  const lastSync = sessionStorage.getItem(`last_sub_sync_${user.id}`)
  const nowTime = Date.now()
  if (!force && lastSync && nowTime - parseInt(lastSync) < 300000) { // 5 minutes
    return
  }
  sessionStorage.setItem(`last_sub_sync_${user.id}`, nowTime.toString())

  // 1. Fetch all active subscriptions that are due
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const { data: dueSubs, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .lte('next_renewal_date', todayStr)

  if (error || !dueSubs?.length) return

  for (const sub of dueSubs) {
    try {
      // 2. Check if already logged for this date to prevent duplicates
      const { data: existing } = await supabase
        .from('expenses')
        .select('id')
        .eq('user_id', user.id)
        .eq('note', `Subscription: ${sub.name}`)
        .eq('date', sub.next_renewal_date)
        .limit(1)

      if (existing?.length > 0) {
        // If already exists, just update the sub date to next cycle
        console.log('Subscription already logged for this date:', sub.name)
      } else {
        // Log as expense
        const { error: expErr } = await supabase.from('expenses').insert({
          user_id: user.id,
          amount: sub.amount,
          note: `Subscription: ${sub.name}`,
          category_id: categories.find(c => c.name === sub.category)?.id || categories[0].id,
          date: sub.next_renewal_date,
          payment_method: 'UPI' // Default
        })
        if (expErr) throw expErr
      }

      // 3. Calculate next renewal date
      let nextDate = new Date(sub.next_renewal_date)
      if (sub.billing_cycle === 'monthly') nextDate = addMonths(nextDate, 1)
      else if (sub.billing_cycle === 'quarterly') nextDate = addMonths(nextDate, 3)
      else if (sub.billing_cycle === 'half_yearly') nextDate = addMonths(nextDate, 6)
      else if (sub.billing_cycle === 'yearly') nextDate = addYears(nextDate, 1)

      // 4. Update subscription
      await supabase.from('subscriptions')
        .update({ next_renewal_date: format(nextDate, 'yyyy-MM-dd') })
        .eq('id', sub.id)
        
    } catch (err) {
      console.error('Failed to sync sub:', sub.name, err)
    }
  }
}
