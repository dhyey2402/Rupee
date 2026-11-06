import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  Mic,
  MicOff,
  Send,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
  Cpu,
  Layers,
  Fuel,
  Wallet,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { apiUrl, getApiBaseUrl } from '../utils/apiConfig';
import { floatTo16BitPcmBase64, LiveAudioPlayer } from '../utils/liveAudio';
import { formatINR } from '../utils/format';
import { BootstrapData } from '../types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

interface Persona {
  id: string;
  name: string;
  description: string;
  suggestedPrompts: string[];
}

interface AiAdvisorViewProps {
  data: BootstrapData;
  initialMode?: 'chat' | 'voice';
}

export const AiAdvisorView: React.FC<AiAdvisorViewProps> = ({ data, initialMode = 'chat' }) => {
  const [activeMode, setActiveMode] = useState<'chat' | 'voice'>(initialMode);

  // Chatbot State
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('MMM_AI_CHAT_HISTORY');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'msg-welcome',
        role: 'model',
        text: `Hello! I'm your Rupee. AI Advisor. I have full real-time awareness of your separate financial accounts—including your **College Petrol account**, **Personal Spending**, and your accumulated **Savings**.\n\nHow can I help you optimize your money today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.8-flash',
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-4-argon'>('gemini-3.8-flash');
  const [selectedPersona, setSelectedPersona] = useState<string>('advisor');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('MMM_AI_CHAT_HISTORY', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Fetch personas
  useEffect(() => {
    fetch(apiUrl('/api/gemini/personas'))
      .then(r => r.json())
      .then(d => {
        if (d.personas) setPersonas(d.personas);
      })
      .catch(() => {});
  }, []);

  // Send Chat Message
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isSending) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...messages, userMessage];
    setMessages(updated);
    setInputPrompt('');
    setIsSending(true);
    setChatError(null);

    try {
      const res = await fetch(apiUrl('/api/gemini/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map(m => ({ role: m.role, text: m.text })),
          model: selectedModel,
          persona: selectedPersona,
          includeFinancialContext: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to get AI response');

      const modelMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'model',
        text: json.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: json.modelUsed || selectedModel,
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      setChatError(err.message || 'Error communicating with Gemini');
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your conversation history?')) {
      const resetMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'model',
        text: `Conversation cleared. I am ready with your real-time financial balances. What would you like to explore?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
      };
      setMessages([resetMsg]);
      localStorage.removeItem('MMM_AI_CHAT_HISTORY');
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // -------------------------------------------------------------
  // Live API Voice Conversation State (gemini-3.8-live)
  // -------------------------------------------------------------
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState('Idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 1 for visualizer
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isMutedRef = useRef(isMicMuted);

  useEffect(() => {
    isMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Clean up voice on unmount or tab switch
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  const startVoiceSession = async () => {
    setIsVoiceConnecting(true);
    setVoiceError(null);
    setVoiceStatusText('Connecting to Gemini 3.8 Live...');

    try {
      // 1. Initialize 24kHz audio playback manager
      if (!playerRef.current) {
        playerRef.current = new LiveAudioPlayer();
      }
      await playerRef.current.resume();

      // 2. Request mic access at 16kHz
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 3. Connect WebSocket to server Live API bridge
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const baseApiUrl = getApiBaseUrl();
      let wsUrl: string;

      if (baseApiUrl) {
        const cleanBase = baseApiUrl.replace(/^https?:\/\//, '');
        wsUrl = `${wsProtocol}//${cleanBase}/api/live`;
      } else {
        wsUrl = `${wsProtocol}//${window.location.host}/api/live`;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsVoiceConnected(true);
        setIsVoiceConnecting(false);
        setVoiceStatusText('Listening... (Speak naturally)');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setVoiceError(msg.error);
            setVoiceStatusText('Error occurred');
          }
          if (msg.audio) {
            setVoiceStatusText('Gemini is speaking...');
            playerRef.current?.playChunk(msg.audio, level => {
              setAudioLevel(level);
            });
          }
          if (msg.text) {
            setLiveTranscript(prev => prev + ' ' + msg.text);
          }
          if (msg.interrupted) {
            playerRef.current?.interrupt();
            setVoiceStatusText('Listening... (Interrupted)');
          }
          if (msg.turnComplete) {
            setVoiceStatusText('Listening...');
            setAudioLevel(0);
          }
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket Live Error:', e);
        setVoiceError('Connection to Gemini Live API failed. Ensure server has GEMINI_API_KEY.');
        setIsVoiceConnecting(false);
      };

      ws.onclose = () => {
        setIsVoiceConnected(false);
        setIsVoiceConnecting(false);
        setVoiceStatusText('Disconnected');
      };

      // 4. Setup 16kHz input audio processing
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const sourceNode = inputCtx.createMediaStreamSource(stream);
      const processorNode = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processorNode;

      sourceNode.connect(processorNode);
      processorNode.connect(inputCtx.destination);

      processorNode.onaudioprocess = (e) => {
        if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const channelData = e.inputBuffer.getChannelData(0);

        // Simple volume level calculation for visualizer
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        if (rms > 0.01) {
          setAudioLevel(Math.min(1, rms * 4));
        }

        const base64Pcm = floatTo16BitPcmBase64(channelData);
        wsRef.current.send(JSON.stringify({ audio: base64Pcm }));
      };

    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      setVoiceError(err.message || 'Microphone access denied or connection failed.');
      setIsVoiceConnecting(false);
      stopVoiceSession();
    }
  };

  const stopVoiceSession = () => {
    // Stop mic stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    // Disconnect script processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    // Close input audio context
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    // Close player
    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }
    // Close websocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsVoiceConnected(false);
    setIsVoiceConnecting(false);
    setVoiceStatusText('Idle');
    setAudioLevel(0);
  };

  // Find active persona info
  const currentPersona = personas.find(p => p.id === selectedPersona) || {
    name: 'Personal Financial Advisor',
    description: 'Comprehensive advice on accounts, college petrol limits, and independent savings.',
    suggestedPrompts: [
      'How is my overall financial health looking this month?',
      'How much money can I safely spend on non-essentials?',
      'Can you explain why my savings are excluded from available spending?',
    ],
  };

  const bankAcc = data.accounts.find(a => a.type === 'bank');
  const petrolBudget = data.budgets.find(b => b.category_id === 'cat-petrol' || b.name.toLowerCase().includes('petrol'));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#065F46] text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#111318]">Gemini Financial Intelligence</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] font-semibold border border-[#A7F3D0]">
                Live Context Active
              </span>
            </div>
            <p className="text-xs text-[#717680] mt-0.5">
              Live API voice conversations and multi-turn financial advisory powered by Gemini.
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center p-1 bg-[#F8F9FA] rounded-2xl border border-[#EAEBED] self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'chat'
                ? 'bg-white text-[#111318] shadow-xs border border-[#EAEBED]'
                : 'text-[#717680] hover:text-[#111318]'
            }`}
          >
            <Bot className="w-4 h-4 text-[#065F46]" />
            <span>AI Chatbot</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('voice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'voice'
                ? 'bg-white text-[#111318] shadow-xs border border-[#EAEBED]'
                : 'text-[#717680] hover:text-[#111318]'
            }`}
          >
            <Mic className="w-4 h-4 text-[#B45309]" />
            <span>Live Voice (gemini-3.8-live)</span>
            <span className="w-2 h-2 rounded-full bg-[#065F46] animate-pulse" />
          </button>
        </div>
      </div>

      {/* Real-time Context Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-[#EAEBED] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#B45309] flex items-center justify-center shrink-0">
            <Fuel className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-[#717680] font-semibold block uppercase">Petrol Budget</span>
            <span className="text-xs font-bold text-[#111318] font-mono truncate block">
              {petrolBudget ? formatINR(petrolBudget.remaining_paise || 0) : '₹2,000'} left
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#EAEBED] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#065F46] flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-[#717680] font-semibold block uppercase">Available to Spend</span>
            <span className="text-xs font-bold text-[#065F46] font-mono truncate block">
              {formatINR(data.summary.availableSpendingPaise)}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#EAEBED] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-[#717680] font-semibold block uppercase">Savings (Excluded)</span>
            <span className="text-xs font-bold text-[#111318] font-mono truncate block">
              {formatINR(data.summary.totalSavingsPaise)}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#EAEBED] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-50 text-[#111318] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-[#717680] font-semibold block uppercase">Total Money</span>
            <span className="text-xs font-bold text-[#111318] font-mono truncate block">
              {formatINR(data.summary.totalMoneyPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODE 1: MULTI-TURN CHATBOT                                   */}
      {/* ============================================================ */}
      {activeMode === 'chat' && (
        <div className="bg-white rounded-3xl border border-[#EAEBED] shadow-xs flex flex-col h-[700px] overflow-hidden">
          {/* Chat Control Toolbar */}
          <div className="p-4 border-b border-[#EAEBED] bg-[#F8F9FA] flex flex-wrap items-center justify-between gap-3">
            {/* Persona Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#717680]">Role:</span>
              <select
                value={selectedPersona}
                onChange={e => setSelectedPersona(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#EAEBED] text-[#111318] rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46] cursor-pointer"
              >
                <option value="advisor">Personal Financial Advisor</option>
                <option value="budget_coach">College Budget Coach</option>
                <option value="petrol_auditor">College Petrol Auditor</option>
                <option value="complex_analyst">Quantitative Scenario Analyst</option>
              </select>
            </div>

            {/* Model Selector (Flash, Flash-Lite, Argon) */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#717680] flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> Model:
              </span>
              <div className="flex items-center bg-white border border-[#EAEBED] rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.8-flash')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedModel === 'gemini-3.8-flash'
                      ? 'bg-[#065F46] text-white font-bold'
                      : 'text-[#717680] hover:text-[#111318]'
                  }`}
                  title="General tasks - balanced intelligence & speed"
                >
                  3.8 Flash (General)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedModel === 'gemini-3.1-flash-lite'
                      ? 'bg-[#065F46] text-white font-bold'
                      : 'text-[#717680] hover:text-[#111318]'
                  }`}
                  title="Fast tasks - ultra low latency"
                >
                  3.1 Lite (Fast)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-4-argon')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedModel === 'gemini-4-argon'
                      ? 'bg-[#065F46] text-white font-bold'
                      : 'text-[#717680] hover:text-[#111318]'
                  }`}
                  title="Particularly complex tasks - advanced mathematical & scenario reasoning"
                >
                  4 Argon (Complex)
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 text-[#717680] hover:text-[#DC2626] hover:bg-white rounded-lg border border-transparent hover:border-[#EAEBED] transition-colors cursor-pointer"
                title="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Persona Description Banner */}
          <div className="px-5 py-2.5 bg-[#FAF7F2] border-b border-[#EFE8DC] flex items-center justify-between text-xs text-[#713F12]">
            <span>
              <strong>{currentPersona.name}:</strong> {currentPersona.description}
            </span>
          </div>

          {/* Scrollable Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#065F46] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[75%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-[#065F46] text-white rounded-tr-xs shadow-xs'
                          : 'bg-[#F8F9FA] text-[#111318] border border-[#EAEBED] rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {msg.text}
                    </div>

                    <div className={`flex items-center gap-2 px-1 text-[10px] text-[#717680] ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.timestamp}</span>
                      {msg.modelUsed && (
                        <span>· {msg.modelUsed}</span>
                      )}
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="hover:text-[#111318] transition-colors cursor-pointer ml-1"
                          title="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-[#065F46]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#111318] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs font-bold text-xs">
                      You
                    </div>
                  )}
                </div>
              );
            })}

            {isSending && (
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-xl bg-[#065F46] text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="p-4 bg-[#F8F9FA] border border-[#EAEBED] rounded-2xl rounded-tl-xs text-xs text-[#717680] flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#065F46] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-[#065F46] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-[#065F46] rounded-full animate-bounce" />
                  </div>
                  <span>Analyzing with {selectedModel}...</span>
                </div>
              </div>
            )}

            {chatError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{chatError}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Chips */}
          <div className="px-5 py-2.5 bg-[#F8F9FA] border-t border-[#EAEBED] overflow-x-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#717680] uppercase tracking-wider shrink-0">
              Suggestions:
            </span>
            {currentPersona.suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isSending}
                className="px-3 py-1 bg-white hover:bg-[#EAEBED] border border-[#EAEBED] rounded-lg text-xs text-[#111318] whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-4 border-t border-[#EAEBED] bg-white flex items-center gap-3"
          >
            <input
              type="text"
              placeholder={`Ask ${currentPersona.name} about petrol, spending balances, or savings...`}
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              disabled={isSending}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#EAEBED] bg-[#F8F9FA] text-[#111318] text-xs focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46] focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={isSending || !inputPrompt.trim()}
              className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODE 2: REAL-TIME LIVE VOICE CONVERSATION (gemini-3.8-live) */}
      {/* ============================================================ */}
      {activeMode === 'voice' && (
        <div className="bg-white rounded-3xl border border-[#EAEBED] p-8 sm:p-12 shadow-xs text-center space-y-8 min-h-[550px] flex flex-col justify-between items-center">
          {/* Header Info */}
          <div className="max-w-md space-y-2">
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#FAF7F2] text-[#B45309] font-bold border border-[#EFE8DC] uppercase">
              Model: gemini-3.8-live · Low-Latency Real-Time Audio
            </span>
            <h3 className="text-xl font-bold text-[#111318] pt-1">
              Live Voice Assistant
            </h3>
            <p className="text-xs text-[#717680] leading-relaxed">
              Have an interactive, spoken conversation with Gemini in real-time. Discuss your college petrol expenses, personal spending balances, and savings directly through your microphone.
            </p>
          </div>

          {/* Animated Tactile Visualizer Orb */}
          <div className="relative flex items-center justify-center my-4">
            {/* Outer Pulsing Wave Ring */}
            <div
              className={`absolute rounded-full transition-all duration-150 ${
                isVoiceConnected
                  ? 'bg-[#065F46]/10 animate-ping'
                  : 'bg-slate-100'
              }`}
              style={{
                width: `${160 + audioLevel * 100}px`,
                height: `${160 + audioLevel * 100}px`,
              }}
            />

            {/* Middle Wave Ring */}
            <div
              className={`absolute rounded-full transition-all duration-200 ${
                isVoiceConnected
                  ? 'bg-[#065F46]/20'
                  : 'bg-slate-100'
              }`}
              style={{
                width: `${130 + audioLevel * 70}px`,
                height: `${130 + audioLevel * 70}px`,
              }}
            />

            {/* Core Orb */}
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 z-10 ${
                isVoiceConnected
                  ? isMicMuted
                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                    : 'bg-[#065F46] text-white shadow-[#065F46]/30'
                  : 'bg-slate-900 text-white'
              }`}
            >
              {isVoiceConnecting ? (
                <RefreshCw className="w-10 h-10 animate-spin" />
              ) : isMicMuted ? (
                <MicOff className="w-10 h-10" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </div>
          </div>

          {/* Status Message */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F8F9FA] border border-[#EAEBED]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isVoiceConnected
                    ? 'bg-[#065F46] animate-pulse'
                    : isVoiceConnecting
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-slate-300'
                }`}
              />
              <span className="text-xs font-semibold text-[#111318]">
                {voiceStatusText}
              </span>
            </div>

            {voiceError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl max-w-md mx-auto">
                {voiceError}
              </div>
            )}
          </div>

          {/* Live Transcript / Spoken Output */}
          {liveTranscript && (
            <div className="max-w-lg w-full bg-[#F8F9FA] border border-[#EAEBED] p-4 rounded-2xl text-left space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#717680] block">Spoken Transcript</span>
              <p className="text-xs text-[#111318] leading-relaxed italic max-h-24 overflow-y-auto">
                &ldquo;{liveTranscript.trim()}&rdquo;
              </p>
            </div>
          )}

          {/* Voice Action Controls */}
          <div className="flex items-center justify-center gap-3 pt-2">
            {!isVoiceConnected ? (
              <button
                type="button"
                onClick={startVoiceSession}
                disabled={isVoiceConnecting}
                className="px-8 py-3.5 bg-[#065F46] hover:bg-[#047857] text-white rounded-2xl text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isVoiceConnecting ? 'Connecting...' : 'Start Voice Conversation'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsMicMuted(!isMicMuted)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isMicMuted
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white border-[#EAEBED] text-[#111318] hover:bg-[#F8F9FA]'
                  }`}
                  title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => playerRef.current?.interrupt()}
                  className="px-4 py-3 bg-white border border-[#EAEBED] hover:bg-[#F8F9FA] text-[#111318] rounded-2xl text-xs font-semibold transition-all cursor-pointer"
                  title="Interrupt model playback"
                >
                  Interrupt
                </button>

                <button
                  type="button"
                  onClick={stopVoiceSession}
                  className="px-6 py-3.5 bg-[#DC2626] hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
