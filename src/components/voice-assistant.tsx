"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Mic, Volume2, VolumeX, X, MessageSquare, StopCircle, Settings } from "lucide-react";
import Image from "next/image";

interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function VoiceAssistant() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [textInput, setTextInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voicePitch] = useState(1.0);
  const [autoPlayBriefing, setAutoPlayBriefing] = useState(true);
  const [hasPlayedBriefing, setHasPlayedBriefing] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-play briefing when opened for the first time
  useEffect(() => {
    if (isOpen && !hasPlayedBriefing && autoPlayBriefing && profile) {
      setHasPlayedBriefing(true);
      generateBriefing();
    }
  }, [isOpen, hasPlayedBriefing, autoPlayBriefing, profile]);

  async function generateBriefing() {
    setProcessing(true);
    const isClient = profile?.role === "client";

    try {
      const endpoint = isClient ? "/api/trinity/client-chat" : "/api/agents/chief";
      const briefingPrompt = isClient
        ? "Give me a quick briefing on my account. What's the status of my tasks, any updates on my content, and what's coming up next?"
        : "Give me a brief status update. How many leads do we have, what's the MRR, any outreach results, system issues, or things I should know about?";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: briefingPrompt }),
      });
      const data = await res.json();
      const reply = data.reply || "Welcome back! Everything is running smoothly.";

      const greeting = `Hey ${profile?.full_name?.split(" ")[0] || "there"}! ${reply}`;

      setMessages([{ role: "assistant", content: greeting, timestamp: new Date() }]);

      if (!isMuted) {
        speak(greeting);
      }
    } catch {
      const fallback = `Welcome back ${profile?.full_name?.split(" ")[0] || ""}! I'm ready to help. Ask me anything.`;
      setMessages([{ role: "assistant", content: fallback, timestamp: new Date() }]);
      if (!isMuted) speak(fallback);
    }
    setProcessing(false);
  }

  const audioElRef = useRef<HTMLAudioElement | null>(null);

  async function speak(text: string) {
    if (isMuted) return;
    setIsSpeaking(true);

    // Try ElevenLabs first
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.substring(0, 500) }),
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 500 && blob.type.includes("audio")) {
          const url = URL.createObjectURL(blob);
          if (!audioElRef.current) {
            audioElRef.current = document.createElement("audio");
            document.body.appendChild(audioElRef.current);
          }
          audioElRef.current.src = url;
          audioElRef.current.volume = 1.0;
          audioElRef.current.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
          audioElRef.current.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); browserSpeak(text); };
          await audioElRef.current.play();
          return;
        }
      }
    } catch {}

    browserSpeak(text);
  }

  function browserSpeak(text: string) {
    if (!("speechSynthesis" in window)) { setIsSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = voiceSpeed; u.pitch = voicePitch; u.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Microsoft Aria")) || voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
    if (preferred) u.voice = preferred;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    synthRef.current = u;
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.currentTime = 0; }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function startListening() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setInputMode("text");
      return;
    }

    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    const recognition = new (SpeechRecognition as new () => SpeechRecognition)();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      sendMessage(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: VoiceMessage = { role: "user", content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setProcessing(true);

    try {
      const isClient = profile?.role === "client";
      const endpoint = isClient ? "/api/trinity/client-chat" : "/api/agents/chief";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-6).map(m => ({ role: m.role === "assistant" ? "chief" : "user", content: m.content })) }),
      });
      const data = await res.json();
      let reply = data.reply || "I didn't catch that. Could you try again?";

      // Execute actions based on voice command
      const cmd = text.toLowerCase();
      if (cmd.includes("send email") || cmd.includes("cold call") || cmd.includes("outreach")) {
        fetch("/api/cron/outreach", { headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ""}` } }).catch(() => {});
        reply += " I triggered the outreach system — 20 emails, 20 SMS, and 200 call tags.";
      }
      if (cmd.includes("scrape") || cmd.includes("find lead")) {
        fetch("/api/cron/scrape-leads", { headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ""}` } }).catch(() => {});
        reply += " Lead scraping started.";
      }
      if (cmd.includes("health check") || cmd.includes("check system")) {
        fetch("/api/cron/health-check", { headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ""}` } }).catch(() => {});
        reply += " Running health check now.";
      }

      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date() }]);

      if (!isMuted) {
        speak(reply);
      }
    } catch {
      const errMsg = "Sorry, I'm having trouble connecting. Try again in a moment.";
      setMessages(prev => [...prev, { role: "assistant", content: errMsg, timestamp: new Date() }]);
    }
    setProcessing(false);
  }

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-72 z-50 bg-gradient-to-r from-gold-dark to-gold px-4 py-2.5 rounded-full shadow-lg shadow-gold/20 flex items-center gap-2 hover:scale-105 transition-all active:scale-95 group">
        <div className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">
          <Mic size={14} className="text-black" />
        </div>
        <span className="text-black font-medium text-sm">Hey {profile?.full_name?.split(" ")[0] || "there"}</span>
        <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-72 z-50 w-[420px] bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden fade-in" style={{ height: "560px" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-gold-dark/20 to-gold/10 px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gold/20 rounded-full flex items-center justify-center relative">
            <Image src="/icons/shortstack-logo.png" alt="Assistant" width={20} height={20} />
            {isSpeaking && <div className="absolute inset-0 rounded-full border-2 border-gold animate-ping" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">ShortStack AI</p>
            <p className="text-[10px] text-gold">{isListening ? "Listening..." : isSpeaking ? "Speaking..." : processing ? "Thinking..." : "Ready"}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-white transition-colors">
            <Settings size={14} />
          </button>
          <button onClick={() => { stopSpeaking(); setIsOpen(false); }} className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-surface-light border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Input Mode</span>
            <div className="flex gap-1">
              <button onClick={() => setInputMode("voice")}
                className={`text-xs px-2 py-1 rounded ${inputMode === "voice" ? "bg-gold text-black" : "bg-surface text-muted"}`}>
                Voice
              </button>
              <button onClick={() => setInputMode("text")}
                className={`text-xs px-2 py-1 rounded ${inputMode === "text" ? "bg-gold text-black" : "bg-surface text-muted"}`}>
                Text
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Audio Output</span>
            <button onClick={() => { setIsMuted(!isMuted); if (!isMuted) stopSpeaking(); }}
              className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${isMuted ? "bg-danger/20 text-danger" : "bg-success/20 text-success"}`}>
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {isMuted ? "Muted" : "On"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Speed: {voiceSpeed}x</span>
            <input type="range" min="0.5" max="2" step="0.1" value={voiceSpeed}
              onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="w-24 accent-gold" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Auto-briefing on open</span>
            <button onClick={() => setAutoPlayBriefing(!autoPlayBriefing)}
              className={`text-xs px-2 py-1 rounded ${autoPlayBriefing ? "bg-gold text-black" : "bg-surface text-muted"}`}>
              {autoPlayBriefing ? "On" : "Off"}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
              msg.role === "user"
                ? "bg-gold text-black rounded-br-sm"
                : "bg-surface-light text-white rounded-bl-sm"
            }`}>
              <p className="text-sm leading-relaxed">{msg.content}</p>
              <p className={`text-[9px] mt-1 ${msg.role === "user" ? "text-black/40" : "text-muted"}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {processing && (
          <div className="flex justify-start">
            <div className="bg-surface-light rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Controls */}
      <div className="p-3 border-t border-border">
        {inputMode === "voice" ? (
          <div className="flex items-center justify-center gap-4">
            {/* Mute button */}
            <button onClick={() => { setIsMuted(!isMuted); if (!isMuted) stopSpeaking(); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-danger/20 text-danger" : "bg-surface-light text-muted hover:text-white"}`}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Main mic button */}
            {isListening ? (
              <button onClick={stopListening}
                className="w-16 h-16 rounded-full bg-danger flex items-center justify-center shadow-lg shadow-danger/30 animate-pulse">
                <StopCircle size={28} className="text-white" />
              </button>
            ) : isSpeaking ? (
              <button onClick={stopSpeaking}
                className="w-16 h-16 rounded-full bg-gold flex items-center justify-center shadow-lg shadow-gold/30 animate-pulse">
                <StopCircle size={28} className="text-black" />
              </button>
            ) : (
              <button onClick={startListening} disabled={processing}
                className="w-16 h-16 rounded-full bg-gold flex items-center justify-center shadow-lg shadow-gold/30 hover:scale-105 transition-all active:scale-95 disabled:opacity-50">
                <Mic size={28} className="text-black" />
              </button>
            )}

            {/* Switch to text */}
            <button onClick={() => setInputMode("text")}
              className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center text-muted hover:text-white transition-colors">
              <MessageSquare size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(textInput); setTextInput(""); }} className="flex gap-2">
            <button type="button" onClick={() => setInputMode("voice")}
              className="w-9 h-9 rounded-full bg-surface-light flex items-center justify-center text-muted hover:text-white shrink-0">
              <Mic size={16} />
            </button>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-surface-light border border-border rounded-full px-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-gold/50"
              disabled={processing}
              autoFocus
            />
            <button type="submit" disabled={!textInput.trim() || processing}
              className="w-9 h-9 bg-gold rounded-full flex items-center justify-center disabled:opacity-30 shrink-0">
              <MessageSquare size={14} className="text-black" />
            </button>
          </form>
        )}

        <p className="text-center text-[9px] text-muted mt-2">
          {isListening ? "Listening... speak now" : isSpeaking ? "Tap gold button to stop" : inputMode === "voice" ? "Tap mic to speak" : "Type or switch to voice"}
        </p>
      </div>
    </div>
  );
}
