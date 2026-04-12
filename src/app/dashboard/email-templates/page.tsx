'use client'

import { useState } from 'react'
import { Mail, Copy, Send, X, FileText, Tag, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'

type Template = {
  id: number
  name: string
  subject: string
  category: 'Onboarding' | 'Follow-up' | 'Invoice' | 'Report' | 'Promotion'
  body: string
}

const templates: Template[] = [
  {
    id: 1,
    name: 'Welcome Email',
    subject: 'Welcome to {{company}} - Let\'s Get Started!',
    category: 'Onboarding',
    body: `Hi {{client_name}},\n\nWelcome aboard! We're thrilled to have you as a new client at {{company}}.\n\nHere's what happens next:\n1. Your dedicated account manager will reach out within 24 hours\n2. We'll schedule a kickoff call to align on goals\n3. You'll receive access to your client portal\n\nIf you have any questions in the meantime, don't hesitate to reach out.\n\nBest regards,\n{{sender_name}}`
  },
  {
    id: 2,
    name: 'Invoice Reminder',
    subject: 'Friendly Reminder: Invoice #{{invoice_number}} Due Soon',
    category: 'Invoice',
    body: `Hi {{client_name}},\n\nThis is a friendly reminder that Invoice #{{invoice_number}} for {{amount_usd}} is due on {{due_date}}.\n\nYou can view and pay your invoice here: {{invoice_link}}\n\nIf you've already sent payment, please disregard this message. If you have any questions about the invoice, feel free to reach out.\n\nThank you,\n{{sender_name}}`
  },
  {
    id: 3,
    name: 'Content Approval Request',
    subject: 'Content Ready for Your Review - {{project_name}}',
    category: 'Follow-up',
    body: `Hi {{client_name}},\n\nGreat news! The content for {{project_name}} is ready for your review.\n\nPlease take a look at the attached materials and let us know:\n- Any changes or revisions needed\n- Approval to publish/proceed\n\nWe'd appreciate your feedback by {{deadline}} so we can stay on schedule.\n\nBest,\n{{sender_name}}`
  },
  {
    id: 4,
    name: 'Weekly Performance Report',
    subject: 'Your Weekly Performance Report - {{date_range}}',
    category: 'Report',
    body: `Hi {{client_name}},\n\nHere's your weekly performance summary for {{date_range}}:\n\n📊 Key Metrics:\n- Website Traffic: {{traffic}} ({{traffic_change}})\n- Leads Generated: {{leads}} ({{leads_change}})\n- Conversion Rate: {{conversion_rate}}\n- Ad Spend: {{ad_spend_usd}}\n- ROAS: {{roas}}\n\n🎯 Highlights:\n{{highlights}}\n\n📋 Next Week's Plan:\n{{next_steps}}\n\nLet me know if you'd like to discuss any of these results.\n\nBest,\n{{sender_name}}`
  },
  {
    id: 5,
    name: 'Promotional Offer',
    subject: 'Exclusive Offer: {{offer_title}} - Limited Time!',
    category: 'Promotion',
    body: `Hi {{client_name}},\n\nAs a valued client, we wanted to give you first access to our latest offer:\n\n🎉 {{offer_title}}\n{{offer_description}}\n\n✅ What's included:\n{{offer_details}}\n\n💰 Special pricing: {{offer_price}} (Regular: {{regular_price}})\n⏰ Offer expires: {{expiry_date}}\n\nReady to take advantage? Reply to this email or book a call: {{booking_link}}\n\nBest,\n{{sender_name}}`
  },
  {
    id: 6,
    name: 'Follow-up After Call',
    subject: 'Great Talking Today - Next Steps',
    category: 'Follow-up',
    body: `Hi {{client_name}},\n\nThank you for taking the time to chat today! Here's a quick recap of what we discussed:\n\n📝 Key Takeaways:\n{{takeaways}}\n\n✅ Action Items:\n{{action_items}}\n\n📅 Next Meeting: {{next_meeting}}\n\nIf I missed anything or you have additional thoughts, don't hesitate to reach out.\n\nLooking forward to making great things happen!\n\nBest,\n{{sender_name}}`
  },
  {
    id: 7,
    name: 'Review Request',
    subject: 'We\'d Love Your Feedback, {{client_name}}!',
    category: 'Follow-up',
    body: `Hi {{client_name}},\n\nWe hope you're enjoying the results from our work together! Your opinion means the world to us.\n\nWould you mind taking 2 minutes to leave us a review? It helps other businesses find us and lets our team know we're on the right track.\n\n⭐ Leave a review here: {{review_link}}\n\nAs a thank you, we'll {{incentive}}.\n\nThank you for being an amazing client!\n\nBest,\n{{sender_name}}`
  },
  {
    id: 8,
    name: 'Contract Renewal',
    subject: 'Your Contract Renewal - {{company}} Partnership',
    category: 'Invoice',
    body: `Hi {{client_name}},\n\nYour current contract with {{company}} is set to expire on {{expiry_date}}.\n\n📈 Over the past {{contract_period}}, here's what we've achieved together:\n{{achievements}}\n\n🔄 Renewal Options:\n{{renewal_options}}\n\nWe'd love to continue this partnership and have some exciting ideas for the next phase. Can we schedule a quick call to discuss?\n\n📅 Book a time: {{booking_link}}\n\nBest regards,\n{{sender_name}}`
  },
]

const categoryColors: Record<string, string> = {
  Onboarding: 'bg-green-500/10 text-green-400',
  'Follow-up': 'bg-blue-500/10 text-blue-400',
  Invoice: 'bg-yellow-500/10 text-yellow-400',
  Report: 'bg-purple-500/10 text-purple-400',
  Promotion: 'bg-pink-500/10 text-pink-400',
}

export default function EmailTemplatesPage() {
  useAuth()
  const supabase = createClient()

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [editedBody, setEditedBody] = useState('')
  const [editedSubject, setEditedSubject] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('All')
  const [sendingAI, setSendingAI] = useState(false)

  const categories = ['All', 'Onboarding', 'Follow-up', 'Invoice', 'Report', 'Promotion']
  const filtered = filterCategory === 'All' ? templates : templates.filter(t => t.category === filterCategory)

  const openTemplate = (t: Template) => {
    setSelectedTemplate(t)
    setEditedBody(t.body)
    setEditedSubject(t.subject)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${editedSubject}\n\n${editedBody}`)
    toast.success('Template copied to clipboard!')
  }

  const handleSendViaAI = async () => {
    if (!selectedTemplate) return
    setSendingAI(true)
    try {
      const res = await fetch('/api/trinity/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Polish and personalize this email template. Fill in any placeholder variables with realistic examples. Keep the same tone and structure:\n\nSubject: ${editedSubject}\n\n${editedBody}`
        })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setEditedBody(data.response || data.message || editedBody)
      toast.success('AI has polished your email!')
    } catch {
      toast.error('Failed to process with AI')
    } finally {
      setSendingAI(false)
    }
  }

  void supabase

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold">Email Templates</h1>
          <p className="text-xs text-muted">Pre-built templates for client communication</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              filterCategory === cat ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-muted border border-white/10 hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map(template => (
          <button
            key={template.id}
            onClick={() => openTemplate(template)}
            className="card-hover text-left"
          >
            <div className="flex items-start gap-2 mb-2">
              <Mail size={14} className="text-purple-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{template.name}</p>
                <p className="text-[10px] text-muted truncate mt-0.5">{template.subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryColors[template.category]}`}>
                {template.category}
              </span>
              <span className="text-[10px] text-muted flex items-center gap-1">
                <FileText size={10} />
                {template.body.split('\n').length} lines
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-purple-400" />
                <h3 className="text-sm font-bold">{selectedTemplate.name}</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryColors[selectedTemplate.category]}`}>
                  {selectedTemplate.category}
                </span>
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Subject Line</label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={e => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Email Body</label>
                <textarea
                  value={editedBody}
                  onChange={e => setEditedBody(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-purple-500/50 resize-none font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-4 border-t border-white/10">
              <button onClick={handleCopy} className="btn-primary flex items-center gap-1.5 text-[10px]">
                <Copy size={12} />
                Copy to Clipboard
              </button>
              <button
                onClick={handleSendViaAI}
                disabled={sendingAI}
                className="btn-primary flex items-center gap-1.5 text-[10px]"
              >
                <Sparkles size={12} />
                {sendingAI ? 'Processing...' : 'Polish with AI'}
              </button>
              <button
                onClick={() => { toast.success('Email ready to send!'); setSelectedTemplate(null) }}
                className="btn-primary flex items-center gap-1.5 text-[10px] ml-auto"
              >
                <Send size={12} />
                Send via AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
