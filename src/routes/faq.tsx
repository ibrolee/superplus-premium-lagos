import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  Dumbbell,
  HelpCircle,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SuperPortrait } from "@/components/assistant/SuperCompanion";
import { contact } from "@/lib/site-data";
import { faqCategories, faqItems, filterFaqs, type FaqCategory } from "@/lib/faq";
import { pageHead } from "@/lib/seo";
import "./faq.css";

export const Route = createFileRoute("/faq")({
  head: () =>
    pageHead(
      "Frequently Asked Questions — Super Plus Fitness & Spa",
      "Clear answers about Super Plus memberships, registration, personal training, spa bookings, payments and visiting our Shomolu gym.",
      "/faq",
    ),
  component: FaqPage,
});
const categoryIcons = {
  "getting-started": UserRound,
  membership: CreditCard,
  training: Dumbbell,
  spa: Sparkles,
  payments: ShieldCheck,
  support: LifeBuoy,
};
const popular = [
  { label: "Registration fees", query: "registration fee" },
  { label: "PT Only", query: "pt only" },
  { label: "Spa bookings", query: "spa" },
];

function FaqPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FaqCategory | "all">("all");
  const [openQuestion, setOpenQuestion] = useState("");
  const matching = filterFaqs(query, category);
  const hasFilters = Boolean(query.trim()) || category !== "all";
  const groups = faqCategories
    .map((group) => ({
      ...group,
      questions: matching.filter((question) => question.category === group.id),
    }))
    .filter((group) => group.questions.length > 0);
  function chooseCategory(value: FaqCategory | "all") {
    setCategory(value);
    setQuery("");
    setOpenQuestion("");
  }
  function search(value: string) {
    setQuery(value);
    setCategory("all");
    setOpenQuestion("");
  }
  function reset() {
    setQuery("");
    setCategory("all");
    setOpenQuestion("");
  }

  return (
    <main className="spf-faq-page">
      <section className="spf-faq-hero" aria-labelledby="faq-title">
        <div className="spf-faq-shell spf-faq-hero-grid">
          <div>
            <p className="spf-faq-eyebrow">
              <span /> A LITTLE CLARITY. A LOT MORE CONFIDENCE.
            </p>
            <h1 id="faq-title">
              Good questions.
              <br />
              <span>Clear answers.</span>
            </h1>
            <p className="spf-faq-intro">
              Everything you need to feel at home at Super Plus.
              <br className="hidden sm:block" /> Memberships, training, recovery and the details in
              between.
            </p>
            <div className="spf-faq-search">
              <Search size={20} aria-hidden="true" />
              <label className="sr-only" htmlFor="faq-search">
                Search frequently asked questions
              </label>
              <input
                id="faq-search"
                type="search"
                value={query}
                maxLength={150}
                onChange={(event) => search(event.target.value)}
                placeholder="Try registration, massage or family…"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={() => search("")} aria-label="Clear FAQ search">
                  <X size={17} />
                </button>
              )}
              <span className="spf-faq-search-hint">{faqItems.length} answers</span>
            </div>
            <div className="spf-faq-popular">
              <span>Popular:</span>
              {popular.map((item) => (
                <button key={item.label} type="button" onClick={() => search(item.query)}>
                  {item.label}
                  <ArrowUpRight size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <aside className="spf-faq-super" aria-label="A little help from Super">
            <div className="spf-faq-super-top">
              <span>YOUR SPF COMPANION</span>
              <HelpCircle size={18} aria-hidden="true" />
            </div>
            <div className="spf-faq-super-identity">
              <SuperPortrait size={76} />
              <div>
                <p>Hi, I’m Super.</p>
                <h2>
                  Let’s make
                  <br />
                  this simple.
                </h2>
              </div>
            </div>
            <p className="spf-faq-super-copy">
              Start with a topic below. If your question needs a personal answer, reception is one
              tap away.
            </p>
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="spf-faq-super-link"
            >
              Chat with reception
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </aside>
        </div>
        <div className="spf-faq-shell spf-faq-hero-bottom">
          <span>
            <Check size={14} aria-hidden="true" /> Straightforward answers
          </span>
          <span>
            <MapPin size={14} aria-hidden="true" /> Shomolu, Lagos
          </span>
          <a href="#faq-answers">
            Find your answer
            <ArrowDown size={14} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section
        id="faq-answers"
        className="spf-faq-shell spf-faq-content"
        aria-label="Frequently asked questions"
      >
        <aside className="spf-faq-sidebar">
          <p className="spf-faq-topic-label">FIND YOUR TOPIC</p>
          <nav aria-label="FAQ categories">
            <button
              type="button"
              aria-pressed={category === "all"}
              onClick={() => chooseCategory("all")}
            >
              <HelpCircle size={17} aria-hidden="true" />
              <span>All questions</span>
              <small>{faqItems.length}</small>
            </button>
            {faqCategories.map((group) => {
              const Icon = categoryIcons[group.id];
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={category === group.id}
                  onClick={() => chooseCategory(group.id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{group.name}</span>
                  <small>
                    {faqItems.filter((question) => question.category === group.id).length}
                  </small>
                </button>
              );
            })}
          </nav>
          <div className="spf-faq-sidebar-note">
            <MessageCircle size={21} aria-hidden="true" />
            <p>A question about your own payment or account?</p>
            <a href="/contact">
              Talk to the team
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        </aside>
        <div className="spf-faq-main">
          <div className="spf-faq-mobile-topics">
            <label htmlFor="faq-category">Browse a topic</label>
            <select
              id="faq-category"
              value={category}
              onChange={(event) => chooseCategory(event.target.value as FaqCategory | "all")}
            >
              <option value="all">All questions ({faqItems.length})</option>
              {faqCategories.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="spf-faq-results">
            <p role="status" aria-live="polite" aria-atomic="true">
              {query.trim()
                ? `${matching.length} ${matching.length === 1 ? "answer" : "answers"} for “${query.trim()}”`
                : category === "all"
                  ? "A good place to start"
                  : faqCategories.find((group) => group.id === category)?.name}
            </p>
            {hasFilters && (
              <button type="button" onClick={reset}>
                Show all questions
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          {groups.length ? (
            <Accordion
              type="single"
              collapsible
              value={openQuestion}
              onValueChange={setOpenQuestion}
            >
              {groups.map((group) => {
                const Icon = categoryIcons[group.id];
                return (
                  <section
                    key={group.id}
                    className="spf-faq-group"
                    aria-labelledby={`faq-group-${group.id}`}
                  >
                    <div className="spf-faq-group-heading">
                      <span>
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <div>
                        <h2 id={`faq-group-${group.id}`}>{group.name}</h2>
                        <p>{group.description}</p>
                      </div>
                    </div>
                    <div className="spf-faq-question-list">
                      {group.questions.map((question) => (
                        <AccordionItem
                          key={question.id}
                          value={question.id}
                          className="spf-faq-question"
                        >
                          <AccordionTrigger className="spf-faq-question-trigger">
                            {question.question}
                          </AccordionTrigger>
                          <AccordionContent className="spf-faq-answer">
                            <p>{question.answer}</p>
                            <a href={question.href}>
                              {question.action}
                              <ArrowUpRight size={15} aria-hidden="true" />
                            </a>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </div>
                  </section>
                );
              })}
            </Accordion>
          ) : (
            <div className="spf-faq-no-results">
              <Search size={30} aria-hidden="true" />
              <h2>No match just yet.</h2>
              <p>
                Try a shorter search such as “registration”, “PT” or “massage”. Reception can help
                with anything more specific.
              </p>
              <button type="button" onClick={reset}>
                Browse all questions
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="spf-faq-shell spf-faq-help" aria-labelledby="faq-help-title">
        <div className="spf-faq-help-icon">
          <MessageCircle size={27} aria-hidden="true" />
        </div>
        <div>
          <p className="spf-faq-eyebrow">STILL HAVE A QUESTION?</p>
          <h2 id="faq-help-title">We’re here to help.</h2>
          <p>For your own account, booking or payment, speak directly with reception.</p>
        </div>
        <div className="spf-faq-help-actions">
          <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">
            WhatsApp reception
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <a href={`tel:${contact.phoneHref}`}>Call {contact.phone}</a>
        </div>
      </section>
    </main>
  );
}
