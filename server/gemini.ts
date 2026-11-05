import 'dotenv/config';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { db } from './db.js';

// Initialize server-side Gemini client with dynamic API key resolution
export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    const instance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const val = (instance as any)[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

// Helper to fetch live financial snapshot for AI grounding
export function getLiveFinancialContext(): string {
  try {
    const accounts = db.prepare("SELECT * FROM accounts WHERE type IN ('petrol', 'spending', 'custom')").all() as any[];
    const recentTx = db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT 8
    `).all() as any[];

    const petrolAcc = accounts.find(a => a.type === 'petrol');
    const spendingAcc = accounts.find(a => a.type === 'spending');

    // Calculate petrol spent this month
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const petrolSpentRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total_spent
      FROM transactions
      WHERE type = 'expense'
        AND account_id = 'acc-petrol'
        AND strftime('%Y-%m', date) = ?
    `).get(currentMonthPrefix) as any;

    const petrolSpent = ((petrolSpentRow?.total_spent || 0) / 100).toFixed(2);
    const petrolBal = ((petrolAcc?.balance_paise || 0) / 100).toFixed(2);

    // Calculate personal spending spent this month
    const spendingSpentRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total_spent
      FROM transactions
      WHERE type = 'expense'
        AND account_id = 'acc-spending'
        AND strftime('%Y-%m', date) = ?
    `).get(currentMonthPrefix) as any;

    const spendingSpent = ((spendingSpentRow?.total_spent || 0) / 100).toFixed(2);
    const spendingBal = ((spendingAcc?.balance_paise || 0) / 100).toFixed(2);

    // Total savings from dedicated savings records
    const savTotalRow = db.prepare('SELECT COALESCE(SUM(amount_paise), 0) as total FROM savings_records').get() as any;
    const totalSaved = ((savTotalRow?.total || 0) / 100).toFixed(2);

    const txSummary = recentTx.map(t =>
      `- ${t.date}: ${t.type === 'expense' ? 'Spent' : 'Allocated/Transferred'} ₹${(t.amount_paise / 100).toFixed(2)} on "${t.description}" (${t.account_name})`
    ).join('\n');

    return `
CURRENT FINANCIAL STATUS:
- College Petrol Account: Current Balance: ₹${petrolBal} | Spent this month: ₹${petrolSpent} | Available Money: ₹${petrolBal} (No monthly spending limits)
- Personal Spending Account: Current Balance: ₹${spendingBal} | Spent this month: ₹${spendingSpent} | Available Money: ₹${spendingBal} (No monthly spending limits)
- Savings (Dedicated Reference): Total Saved: ₹${totalSaved} (Accumulated when unused allocations are closed out)
- Recent Transactions:
${txSummary || 'No recent transactions.'}
`;
  } catch (err) {
    console.warn('Could not read financial context for Gemini:', err);
    return 'Financial Context: College Petrol and Personal Spending primary accounts with dedicated Savings reference section.';
  }
}

// Persona configurations for chatbot
export const PERSONAS: Record<string, string> = {
  advisor: `You are "RupeeWise", an elite, supportive AI Personal Finance Advisor specialized in helping college students manage their money cleanly.
You understand the user's customized financial model:
1. College Petrol: Financial account containing money allocated for college travel. Displays Current Balance, Spent This Month, and Available Money. Has NO monthly spending limit.
2. Personal Spending: Financial account containing money allocated for personal needs. Displays Current Balance, Spent This Month, and Available Money. Has NO monthly spending limit and balances persist across months.
3. Savings: A dedicated reference section (not a financial account). Unused money from closed allocations is automatically swept into Savings.
Always format currency values in Indian Rupees (₹). Give clear, empathetic, and actionable advice.`,

  budget_coach: `You are a high-energy College Spending & Allocation Coach.
Your goal is to help the user manage their money across College Petrol and Personal Spending, make smart trade-offs, and grow their Savings by closing out unused allocations.
Be motivational, direct, and practical without imposing rigid spending limits.`,

  petrol_auditor: `You are the College Petrol Commute Auditor.
Your focus is monitoring fuel efficiency, fuel prices, odometer logs, and tracking college commute expenses.
Provide calculated projections on fuel economy and refuel patterns based on recorded expenses.`,

  complex_analyst: `You are a Senior Quantitative Financial Analyst.
Perform thorough mathematical analysis, savings rate projections from closed allocations, emergency fund modeling, and multi-month expense forecasting.
Break down scenarios with structured calculations and pros/cons.`,
};

// Setup WebSocket server for Gemini Live API (gemini-3.8-live)
export function setupGeminiLiveServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[Gemini Live] Client connected for real-time voice conversation');

    if (!process.env.GEMINI_API_KEY) {
      clientWs.send(JSON.stringify({
        error: 'GEMINI_API_KEY is not set on the server. Please check your AI Studio environment configuration.',
      }));
      clientWs.close();
      return;
    }

    const financialContext = getLiveFinancialContext();
    let session: any = null;

    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          },
          systemInstruction: `You are the friendly, quick-witted voice assistant for "Rupee.".
You talk in a warm, concise, conversational tone (1-3 sentences max per response since you are speaking out loud).
${financialContext}
Always speak naturally. When mentioning amounts, say "rupees" clearly. Keep advice brief, clear, and encouraging.`,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Forward audio parts to client
            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
              }
              if (part.text) {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ text: part.text }));
                }
              }
            }

            // User interrupted model playback
            if (message.serverContent?.interrupted) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }
            }

            if (message.serverContent?.turnComplete) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ turnComplete: true }));
              }
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'session_closed' }));
            }
          },
          onerror: (err: any) => {
            console.error('[Gemini Live Error]:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Live API error' }));
            }
          },
        },
      });

      // Send initial ready signal
      clientWs.send(JSON.stringify({ status: 'ready', model: 'gemini-3.8-live' }));

      // Handle incoming audio from client
      clientWs.on('message', (raw: any) => {
        try {
          const payload = JSON.parse(raw.toString());
          if (payload.audio) {
            session.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (payload.text) {
            session.sendRealtimeInput({
              text: payload.text,
            });
          }
        } catch (err) {
          console.error('[Gemini Live] Message parse error:', err);
        }
      });

      clientWs.on('close', () => {
        console.log('[Gemini Live] Client disconnected');
        try {
          session?.close();
        } catch (e) {}
      });

    } catch (err: any) {
      console.error('[Gemini Live Setup Error]:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          error: `Could not connect to Gemini Live API: ${err?.message || 'Unknown error'}`,
        }));
        clientWs.close();
      }
    }
  });

  return wss;
}
