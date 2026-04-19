"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";
import {
  Check, ArrowRight, MessageSquare, HelpCircle, X,
  Camera, Video, Globe, Briefcase, AtSign, Hash
} from "lucide-react";
import toast from "react-hot-toast";

const SOCIAL_PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: <Camera size={24} />, color: "text-pink-500" },
  { id: "facebook", name: "Facebook", icon: <Globe size={24} />, color: "text-blue-500" },
  { id: "tiktok", name: "TikTok", icon: <Hash size={24} />, color: "text-white" },
  { id: "youtube", name: "YouTube", icon: <Video size={24} />, color: "text-red-500" },
  { id: "linkedin", name: "LinkedIn", icon: <Briefcase size={24} />, color: "text-blue-400" },
  { id: "twitter", name: "X (Twitter)", icon: <AtSign size={24} />, color: "text-white" },
];

export default function ClientSetupPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [businessInfo, setBusinessInfo] = useState({
    description: "",
    goals: "",
    target_audience: "",
    competitors: "",
    brand_voice: "",
  });

  const togglePlatform = (id: string) => {
    setConnectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  async function completeSetup() {
    toast.success("Setup complete! Welcome aboard.");
    router.push("/dashboard/portal");
  }

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="text-center space-y-6">
      <Image src="/icons/shortstack-logo.png" alt="Trinity" width={80} height={80} className="mx-auto" />
      <div>
        <h1 className="text-3xl font-bold text-gold">Welcome aboard</h1>
        <p className="text-muted mt-2 max-w-md mx-auto">
          Hi {profile?.full_name || "there"}! Let&apos;s get your account set up so our AI agents can start working for you.
        </p>
      </div>
      <p className="text-sm text-muted">This takes about 2 minutes</p>
    </div>,

    // Step 1: Tell us about your business
    <div key="business" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Tell us about your business</h2>
      <p className="text-sm text-muted">This helps our AI personalize everything for you.</p>
      <div>
        <label className="block text-sm text-muted mb-1">What does your business do? *</label>
        <textarea value={businessInfo.description} onChange={e => setBusinessInfo({ ...businessInfo, description: e.target.value })}
          className="input w-full h-20" placeholder="e.g., We're a dental clinic serving families in Miami..." />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">What are your main goals?</label>
        <textarea value={businessInfo.goals} onChange={e => setBusinessInfo({ ...businessInfo, goals: e.target.value })}
          className="input w-full h-16" placeholder="e.g., Get more patients, increase online visibility, run ads..." />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Who is your target audience?</label>
        <input value={businessInfo.target_audience} onChange={e => setBusinessInfo({ ...businessInfo, target_audience: e.target.value })}
          className="input w-full" placeholder="e.g., Families with kids aged 25-45 in Miami area" />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Any competitors you want to beat?</label>
        <input value={businessInfo.competitors} onChange={e => setBusinessInfo({ ...businessInfo, competitors: e.target.value })}
          className="input w-full" placeholder="e.g., Bright Smile Dental, Miami Family Dentistry" />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">How should we sound when we talk about your brand?</label>
        <input value={businessInfo.brand_voice} onChange={e => setBusinessInfo({ ...businessInfo, brand_voice: e.target.value })}
          className="input w-full" placeholder="e.g., Professional but friendly, warm, trustworthy" />
      </div>
    </div>,

    // Step 2: Connect social media
    <div key="social" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Connect Your Social Media</h2>
      <p className="text-sm text-muted">Select the platforms you use. We&apos;ll manage content and publishing for you.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {SOCIAL_PLATFORMS.map(platform => (
          <button key={platform.id} onClick={() => togglePlatform(platform.id)}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              connectedPlatforms.includes(platform.id)
                ? "border-gold bg-gold/10"
                : "border-border hover:border-gold/30"
            }`}>
            <span className={platform.color}>{platform.icon}</span>
            <span className="text-sm font-medium">{platform.name}</span>
            {connectedPlatforms.includes(platform.id) && (
              <Check size={14} className="text-gold" />
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={() => setStep(3)} className="text-sm text-muted hover:text-foreground flex items-center gap-1">
          <X size={14} /> No thanks, maybe later
        </button>
        <button onClick={() => toast("Contact your account manager for help connecting accounts.")}
          className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
          <HelpCircle size={14} /> Need help setting it up?
        </button>
      </div>
    </div>,

    // Step 3: Meet Trinity
    <div key="trinity" className="text-center space-y-6">
      <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto">
        <MessageSquare size={32} className="text-gold" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gold">Meet Your AI Assistant</h2>
        <p className="text-muted mt-2 max-w-md mx-auto">
          Trinity is your personal AI assistant. Ask questions about your account, request content, check progress, or get marketing advice — anytime.
        </p>
      </div>
      <div className="bg-surface-light rounded-xl p-4 max-w-md mx-auto text-left">
        <p className="text-sm text-gold mb-2">Try asking Trinity:</p>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>&quot;What&apos;s the status of my content?&quot;</li>
          <li>&quot;When is my next invoice due?&quot;</li>
          <li>&quot;What are my competitors doing?&quot;</li>
          <li>&quot;Generate a blog post about [topic]&quot;</li>
          <li>&quot;How are my ads performing?&quot;</li>
        </ul>
      </div>
      <p className="text-xs text-muted">You can chat with Trinity from your portal dashboard anytime.</p>
    </div>,

    // Step 4: All set
    <div key="done" className="text-center space-y-6">
      <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto">
        <Check size={40} className="text-success" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">You&apos;re All Set!</h2>
        <p className="text-muted mt-2 max-w-md mx-auto">
          Our AI agents are now configured for your business. Here&apos;s what happens next:
        </p>
      </div>
      <div className="bg-surface-light rounded-xl p-6 max-w-md mx-auto text-left space-y-3">
        <div className="flex items-center gap-3">
          <Check size={16} className="text-gold shrink-0" />
          <span className="text-sm">Your account manager will reach out within 24 hours</span>
        </div>
        <div className="flex items-center gap-3">
          <Check size={16} className="text-gold shrink-0" />
          <span className="text-sm">AI will analyze your competitors and create a strategy</span>
        </div>
        <div className="flex items-center gap-3">
          <Check size={16} className="text-gold shrink-0" />
          <span className="text-sm">Content creation starts within the first week</span>
        </div>
        <div className="flex items-center gap-3">
          <Check size={16} className="text-gold shrink-0" />
          <span className="text-sm">You can track everything from your portal</span>
        </div>
      </div>
    </div>,
  ];

  return (
    <div className="fade-in max-w-2xl mx-auto py-8 space-y-6">
      {/* Progress */}
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? "bg-gold" : "bg-surface-light"}`} />
        ))}
      </div>

      {/* Step content */}
      <div className="card min-h-[400px] flex flex-col justify-center">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="btn-secondary">Back</button>
        ) : <div />}
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="btn-primary flex items-center gap-2">
            {step === 0 ? "Get Started" : "Continue"} <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={completeSetup} className="btn-primary flex items-center gap-2">
            Go to My Portal <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
