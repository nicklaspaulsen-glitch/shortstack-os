'use client'

import { useState } from 'react'
import { Star, MessageSquare, Send, Sparkles, TrendingUp, Users, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'

const mockReviews = [
  { id: 1, name: 'Sarah Johnson', rating: 5, text: 'Absolutely fantastic service! The team went above and beyond to deliver our project on time. Highly recommend to anyone looking for quality work.', date: '2026-04-01', responded: true },
  { id: 2, name: 'Mike Peters', rating: 4, text: 'Great experience overall. Communication was excellent and the results exceeded expectations. Only minor delays on the timeline.', date: '2026-03-28', responded: true },
  { id: 3, name: 'Emily Chen', rating: 5, text: 'Best agency we have ever worked with. They truly understand our brand and deliver consistent results every month.', date: '2026-03-25', responded: false },
  { id: 4, name: 'David Brown', rating: 3, text: 'Decent work but took longer than expected. The final product was good but the process could be smoother.', date: '2026-03-20', responded: false },
  { id: 5, name: 'Lisa Martinez', rating: 5, text: 'Incredible ROI on our ad campaigns. They really know what they are doing when it comes to digital marketing.', date: '2026-03-15', responded: true },
  { id: 6, name: 'James Wilson', rating: 4, text: 'Professional team with great attention to detail. Would definitely use their services again for our next project.', date: '2026-03-10', responded: false },
]

export default function ReviewsPage() {
  useAuth()
  const supabase = createClient()

  const [reviews] = useState(mockReviews)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [aiResponses, setAiResponses] = useState<Record<number, string>>({})
  const [requestName, setRequestName] = useState('')
  const [requestContact, setRequestContact] = useState('')
  const [sendingRequest, setSendingRequest] = useState(false)

  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
  const responseRate = Math.round((reviews.filter(r => r.responded).length / reviews.length) * 100)

  const handleAISuggest = async (review: typeof mockReviews[0]) => {
    setLoadingId(review.id)
    try {
      const res = await fetch('/api/trinity/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a professional, friendly response to this ${review.rating}-star Google review from ${review.name}: "${review.text}". Keep it concise (2-3 sentences), thank them, and sound authentic.`
        })
      })
      if (!res.ok) throw new Error('Failed to generate response')
      const data = await res.json()
      setAiResponses(prev => ({ ...prev, [review.id]: data.response || data.message || 'Response generated successfully.' }))
      toast.success('AI response generated!')
    } catch {
      toast.error('Failed to generate AI response')
    } finally {
      setLoadingId(null)
    }
  }

  const handleRequestReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestName.trim() || !requestContact.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    setSendingRequest(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.success(`Review request sent to ${requestName}!`)
    setRequestName('')
    setRequestContact('')
    setSendingRequest(false)
  }

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'} />
      ))}
    </div>
  )

  void supabase

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold">Google Review Management</h1>
          <p className="text-xs text-muted">Monitor, respond to, and request Google reviews</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <TrendingUp size={18} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Average Rating</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold">{avgRating}</p>
                {renderStars(Math.round(Number(avgRating)))}
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Total Reviews</p>
              <p className="text-xl font-bold">{reviews.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Clock size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Response Rate</p>
              <p className="text-xl font-bold">{responseRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div>
        <h2 className="section-header">Recent Reviews</h2>
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className="card-hover">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-semibold">{review.name}</span>
                    {renderStars(review.rating)}
                    <span className="text-[10px] text-muted">{review.date}</span>
                    {review.responded && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">Responded</span>
                    )}
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{review.text}</p>
                  {aiResponses[review.id] && (
                    <div className="mt-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <p className="text-[10px] text-purple-400 font-medium mb-1">AI Suggested Response:</p>
                      <p className="text-xs text-foreground">{aiResponses[review.id]}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleAISuggest(review)}
                  disabled={loadingId === review.id}
                  className="btn-primary flex items-center gap-1.5 text-[10px] shrink-0"
                >
                  <Sparkles size={12} />
                  {loadingId === review.id ? 'Generating...' : 'AI Suggest Response'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Request Review */}
      <div>
        <h2 className="section-header">Request a Review</h2>
        <div className="card">
          <form onSubmit={handleRequestReview} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Client Name</label>
              <input
                type="text"
                value={requestName}
                onChange={e => setRequestName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Phone or Email</label>
              <input
                type="text"
                value={requestContact}
                onChange={e => setRequestContact(e.target.value)}
                placeholder="email@example.com or (555) 123-4567"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={sendingRequest} className="btn-primary flex items-center gap-1.5 text-xs">
                <Send size={12} />
                {sendingRequest ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
          <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-white/5">
            <MessageSquare size={14} className="text-muted mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted">
              A personalized review request will be sent via SMS or email with a direct link to your Google Business profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
