// Format currency in Indian number system
export const formatCurrency = (amount, currency = 'INR') => {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  }
  const symbol = symbols[currency] || '₹'

  if (currency === 'INR') {
    // Indian number system formatting
    const num = parseFloat(amount || 0)
    if (isNaN(num)) return `${symbol}0`
    
    const parts = num.toFixed(2).split('.')
    const intPart = parts[0]
    const decPart = parts[1]
    
    let result = ''
    const len = intPart.length
    
    if (len <= 3) {
      result = intPart
    } else {
      result = intPart.slice(-3)
      let remaining = intPart.slice(0, -3)
      while (remaining.length > 0) {
        result = remaining.slice(-2) + ',' + result
        remaining = remaining.slice(0, -2)
      }
      if (result.startsWith(',')) result = result.slice(1)
    }
    
    // Only show decimals if non-zero
    if (parseInt(decPart) === 0) {
      return `${symbol}${result}`
    }
    return `${symbol}${result}.${decPart}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍔', color: '#f59e0b', is_default: true },
  { name: 'Transport', icon: '🚗', color: '#06b6d4', is_default: true },
  { name: 'Shopping', icon: '🛍️', color: '#ec4899', is_default: true },
  { name: 'Bills', icon: '💡', color: '#8b5cf6', is_default: true },
  { name: 'Health', icon: '❤️', color: '#ef4444', is_default: true },
  { name: 'Entertainment', icon: '🎮', color: '#10b981', is_default: true },
  { name: 'Others', icon: '📦', color: '#94a3b8', is_default: true },
]

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Net Banking']

export const FREQUENCIES = ['daily', 'weekly', 'monthly']

export const getCategoryColor = (categories, categoryId) => {
  const cat = categories?.find(c => c.id === categoryId)
  return cat?.color || '#94a3b8'
}

export const getCategoryIcon = (categories, categoryId) => {
  const cat = categories?.find(c => c.id === categoryId)
  return cat?.icon || '📦'
}

export const getCategoryName = (categories, categoryId) => {
  const cat = categories?.find(c => c.id === categoryId)
  return cat?.name || 'Others'
}

export const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export const endOfDay = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export const getWeekRange = () => {
  const now = new Date()
  const day = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export const getMonthRange = (offset = 0) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + offset
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}
