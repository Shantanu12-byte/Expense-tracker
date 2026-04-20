import toast from 'react-hot-toast'
import { ExternalLink, Copy, Check, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

export default function SetupPage() {
  const [copied, setCopied] = useState(false)

  const copySQL = () => {
    const url = window.location.origin
    navigator.clipboard.writeText('VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=your_anon_key')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard!')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* BG orbs */}
      <div style={{ position: 'fixed', top: '-100px', left: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '440px', width: '100%', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '28px',
            boxShadow: '0 8px 25px rgba(124,58,237,0.4)',
          }}>💰</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
            <span className="gradient-text">SpendSmart</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Personal Expense Tracker</p>
        </div>

        {/* Warning */}
        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '20px',
          display: 'flex', gap: '12px', alignItems: 'flex-start',
        }}>
          <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontWeight: 600, color: '#fcd34d', marginBottom: '4px', fontSize: '0.9rem' }}>Supabase not configured</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Add your Supabase credentials to the <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>.env</code> file to get started.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Setup Instructions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              {
                step: '1',
                title: 'Create a Supabase project',
                desc: 'Go to supabase.com and create a free account + project',
                link: 'https://supabase.com',
                linkLabel: 'Open Supabase →',
              },
              {
                step: '2',
                title: 'Run the database schema',
                desc: 'Copy the supabase-schema.sql file and run it in Supabase SQL Editor',
                file: 'supabase-schema.sql',
              },
              {
                step: '3',
                title: 'Add credentials to .env',
                desc: 'Find your URL and anon key in Project Settings → API, then add to your .env file',
              },
              {
                step: '4',
                title: 'Restart the dev server',
                desc: 'Run npm run dev again and refresh this page',
              },
            ].map((item) => (
              <div key={item.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: 'white',
                }}>
                  {item.step}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '3px' }}>{item.title}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>{item.desc}</p>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      color: '#a855f7', fontSize: '0.8rem', fontWeight: 600, marginTop: '4px',
                      textDecoration: 'none',
                    }}>
                      {item.linkLabel} <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* .env template */}
        <div className="glass-card" style={{ padding: '16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontWeight: 600, fontSize: '0.88rem' }}>.env file template</p>
            <button onClick={copySQL} style={{
              background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(124,58,237,0.15)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(124,58,237,0.4)'}`,
              borderRadius: '8px', padding: '4px 10px', cursor: 'pointer',
              color: copied ? '#22c55e' : '#a855f7', fontSize: '0.78rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <pre style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px 14px',
            fontSize: '0.78rem', color: '#a855f7', lineHeight: 1.7,
            overflowX: 'auto', fontFamily: 'monospace',
          }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here`}
          </pre>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          After adding credentials, restart the dev server with <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>npm run dev</code>
        </p>
      </div>
    </div>
  )
}
