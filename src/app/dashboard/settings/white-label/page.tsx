'use client'

import { useState, useEffect } from 'react'
import { Paintbrush, Save, Eye, ToggleLeft, ToggleRight, Plus, Trash2, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'

type ClientOverride = {
  id: string
  clientName: string
  brandName: string
  logoUrl: string
  primaryColor: string
  accentColor: string
}

type WhiteLabelSettings = {
  brandName: string
  logoUrl: string
  primaryColor: string
  accentColor: string
  enabled: boolean
  clientOverrides: ClientOverride[]
}

const defaultSettings: WhiteLabelSettings = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#8b5cf6',
  accentColor: '#06b6d4',
  enabled: false,
  clientOverrides: [],
}

export default function WhiteLabelPage() {
  useAuth()
  const supabase = createClient()

  const [settings, setSettings] = useState<WhiteLabelSettings>(defaultSettings)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('shortstack-white-label')
    if (saved) {
      try {
        setSettings(JSON.parse(saved))
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('shortstack-white-label', JSON.stringify(settings))
    toast.success('White-label settings saved!')
  }

  const addOverride = () => {
    setSettings(prev => ({
      ...prev,
      clientOverrides: [
        ...prev.clientOverrides,
        { id: crypto.randomUUID(), clientName: '', brandName: '', logoUrl: '', primaryColor: prev.primaryColor, accentColor: prev.accentColor }
      ]
    }))
  }

  const removeOverride = (id: string) => {
    setSettings(prev => ({
      ...prev,
      clientOverrides: prev.clientOverrides.filter(o => o.id !== id)
    }))
    toast.success('Client override removed')
  }

  const updateOverride = (id: string, field: keyof ClientOverride, value: string) => {
    setSettings(prev => ({
      ...prev,
      clientOverrides: prev.clientOverrides.map(o => o.id === id ? { ...o, [field]: value } : o)
    }))
  }

  void supabase

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold">White Label Settings</h1>
          <p className="text-xs text-muted">Customize branding for your agency and clients</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)} className="btn-primary flex items-center gap-1.5 text-[10px]">
            <Eye size={12} />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-1.5 text-[10px]">
            <Save size={12} />
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Settings */}
        <div className="space-y-4">
          <div>
            <h2 className="section-header">Brand Settings</h2>
            <div className="card space-y-4">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Custom Brand Name</label>
                <input
                  type="text"
                  value={settings.brandName}
                  onChange={e => setSettings(prev => ({ ...prev, brandName: e.target.value }))}
                  placeholder="Your Agency Name"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Custom Logo URL</label>
                <input
                  type="text"
                  value={settings.logoUrl}
                  onChange={e => setSettings(prev => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="https://yourdomain.com/logo.png"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Primary Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={e => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor}
                      onChange={e => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={e => setSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={settings.accentColor}
                      onChange={e => setSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <p className="text-xs font-medium">Enable White-Label for Clients</p>
                  <p className="text-[10px] text-muted mt-0.5">Clients will see your custom branding instead of ShortStack</p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {settings.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-muted" />}
                </button>
              </div>
            </div>
          </div>

          {/* Client Overrides */}
          <div>
            <h2 className="section-header">Per-Client Overrides</h2>
            <div className="space-y-3">
              {settings.clientOverrides.map(override => (
                <div key={override.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 size={12} className="text-purple-400" />
                      <span className="text-xs font-medium">{override.clientName || 'New Client'}</span>
                    </div>
                    <button onClick={() => removeOverride(override.id)} className="text-red-400/60 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted mb-0.5 block">Client Name</label>
                      <input
                        type="text"
                        value={override.clientName}
                        onChange={e => updateOverride(override.id, 'clientName', e.target.value)}
                        placeholder="Client name"
                        className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted mb-0.5 block">Brand Name</label>
                      <input
                        type="text"
                        value={override.brandName}
                        onChange={e => updateOverride(override.id, 'brandName', e.target.value)}
                        placeholder="Display name"
                        className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted mb-0.5 block">Primary Color</label>
                      <div className="flex gap-1 items-center">
                        <input
                          type="color"
                          value={override.primaryColor}
                          onChange={e => updateOverride(override.id, 'primaryColor', e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={override.primaryColor}
                          onChange={e => updateOverride(override.id, 'primaryColor', e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] focus:outline-none focus:border-purple-500/50 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted mb-0.5 block">Accent Color</label>
                      <div className="flex gap-1 items-center">
                        <input
                          type="color"
                          value={override.accentColor}
                          onChange={e => updateOverride(override.id, 'accentColor', e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={override.accentColor}
                          onChange={e => updateOverride(override.id, 'accentColor', e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[10px] focus:outline-none focus:border-purple-500/50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addOverride} className="card-hover w-full flex items-center justify-center gap-2 py-3">
                <Plus size={14} className="text-purple-400" />
                <span className="text-xs text-muted">Add Client Override</span>
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div>
            <h2 className="section-header">Preview</h2>
            <div className="card overflow-hidden">
              <div
                className="rounded-lg border border-white/10 overflow-hidden"
                style={{ background: '#0f0f1a' }}
              >
                {/* Preview Header */}
                <div
                  className="px-4 py-3 flex items-center gap-3 border-b border-white/10"
                  style={{ background: `${settings.primaryColor}15` }}
                >
                  {settings.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={settings.logoUrl} alt="Logo" className="w-6 h-6 rounded object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: settings.primaryColor }}>
                      <Paintbrush size={12} className="text-white" />
                    </div>
                  )}
                  <span className="text-xs font-bold" style={{ color: settings.primaryColor }}>
                    {settings.brandName || 'Your Brand'}
                  </span>
                </div>
                {/* Preview Body */}
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: settings.primaryColor }} />
                    <div className="w-2 h-2 rounded-full" style={{ background: settings.accentColor }} />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                  <div className="h-3 rounded bg-white/10 w-3/4" />
                  <div className="h-3 rounded bg-white/5 w-1/2" />
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="h-16 rounded-lg border border-white/10" style={{ background: `${settings.primaryColor}10` }} />
                    <div className="h-16 rounded-lg border border-white/10" style={{ background: `${settings.accentColor}10` }} />
                    <div className="h-16 rounded-lg border border-white/10 bg-white/5" />
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-white"
                    style={{ background: settings.primaryColor }}
                  >
                    Sample Button
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-white ml-2"
                    style={{ background: settings.accentColor }}
                  >
                    Accent Button
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted mt-3 text-center">
                This is a preview of how your branding will appear to clients
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
