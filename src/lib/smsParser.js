/**
 * Advanced UPI SMS Parser for Indian Banks & Services
 */

const merchantCategories = {
  swiggy: 'Food', zomato: 'Food', 'mcd': 'Food', dominos: 'Food',
  uber: 'Transport', ola: 'Transport', rapido: 'Transport', namma: 'Transport',
  netflix: 'Entertainment', spotify: 'Entertainment', hotstar: 'Entertainment',
  amazon: 'Shopping', flipkart: 'Shopping', myntra: 'Shopping', meesho: 'Shopping',
  apollo: 'Health', medplus: 'Health', 'practo': 'Health',
  bigbasket: 'Groceries', blinkit: 'Groceries', zepto: 'Groceries', dmart: 'Groceries',
  'electricity': 'Bills', 'airtel': 'Bills', 'jio': 'Bills', 'bsnl': 'Bills',
  'fasTag': 'Transport', 'irctc': 'Transport', 'makemytrip': 'Travel',
}

const patterns = [
  // UPI credit/debit (GPay, PhonePe, Paytm, BHIM)
  /Rs\.?\s*(\d+(?:\.\d{1,2})?)\s+(?:debited|paid|sent)\s+(?:to|via)?\s*([A-Za-z0-9\s@]+?)(?:\s+on|\s+Ref|\.)/i,
  // Bank debit alerts (SBI, HDFC, ICICI, Axis, Kotak)
  /(?:debited|deducted|spent)\s+(?:INR|Rs\.?|₹)\s*(\d+(?:\.\d{1,2})?)\s+(?:at|for|to)\s+([A-Za-z0-9\s]+?)(?:\s+on|\.|Avl)/i,
  // Order confirmations
  /(?:order|payment)\s+of\s+(?:Rs\.?|INR|₹)\s*(\d+(?:\.\d{1,2})?)\s+(?:placed|confirmed|received)/i,
  // Fastag
  /FASTag.*?(?:Rs\.?|INR)\s*(\d+(?:\.\d{1,2})?)/i
]

export const parseSMS = (text) => {
  if (!text) return null

  // Refund/Credit detection
  if (text.toLowerCase().includes('credited')) {
    return { isRefund: true }
  }

  // Skip international amounts
  if (text.includes('$') || text.includes('USD') || text.includes('EUR')) {
    return null
  }

  let amount = null
  let merchant = null

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      amount = parseFloat(match[1].replace(/,/g, ''))
      merchant = match[2]?.trim() || 'Unknown Merchant'
      break
    }
  }

  if (!amount) return null

  // Clean merchant name
  merchant = merchant.split('@')[0].trim() // Remove UPI IDs
  merchant = merchant.replace(/\s+/g, ' ') // Clean whitespace

  // Detect category
  let category = 'Others'
  const merchantLower = merchant.toLowerCase()
  for (const [key, cat] of Object.entries(merchantCategories)) {
    if (merchantLower.includes(key)) {
      category = cat
      break
    }
  }

  // Detect payment method
  let paymentMethod = 'UPI'
  const textLower = text.toLowerCase()
  if (textLower.includes('fastag')) paymentMethod = 'FASTag'
  else if (textLower.includes('card')) paymentMethod = 'Debit Card'
  else if (textLower.includes('net banking')) paymentMethod = 'Net Banking'

  return {
    amount,
    merchant,
    category,
    paymentMethod,
    isParsed: true
  }
}

export const trustedSenders = [
  'SBIINB','HDFCBK','ICICIB','AXISBK','KOTAKB','PNBSMS','BOIIND',
  'PAYTMB','GPAY','PHONEPE','BHIMUPI','AMAZON','FLIPKRT',
  'SWIGGY','ZOMATO','TATANEU','JUSPAY'
]
