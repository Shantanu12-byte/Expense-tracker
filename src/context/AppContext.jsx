import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { DEFAULT_CATEGORIES } from '../lib/utils'

const AppContext = createContext(null)

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)

  // Auth listener
  useEffect(() => {
    if (!isConfigured || !supabase) { setAuthLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load profile + categories when user changes
  useEffect(() => {
    if (user) {
      loadProfile()
      loadCategories()
    } else {
      setProfile(null)
      setCategories([])
      setExpenses([])
      setLoading(false)
    }
  }, [user])

  const loadProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist - create it
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ id: user.id, full_name: user.email?.split('@')[0], currency: 'INR' })
        .select()
        .single()
      setProfile(newProfile)
    } else {
      setProfile(data)
    }
  }

  const loadCategories = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (error) {
      console.error('Error loading categories:', error)
      setLoading(false)
      return
    }

    if (!data || data.length === 0) {
      // Seed default categories
      await seedDefaultCategories()
    } else {
      setCategories(data)
    }
    setLoading(false)
  }

  const seedDefaultCategories = async () => {
    const toInsert = DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      user_id: user.id,
    }))
    const { data } = await supabase
      .from('categories')
      .insert(toInsert)
      .select()
    setCategories(data || [])
  }

  const refreshCategories = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    setCategories(data || [])
  }, [user])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(data)
  }, [user])

  const value = {
    user,
    profile,
    categories,
    expenses,
    loading,
    authLoading,
    setExpenses,
    refreshCategories,
    refreshProfile,
    currency: profile?.currency || 'INR',
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
