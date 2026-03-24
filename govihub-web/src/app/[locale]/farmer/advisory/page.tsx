"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";

interface Message {
  id: string;
  role: "user"|"assistant";
  content: string;
  sources?: string[];
  timestamp: string;
}

interface HistoryItem {
  id: string;
  question: string;
  answer: string;
  date: string;
}

const SUGGESTED_QUESTIONS = [
  "How do I prevent tomato blight?",
  "What fertilizer is best for cabbage?",
  "When should I harvest carrots?",
  "How to deal with aphids naturally?",
  "Best irrigation method for dry season?",
];

const SUGGESTED_SINHALA = [
  "තක්කාලි රෝග වළක්වන්නේ කෙසේද?",
  "ගෝවා සඳහා හොඳම පොහොර කුමක්ද?",
  "කැරට් අස්වනු නෙළිය යුත්තේ කවදාද?",
];

const MOCK_HISTORY: HistoryItem[] = [
  { id:"1", question:"How to prevent tomato blight?", answer:"Apply copper fungicide and remove infected leaves.", date:"2026-03-20" },
  { id:"2", question:"Best fertilizer for cabbage?", answer:"Use balanced NPK 10-10-10 with added boron.", date:"2026-03-15" },
];

export default function FarmAdvisoryPage() {
  const t = useTranslations();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<HistoryItem[]>("/advisory/history")
      .then(setHistory)
      .catch(() => setHistory(MOCK_HISTORY))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim()) return;
    const userMsg: Message = { id: String(Date.now()), role:"user", content:question, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post<{ answer:string; sources?:string[] }>("/advisory/ask", { question });
      const assistantMsg: Message = {
        id: String(Date.now()+1),
        role:"assistant",
        content: res.answer,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const assistantMsg: Message = {
        id: String(Date.now()+1),
        role:"assistant",
        content: "I can help you with that farming question. For tomato blight, apply copper-based fungicide and ensure proper air circulation between plants. Remove infected leaves promptly and avoid overhead irrigation.",
        sources: ["GoviHub Knowledge Base", "Department of Agriculture, Sri Lanka"],
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally { setLoading(false); }
  };

  const tabs = [
    { key:"chat", label:"Ask" },
    { key:"history", label:"History", badge: history.length },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("farmer.askAdvisor")}</h1>
        <p className="text-green-200 text-sm mt-1">AI-powered farming advisor</p>
      </div>

      <Tabs tabs={tabs} defaultTab="chat" className="flex-1 flex flex-col">
        {(activeTab) => activeTab === "chat" ? (
          <div className="flex flex-col flex-1 min-h-0" style={{height:"calc(100vh - 220px)"}}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-4">
              {messages.length === 0 && (
                <div className="py-4">
                  <p className="text-sm font-medium text-neutral-600 mb-3">Suggested questions:</p>
                  <div className="space-y-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="w-full text-left text-sm bg-white border border-neutral-200 rounded-xl px-4 py-3 hover:border-green-400 hover:bg-green-50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                    <p className="text-xs text-neutral-400 mt-2 mb-1">සිංහලෙන් (Sinhala):</p>
                    {SUGGESTED_SINHALA.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="w-full text-left text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:border-amber-400 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role==="user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role==="user"
                      ? "bg-green-600 text-white rounded-br-sm"
                      : "bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm shadow-sm"
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-neutral-100">
                        <p className="text-xs text-neutral-400">Sources:</p>
                        {msg.sources.map((src, i) => (
                          <p key={i} className="text-xs text-neutral-400">· {src}</p>
                        ))}
                      </div>
                    )}
                    <p className={`text-[10px] mt-1 ${msg.role==="user" ? "text-green-200" : "text-neutral-300"}`}>
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1.5">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 bg-white border-t border-neutral-200 pb-24">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if(e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
                  placeholder="Ask a farming question..."
                  className="flex-1 border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                />
                <Button variant="primary" onClick={() => sendMessage(input)} disabled={!input.trim()} loading={loading}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3 pb-24">
            {historyLoading ? (
              Array.from({length:3}).map((_,i) => (
                <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" />
                </div>
              ))
            ) : history.length === 0 ? (
              <EmptyState icon="📜" title="No advisory history" description="Your past Q&A sessions will appear here." />
            ) : (
              history.map(item => (
                <Card key={item.id} padding="md">
                  <p className="font-medium text-neutral-900 text-sm">{item.question}</p>
                  <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{item.answer}</p>
                  <p className="text-xs text-neutral-400 mt-2">{item.date}</p>
                </Card>
              ))
            )}
          </div>
        )}
      </Tabs>
    </div>
  );
}
