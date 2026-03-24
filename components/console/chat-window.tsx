"use client";

import { useChat, Message, ChatProvider } from "./chat-context";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon, BotIcon, ChevronDownIcon, ZapIcon } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming: boolean }) {
  const isUser = msg.role === "user";
  const isEmpty = msg.content === "" && !isUser;

  return (
    <div
      className={`flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Bot avatar */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center mb-5">
          <BotIcon className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[72%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
            isUser
              ? "bg-indigo-600 text-white rounded-2xl rounded-br-sm"
              : "bg-card border border-border text-foreground rounded-2xl rounded-bl-sm"
          }`}
        >
          {isEmpty && isStreaming ? <TypingDots /> : msg.content}
        </div>
        <span className="text-[11px] text-muted-foreground px-1">
          {formatTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ── Message feed ──────────────────────────────────────────────────────────────

function ChatMessages() {
  const { messages, isStreaming } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll when new messages arrive (only if near bottom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show/hide scroll-to-bottom button
  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 150);
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-6 space-y-4 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-indigo-600/10 flex items-center justify-center">
              <ZapIcon className="w-6 h-6 text-indigo-500" />
            </div>
            <p className="text-sm font-medium">Ask anything — your AI assistant is ready.</p>
            <p className="text-xs opacity-60">It can read your emails, check your calendar, and manage your bookings.</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isStreaming={isStreaming} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border shadow-md text-xs text-muted-foreground hover:text-foreground hover:shadow-lg transition-all animate-in fade-in duration-150"
        >
          <ChevronDownIcon className="w-3.5 h-3.5" />
          Scroll to bottom
        </button>
      )}
    </div>
  );
}

// ── Input bar ─────────────────────────────────────────────────────────────────

function ChatInput() {
  const { sendMessage, isStreaming } = useChat();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`; // ~4 lines
  }, [input]);

  function submit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const isEmpty = !input.trim();

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message…"
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 disabled:opacity-50 transition-all overflow-y-auto"
          style={{ minHeight: "42px", maxHeight: "112px" }}
          autoFocus
        />
        <Button
          type="button"
          onClick={submit}
          disabled={isEmpty || isStreaming}
          size="icon"
          className={`shrink-0 w-10 h-10 rounded-xl transition-all ${
            isEmpty || isStreaming
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          }`}
        >
          <SendIcon className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function ChatHeader() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm">
          <BotIcon className="w-5 h-5 text-white" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">ExecOS Assistant</p>
        <p className="text-xs text-emerald-500 mt-0.5">Online</p>
      </div>
    </div>
  );
}

// ── History loader ────────────────────────────────────────────────────────────

function ChatHistoryLoader({ history }: { history: Message[] }) {
  const { setInitialMessages } = useChat();
  useEffect(() => {
    setInitialMessages(history);
  }, [history, setInitialMessages]);
  return null;
}

// ── Root export ───────────────────────────────────────────────────────────────

export function ChatWindow({ history }: { history: Message[] }) {
  return (
    <ChatProvider>
      <ChatHistoryLoader history={history} />
      <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden shadow-sm border border-border">
        <ChatHeader />
        <ChatMessages />
        <ChatInput />
      </div>
    </ChatProvider>
  );
}
