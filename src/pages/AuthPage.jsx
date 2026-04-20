import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Download, Zap } from 'lucide-react'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    console.log('Install button clicked. deferredPrompt:', deferredPrompt);
    if (!deferredPrompt) {
      toast.error('Install prompt not ready yet. Please wait a moment.')
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('Install outcome:', outcome);
    if (outcome === 'accepted') {
      setShowInstall(false)
    }
    setDeferredPrompt(null)
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('Welcome back! 🎉')
      } else {
        if (!fullName.trim()) {
          toast.error('Please enter your full name')
          setLoading(false)
          return
        }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data?.user) {
          // Create profile with full name
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            currency: 'INR',
          })
          toast.success('Account created! Welcome 🎊')
        }
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  return (
    <div className="page-container" style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        {/* Logo & Intro */}
        <header style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: '20px', color: 'white',
            fontFamily: 'var(--font-display)'
          }}>
            S
          </div>
          <h1 className="italic" style={{ fontSize: '32px', color: 'var(--text-primary)', marginBottom: '8px' }}>
            {isLogin ? 'Welcome back' : 'Join SpendSmart'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
            {isLogin ? 'Your expense journal awaits.' : 'A human-centric approach to tracking your daily habits.'}
          </p>
        </header>

        {/* Card */}
        <div style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {!isLogin && (
              <div>
                <label className="label-caps" style={{ marginBottom: '8px', display: 'block' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="Rahul Sharma"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-base)', border: 'none', padding: '14px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: '14px' }}
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="label-caps" style={{ marginBottom: '8px', display: 'block' }}>Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-base)', border: 'none', padding: '14px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: '14px' }}
                required
              />
            </div>

            <div>
              <label className="label-caps" style={{ marginBottom: '8px', display: 'block' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-base)', border: 'none', padding: '14px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: '14px', paddingRight: '44px' }}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--text-primary)',
                color: 'white',
                fontWeight: 600,
                fontSize: '15px',
                fontFamily: 'var(--font-display)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Processing...' : isLogin ? 'Login to Journal' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button 
              onClick={() => setIsLogin(!isLogin)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
            </button>
          </div>
        </div>

        {/* Dedicated Install Section */}
        {(!window.matchMedia('(display-mode: standalone)').matches) && (
          <div style={{ marginTop: '32px', padding: '24px', background: 'var(--accent-orange-light)', borderRadius: '20px', border: '1px solid var(--accent-orange)', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Zap size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-orange)' }}>EXPENSE TRACKER APP</h4>
                <p style={{ fontSize: '11px', color: 'var(--accent-orange)', opacity: 0.8 }}>Install for offline access & faster tracking</p>
              </div>
            </div>
            
            {showInstall ? (
              <button 
                onClick={handleInstall}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--accent-orange)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(200, 96, 42, 0.2)'
                }}
              >
                <Download size={18} />
                Install Now
              </button>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--accent-orange)', fontWeight: 500, opacity: 0.9, lineHeight: 1.4 }}>
                {/iPhone|iPad|iPod/.test(navigator.userAgent) 
                  ? "Tap the 'Share' icon and then 'Add to Home Screen' to install. 📲" 
                  : "Ready to be installed! Look for the install icon in your address bar. ✨"}
              </p>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-ui)', letterSpacing: '0.05em' }}>
          Mindful tracking for a better financial life.
        </p>
      </div>
    </div>
  )
}
