'use client'

import { useState } from 'react'
import { Search, Crosshair, Globe, BarChart3, Megaphone, FileSearch, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'

const quickAnalyses = [
  { label: 'Social Media Audit', icon: Megaphone, prompt: 'Perform a comprehensive social media audit of this competitor. Analyze their posting frequency, engagement rates, content themes, follower growth trends, and platform presence. Identify their strongest and weakest social channels.' },
  { label: 'SEO Analysis', icon: BarChart3, prompt: 'Conduct an SEO analysis of this competitor. Evaluate their likely keyword strategy, on-page SEO practices, content quality, backlink profile estimation, domain authority, and technical SEO. Identify opportunities where we can outrank them.' },
  { label: 'Ad Strategy', icon: Crosshair, prompt: 'Analyze the advertising strategy of this competitor. Look at their likely ad platforms, messaging angles, offers, landing page strategies, and estimated ad spend. Identify gaps in their ad strategy we can exploit.' },
  { label: 'Content Review', icon: FileSearch, prompt: 'Review the content strategy of this competitor. Analyze their blog topics, content formats, publishing frequency, content quality, lead magnets, and email marketing approach. Identify content gaps and opportunities.' },
]

export default function CompetitorPage() {
  useAuth()
  const supabase = createClient()

  const [competitorInput, setCompetitorInput] = useState('')
  const [analysisResult, setAnalysisResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysisType, setAnalysisType] = useState('')

  const runAnalysis = async (prompt: string, label: string) => {
    if (!competitorInput.trim()) {
      toast.error('Please enter a competitor name or URL')
      return
    }
    setLoading(true)
    setAnalysisType(label)
    setAnalysisResult('')
    try {
      const res = await fetch('/api/trinity/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${prompt}\n\nCompetitor: ${competitorInput}\n\nProvide a detailed, structured analysis with actionable insights. Use headers, bullet points, and specific recommendations.`
        })
      })
      if (!res.ok) throw new Error('Analysis failed')
      const data = await res.json()
      setAnalysisResult(data.response || data.message || 'Analysis complete.')
      toast.success(`${label} complete!`)
    } catch {
      toast.error('Failed to analyze competitor')
    } finally {
      setLoading(false)
    }
  }

  const handleFullAnalysis = () => {
    runAnalysis(
      'Perform a comprehensive competitive analysis of this competitor. Cover their market positioning, strengths, weaknesses, online presence, marketing strategy, pricing model, customer base, and key differentiators. Include actionable recommendations for how to outperform them.',
      'Full Analysis'
    )
  }

  void supabase

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold">Competitor Spy Tool</h1>
          <p className="text-xs text-muted">AI-powered competitive intelligence and analysis</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="card">
        <label className="text-[10px] text-muted uppercase tracking-wider mb-2 block">Competitor URL or Name</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={competitorInput}
              onChange={e => setCompetitorInput(e.target.value)}
              placeholder="e.g. competitor.com or Competitor Agency Name"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50"
              onKeyDown={e => e.key === 'Enter' && handleFullAnalysis()}
            />
          </div>
          <button
            onClick={handleFullAnalysis}
            disabled={loading}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Analyze
          </button>
        </div>
      </div>

      {/* Quick Analysis Buttons */}
      <div>
        <h2 className="section-header">Quick Analysis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickAnalyses.map(qa => (
            <button
              key={qa.label}
              onClick={() => runAnalysis(qa.prompt, qa.label)}
              disabled={loading}
              className="card-hover text-left flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
                <qa.icon size={16} className="text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-semibold">{qa.label}</p>
                <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{qa.prompt.slice(0, 80)}...</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {(analysisResult || loading) && (
        <div>
          <h2 className="section-header">
            {analysisType} Results
            {loading && <Loader2 size={12} className="inline ml-2 animate-spin" />}
          </h2>
          <div className="card">
            {loading && !analysisResult ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 size={20} className="animate-spin text-purple-400" />
                <p className="text-xs text-muted">Analyzing {competitorInput}...</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-xs text-foreground leading-relaxed font-sans">{analysisResult}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analysisResult && !loading && (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <Crosshair size={32} className="text-muted mb-3" />
          <p className="text-xs text-muted">Enter a competitor name or URL above to get started</p>
          <p className="text-[10px] text-muted mt-1">Choose a quick analysis type or run a full comprehensive analysis</p>
        </div>
      )}
    </div>
  )
}
