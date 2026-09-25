import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../stores/AuthContext";
import { studyApi } from "../../api";
import type { ChapterSummaryResponse } from "../../api";
import { ApiError, streamSSE } from "../../api/client";
import { MathRenderer } from "../shared/MathRenderer";
import { SkeletonCard } from "../shared/SkeletonCard";
import { AILoader } from "../shared/AILoader";
import { addRecentStudy } from "../../stores/recentActivity";
import { useChapters } from "../../stores/useChapters";
import type { Subject, HistoryMessage, StudyResponse } from "../../types";

interface UserMessage    { kind: "user";    text: string }
interface RustyMessage   { kind: "rusty";   data: StudyResponse; chapter: string | null }
interface SummaryMessage { kind: "summary"; data: ChapterSummaryResponse }
interface ErrorMessage   { kind: "error";   text: string; isSafeguard?: boolean; retryQuery?: string }
type ChatMessage = UserMessage | RustyMessage | SummaryMessage | ErrorMessage;

type StreamStage = "embedding" | "retrieving" | "retrieved" | "generating" | "cache_hit" | null;

interface Props {
  subject: Subject;
  chapter: string | null;
  medium: "en" | "hi";
  onBack: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  embedding: "Understanding your question...",
  retrieving: "Searching textbooks...",
  retrieved: "Found relevant passages...",
  generating: "Rusty is writing...",
  cache_hit: "Found a quick answer...",
};

const MAX_RETRIES = 2;
const RETRY_DELAYS = [2000, 4000];

function KeyPointCard({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="mt-1 w-4 h-4 bg-rusty-ai rounded-full flex-shrink-0 flex items-center justify-center">
        <span className="text-white text-[9px] font-bold">✓</span>
      </span>
      <p className="text-sm text-rusty-ai-dark leading-relaxed">
        <MathRenderer text={text} />
      </p>
    </div>
  );
}

function RustyBubble({ msg, chapter }: { msg: RustyMessage; chapter: string | null }) {
  const { data } = msg;
  const sourceChapter = msg.chapter ?? chapter;
  return (
    <div className="flex justify-start max-w-[95%]">
      <div className="bg-rusty-ai-soft border border-rusty-ai/20 rounded-2xl rounded-tl-sm px-4 py-4 space-y-3 w-full">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-rusty-ai rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">R</span>
          </div>
          <span className="text-xs font-semibold text-rusty-ai">Rusty</span>
        </div>

        {data.key_points.length > 0 && (
          <div className="space-y-2">
            {data.key_points.map((pt, i) => <KeyPointCard key={i} text={pt} />)}
          </div>
        )}

        {data.notes && (
          <p className="text-sm text-rusty-ai-dark leading-relaxed">
            <MathRenderer text={data.notes} />
          </p>
        )}

        {data.misconceptions.length > 0 && (
          <div className="bg-rusty-warning-soft rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-xs font-bold text-rusty-warning-dark flex items-center gap-1">
              <span>⚠️</span> Watch out:
            </p>
            {data.misconceptions.map((m, i) => (
              <p key={i} className="text-xs text-rusty-warning-dark">
                <MathRenderer text={m} />
              </p>
            ))}
          </div>
        )}

        <div className="pt-1 border-t border-rusty-ai/10 space-y-0.5">
          {data.sources && data.sources.length > 0 ? (
            data.sources.map((src, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-xs text-rusty-ai/60">📖</span>
                <p className="text-xs text-rusty-ai/60">
                  {[
                    src.source_pdf && `Source: ${src.source_pdf.replace(".pdf", "")}`,
                    src.chapter && src.chapter,
                    src.page_num && `Page ${src.page_num}`,
                  ].filter(Boolean).join(" · ") || "Textbook passage"}
                </p>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-rusty-ai/60">📖</span>
              <p className="text-xs text-rusty-ai/60">
                From {data.source_chunks} textbook passage{data.source_chunks !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBubble({ msg }: { msg: SummaryMessage }) {
  const { data } = msg;
  return (
    <div className="flex justify-start max-w-[95%]">
      <div className="bg-rusty-green-soft border border-rusty-green/20 rounded-2xl rounded-tl-sm px-4 py-4 space-y-3 w-full">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-rusty-green rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">R</span>
          </div>
          <span className="text-xs font-semibold text-rusty-green">Chapter Summary</span>
        </div>

        <p className="text-sm text-rusty-ink leading-relaxed">
          <MathRenderer text={data.summary} />
        </p>

        {data.key_topics.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-rusty-green-dark">Key Topics:</p>
            {data.key_topics.map((t, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="mt-0.5 w-4 h-4 bg-rusty-green rounded-full flex-shrink-0 flex items-center justify-center">
                  <span className="text-white text-[9px] font-bold">{i + 1}</span>
                </span>
                <p className="text-sm text-rusty-green-dark"><MathRenderer text={t} /></p>
              </div>
            ))}
          </div>
        )}

        {data.important_formulas.length > 0 && (
          <div className="bg-rusty-ai-soft rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-xs font-bold text-rusty-ai-dark">Important Formulas:</p>
            {data.important_formulas.map((f, i) => (
              <p key={i} className="text-xs text-rusty-ai-dark"><MathRenderer text={f} /></p>
            ))}
          </div>
        )}

        {data.important_definitions.length > 0 && (
          <div className="bg-rusty-cream rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-xs font-bold text-rusty-ink">Important Definitions:</p>
            {data.important_definitions.map((d, i) => (
              <p key={i} className="text-xs text-rusty-muted"><MathRenderer text={d} /></p>
            ))}
          </div>
        )}

        <div className="pt-1 border-t border-rusty-green/10">
          <p className="text-xs text-rusty-green/60">
            Based on {data.chunk_count} textbook passages
          </p>
        </div>
      </div>
    </div>
  );
}

export function StudyMode({ subject, chapter: initialChapter, medium, onBack }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamStage, setStreamStage] = useState<StreamStage>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [chapter, setChapter] = useState<string | null>(initialChapter);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const classNum = user?.classNum ?? 8;
  const { getChapters } = useChapters(classNum);
  const chapters = getChapters(subject);
  const prevMediumRef = useRef(medium);

  useEffect(() => {
    if (prevMediumRef.current !== medium) {
      prevMediumRef.current = medium;
      setMessages([]);
      setMsgCount(0);
      setInput("");
    }
  }, [medium]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamStage]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function handleSummary() {
    if (loading || !user || !chapter) return;
    setLoading(true);
    setMessages(prev => [...prev, { kind: "user", text: `📋 Chapter Summary: ${chapter}` }]);
    try {
      const res = await studyApi.chapterSummary(subject, chapter, user.firebaseToken, medium);
      setMessages(prev => [...prev, { kind: "summary", data: res }]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setMessages(prev => [...prev, {
          kind: "error",
          text: "Summary not available for this chapter yet. Ask your admin to re-upload the textbook.",
        }]);
      } else {
        setMessages(prev => [...prev, { kind: "error", text: "Could not load summary. Try again." }]);
      }
    } finally {
      setLoading(false);
    }
  }

  const doSend = useCallback(async (query: string, retryCount = 0) => {
    if (!user) return;

    if (retryCount === 0) {
      setInput("");
      setMessages(prev => [...prev, { kind: "user", text: query }]);
    }

    setLoading(true);
    setStreamStage("embedding");

    const history: HistoryMessage[] = messages
      .slice(-10)
      .map(m => {
        if (m.kind === "user")  return { role: "user" as const,      content: m.text };
        if (m.kind === "rusty") {
          const text = m.data.notes || m.data.key_points?.join("; ") || "";
          return text ? { role: "assistant" as const, content: text } : null;
        }
        return null;
      })
      .filter(Boolean) as HistoryMessage[];

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let gotResult = false;
      await streamSSE(
        "/study/query/stream",
        { query, subject, chapter, history, medium },
        user.firebaseToken,
        (evt) => {
          const d = evt.data as Record<string, unknown>;
          if (evt.event === "stage") {
            setStreamStage((d.stage as StreamStage) ?? null);
          } else if (evt.event === "result") {
            gotResult = true;
            const data = d as unknown as StudyResponse;
            setMessages(prev => [...prev, { kind: "rusty", data, chapter }]);
            if (msgCount === 0) {
              addRecentStudy(user.studentId, { subject, chapter });
              setMsgCount(1);
            }
          } else if (evt.event === "error") {
            const msg = (d.message as string) || "Rusty hit a snag. Please try again.";
            if (retryCount < MAX_RETRIES) {
              setTimeout(() => doSend(query, retryCount + 1), RETRY_DELAYS[retryCount]);
              return;
            }
            setMessages(prev => [...prev, {
              kind: "error",
              text: msg,
              retryQuery: query,
            }]);
          }
        },
        ac.signal,
      );

      if (!gotResult && !ac.signal.aborted) {
        const lastMsg = messages[messages.length - 1];
        const alreadyErrored = lastMsg?.kind === "error";
        if (!alreadyErrored) {
          if (retryCount < MAX_RETRIES) {
            setTimeout(() => doSend(query, retryCount + 1), RETRY_DELAYS[retryCount]);
            return;
          }
          setMessages(prev => [...prev, {
            kind: "error",
            text: "Rusty couldn't respond. Check your connection and try again.",
            retryQuery: query,
          }]);
        }
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      if (err instanceof ApiError && err.status === 451) {
        setMessages(prev => [...prev, { kind: "error", text: err.message, isSafeguard: true }]);
      } else if (err instanceof ApiError && err.status === 503) {
        setMessages(prev => [...prev, {
          kind: "error",
          text: err.message || "Rusty is taking a short break. Please try again in a moment.",
          retryQuery: query,
        }]);
      } else {
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => doSend(query, retryCount + 1), RETRY_DELAYS[retryCount]);
          return;
        }
        setMessages(prev => [...prev, {
          kind: "error",
          text: "Rusty is thinking… try again in a moment.",
          retryQuery: query,
        }]);
      }
    } finally {
      setLoading(false);
      setStreamStage(null);
      inputRef.current?.focus();
    }
  }, [user, messages, subject, chapter, medium, msgCount]);

  function handleSend() {
    const query = input.trim();
    if (!query || loading || !user) return;
    doSend(query);
  }

  function handleRetry(query: string) {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.kind === "error") return prev.slice(0, -1);
      return prev;
    });
    doSend(query);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const subjectLabel = subject.replace("_", " ");

  return (
    <div className="flex flex-col min-h-screen bg-rusty-sand">
      <header className="bg-rusty-green text-white sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} aria-label="Back"
            className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white rounded
                       min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm capitalize leading-tight">{subjectLabel}</p>
            <button
              onClick={() => setShowChapterPicker(!showChapterPicker)}
              className="text-white/70 text-xs truncate flex items-center gap-1 hover:text-white transition-colors"
            >
              {chapter ?? "All chapters"} <span className="text-[10px]">{showChapterPicker ? "▲" : "▼"}</span>
            </button>
          </div>
          <span className="text-xs bg-rusty-ai/80 text-white rounded-full px-2.5 py-0.5 flex-shrink-0">Study</span>
        </div>

        {showChapterPicker && chapters.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-2 max-h-40 overflow-y-auto">
            <button
              onClick={() => { setChapter(null); setShowChapterPicker(false); }}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors min-h-[28px]
                ${chapter === null ? "bg-white text-rusty-green font-semibold" : "bg-white/20 text-white hover:bg-white/30"}`}
            >
              All chapters
            </button>
            {chapters.map((ch) => (
              <button
                key={ch}
                onClick={() => { setChapter(ch); setShowChapterPicker(false); }}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors min-h-[28px]
                  ${chapter === ch ? "bg-white text-rusty-green font-semibold" : "bg-white/20 text-white hover:bg-white/30"}`}
              >
                {ch}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-14">
            <div className="w-14 h-14 bg-rusty-ai-soft rounded-2xl mx-auto mb-3 flex items-center justify-center">
              <span className="text-rusty-ai text-2xl font-bold">R</span>
            </div>
            <p className="text-rusty-ink font-semibold">Ask Rusty anything about {subjectLabel}</p>
            <p className="text-rusty-muted text-sm mt-1">
              {chapter ? `Chapter: ${chapter}` : "Answers come from your Bihar Board textbook"}
            </p>
            <div className="mt-5 flex flex-col gap-2 text-left">
              {chapter && (
                <button onClick={handleSummary} disabled={loading}
                  className="text-left px-4 py-3 bg-rusty-green-soft border border-rusty-green/30 rounded-xl
                             text-sm text-rusty-green-dark hover:border-rusty-green transition-colors min-h-[48px]
                             font-semibold disabled:opacity-40">
                  📋 Get Chapter Summary
                </button>
              )}
              {[
                chapter ? `Explain the main concept in ${chapter}` : `What is the most important topic in ${subjectLabel}?`,
                chapter ? `Give me key points from ${chapter}` : `What are common mistakes in ${subjectLabel}?`,
              ].map((prompt, i) => (
                <button key={i} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="text-left px-4 py-3 bg-rusty-cream border border-rusty-border rounded-xl
                             text-sm text-rusty-ink hover:border-rusty-green transition-colors min-h-[48px]">
                  💬 {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.kind === "user") return (
            <div key={i} className="flex justify-end">
              <div className="bg-rusty-cream border border-rusty-border rounded-2xl rounded-tr-sm
                              px-4 py-3 max-w-[85%] text-rusty-ink text-sm leading-relaxed">
                {msg.text}
              </div>
            </div>
          );

          if (msg.kind === "rusty") return <RustyBubble key={i} msg={msg} chapter={chapter} />;
          if (msg.kind === "summary") return <SummaryBubble key={i} msg={msg} />;

          return (
            <div key={i} className="flex justify-start">
              <div className={`rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] text-sm
                ${msg.isSafeguard
                  ? "bg-rusty-warning-soft border border-rusty-warning/30 text-rusty-warning-dark"
                  : "bg-rusty-danger-soft border border-rusty-danger/30 text-rusty-danger-dark"}`}>
                {msg.isSafeguard && <p className="font-semibold mb-1">A moment, please</p>}
                {msg.text}
                {msg.retryQuery && !msg.isSafeguard && (
                  <button
                    onClick={() => handleRetry(msg.retryQuery!)}
                    className="mt-2 block text-xs font-semibold px-3 py-1.5 rounded-lg
                               bg-rusty-danger/10 hover:bg-rusty-danger/20 transition-colors min-h-[32px]"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <AILoader
            label={streamStage ? STAGE_LABELS[streamStage] || "Rusty is thinking..." : "Rusty is thinking..."}
            sublabel={streamStage === "retrieved" ? "Generating answer from textbook..." : "Searching Bihar Board textbooks..."}
          />
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 bg-rusty-sand/95 backdrop-blur border-t border-rusty-border px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            rows={1}
            maxLength={500}
            className="flex-1 resize-none px-3 py-3 border border-rusty-border rounded-xl text-rusty-ink
                       bg-rusty-cream placeholder:text-rusty-muted focus:outline-none focus:ring-2
                       focus:ring-rusty-green focus:border-rusty-green text-base max-h-32"
          />
          <button onClick={handleSend} disabled={!input.trim() || loading} aria-label="Send"
            className="w-12 h-12 bg-rusty-green text-white rounded-xl flex items-center justify-center
                       hover:bg-rusty-green-dark focus:outline-none focus:ring-2 focus:ring-rusty-green
                       focus:ring-offset-2 disabled:opacity-40 transition-colors flex-shrink-0">
            ↑
          </button>
        </div>
        <p className="text-[11px] text-rusty-muted text-right mt-1">{input.length}/500</p>
      </div>
    </div>
  );
}
