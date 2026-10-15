import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  MessageCircle,
  Minus,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { contact } from "@/lib/site-data";
import { supabase } from "@/lib/supabase";
import { answerVisitorQuestion, type PublicArticle } from "@/lib/visitor-guide";
import "./VisitorChat.css";

type ChatMessage = {
  id: number;
  sender: "guide" | "visitor";
  text: string;
  href?: string | undefined;
  linkLabel?: string | undefined;
};
const greeting =
  "Hi! 👋 Welcome to Super Plus Fitness & Spa. I’m your digital assistant. Ask me about joining, prices, personal training, spa bookings or visiting the gym.";
const suggestions = [
  "Membership prices",
  "Book a spa service",
  "Opening hours",
  "PT Only add-on",
  "Find the gym",
  "HMO partners",
];

/** CSS frames the original cartoon at the waist, preserving the supplied artwork. */
function AssistantAvatar({ className = "" }: { className?: string }) {
  return (
    <span className={`spf-assistant-avatar ${className}`} aria-hidden="true">
      <img
        src="/spf-digital-assistant.webp"
        alt=""
        width={768}
        height={768}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

export function VisitorChat() {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, sender: "guide", text: greeting },
  ]);
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const nextId = useRef(1);
  const articleLoaded = useRef(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const minimise = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || articleLoaded.current) return;
    let mounted = true;
    // Fetch only public summaries on demand. The guide works even if this request fails.
    void supabase
      .from("blog_posts")
      .select("title,slug,excerpt,category,published_at")
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(80)
      .then(
        ({ data, error }) => {
          if (mounted && !error) {
            setArticles((data || []) as PublicArticle[]);
            articleLoaded.current = true;
          }
        },
        () => {
          /* Public answers remain available offline. */
        },
      );
    return () => {
      mounted = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = panel.current;
    const returnFocus = launcher.current;
    if (!dialog) return;
    dialog.showModal();
    minimise.current?.focus({ preventScroll: true });
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep the composer above the iOS/Android keyboard and browser safe areas.
    const viewport = window.visualViewport;
    const fitViewport = () => {
      dialog.style.setProperty(
        "--spf-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog.style.setProperty("--spf-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      document.body.style.overflow = originalOverflow;
      dialog.close();
      returnFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (open && log.current)
      log.current.scrollTop = messages.length === 1 ? 0 : log.current.scrollHeight;
  }, [messages, open]);

  function closeChat() {
    setOpen(false);
  }
  function resetChat() {
    setMessages([{ id: nextId.current++, sender: "guide", text: greeting }]);
    setPreviousId(null);
    setDraft("");
  }
  function ask(raw: string) {
    const question = raw.trim().slice(0, 300);
    if (!question) return;
    const reply = answerVisitorQuestion(question, previousId, articles);
    setMessages((current) =>
      [
        ...current,
        { id: nextId.current++, sender: "visitor" as const, text: question },
        {
          id: nextId.current++,
          sender: "guide" as const,
          text: reply.text,
          href: reply.href,
          linkLabel: reply.linkLabel,
        },
      ].slice(-32),
    );
    if (reply.confident && !["hello", "thanks", "welcome"].includes(reply.id))
      setPreviousId(reply.id);
    setDraft("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(draft);
  }

  return (
    <>
      {
        <aside
          className="spf-assistant-launch"
          aria-label="Super Plus digital assistant"
          style={{ display: open ? "none" : undefined }}
        >
          {hint && (
            <div className="spf-assistant-invite">
              <button
                type="button"
                className="spf-assistant-invite-close"
                aria-label="Dismiss assistant greeting"
                onClick={() => setHint(false)}
              >
                <X size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setHint(false);
                }}
              >
                <strong>Hi, how can I help?</strong>
                <span>
                  Ask Super Plus <ChevronRight size={13} />
                </span>
              </button>
            </div>
          )}
          <button
            ref={launcher}
            type="button"
            onClick={() => {
              setOpen(true);
              setHint(false);
            }}
            aria-label="Open Super Plus digital assistant"
            aria-expanded={open}
            aria-controls="super-plus-chat-panel"
            className="spf-assistant-launch-button"
          >
            <AssistantAvatar />
            <span className="spf-assistant-launch-badge">
              <MessageCircle size={13} />
            </span>
          </button>
        </aside>
      }
      {open && (
        <dialog
          ref={panel}
          id="super-plus-chat-panel"
          aria-labelledby="visitor-chat-title"
          aria-describedby="visitor-chat-description"
          className="spf-assistant-panel"
          onCancel={(event) => {
            event.preventDefault();
            closeChat();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const r = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < r.left ||
                event.clientX > r.right ||
                event.clientY < r.top ||
                event.clientY > r.bottom
              )
                closeChat();
            }
          }}
        >
          <div className="spf-assistant-layout">
            <header
              className={`spf-assistant-header ${messages.length > 1 ? "spf-assistant-header-compact" : ""}`}
            >
              <div className="spf-assistant-toolbar">
                <span>SUPER PLUS FITNESS & SPA</span>
                <div>
                  <button
                    type="button"
                    aria-label="Start a new chat"
                    title="Start a new chat"
                    onClick={resetChat}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    ref={minimise}
                    type="button"
                    aria-label="Minimise digital assistant"
                    title="Minimise"
                    onClick={closeChat}
                  >
                    <Minus size={21} />
                  </button>
                </div>
              </div>
              <div className="spf-assistant-identity">
                <div className="spf-assistant-portrait">
                  <AssistantAvatar />
                  <span className="spf-assistant-status-dot" />
                </div>
                <div>
                  <p>Hello, I’m your</p>
                  <h2 id="visitor-chat-title">SPF Digital Assistant</h2>
                  <p className="spf-assistant-ready">Instant answers, whenever you need</p>
                </div>
              </div>
            </header>
            <p id="visitor-chat-description" className="spf-assistant-description">
              <ShieldCheck size={13} /> Public gym information · Keep account and card details
              private.
            </p>
            <div
              ref={log}
              role="log"
              aria-label="Conversation with SPF assistant"
              aria-live="polite"
              aria-relevant="additions"
              className="spf-assistant-log"
            >
              <div className="spf-assistant-date">WELCOME TO SUPER PLUS</div>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`spf-assistant-message spf-assistant-message-${message.sender}`}
                >
                  {message.sender === "guide" && (
                    <AssistantAvatar className="spf-assistant-message-avatar" />
                  )}
                  <div className="spf-assistant-bubble">
                    <p>{message.text}</p>
                    {message.href && (
                      <a href={message.href} className="spf-assistant-action">
                        {message.linkLabel || "View page"}
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {messages.length === 1 && (
                <div className="spf-assistant-suggestions">
                  <p>A good place to start</p>
                  <div>
                    {suggestions.map((question) => (
                      <button key={question} type="button" onClick={() => ask(question)}>
                        {question}
                        <ChevronRight size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.length > 1 && (
                <div className="spf-assistant-followups">
                  {["Membership prices", "Book a spa service", "Contact reception"].map(
                    (question) => (
                      <button key={question} type="button" onClick={() => ask(question)}>
                        {question}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
            <footer className="spf-assistant-footer">
              <form onSubmit={submit} className="spf-assistant-composer">
                <input
                  aria-label="Your question about Super Plus Fitness"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={300}
                  placeholder="Type your message…"
                  autoComplete="off"
                  enterKeyHint="send"
                />
                <button type="submit" aria-label="Send question" disabled={!draft.trim()}>
                  <Send size={18} />
                </button>
              </form>
              <p>
                Need a person?{" "}
                <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">
                  WhatsApp reception <ArrowUpRight size={11} />
                </a>
              </p>
              <span className="spf-assistant-credit">Super Plus · Fitness that fits your life</span>
            </footer>
          </div>
        </dialog>
      )}
    </>
  );
}
