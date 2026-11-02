"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { LANGUAGES, LLM_MODELS, PERSONALITIES, STT_PROVIDERS, TTS_PROVIDERS, VOICES } from "@/lib/agent-options";
import type { AgentFormState } from "./actions";

export type AgentValues = {
  name: string; status: "ACTIVE" | "PAUSED"; mode: "ASSISTANT" | "ANNOUNCEMENT"; purpose: "OUTBOUND" | "INBOUND" | "BOTH";
  phoneNumberId: string; greeting: string; systemPrompt: string; fallbackResponse: string; noResponseTimeoutSec: number;
  noResponseClosing: string; announcementScript: string; endAfterAnnouncement: boolean; knowledgeText: string;
  personality: string; language: string; voiceGender: "female" | "male"; voiceId: string; llmModel: string;
  sttProvider: string; ttsProvider: string; memoryEnabled: boolean; recordingEnabled: boolean; maxConcurrentCalls: number;
  faqs: { question: string; answer: string }[]; catalogIds: string[];
};

type Option = { id: string; label: string; hint?: string };

const STEPS = ["Identity", "What to say", "What to sell", "Knowledge", "Voice & language", "Advanced"] as const;

export function AgentForm({ action, initial, phoneNumbers, catalog, canEdit }: {
  action: (prev: AgentFormState, form: FormData) => Promise<AgentFormState>;
  initial: AgentValues;
  phoneNumbers: Option[];
  catalog: Option[];
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(initial.mode);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [gender, setGender] = useState(initial.voiceGender);
  const [voice, setVoice] = useState(initial.voiceId);
  const [faqs, setFaqs] = useState(initial.faqs);

  const pickGender = (g: "female" | "male") => { setGender(g); setVoice(VOICES[g][0]); };

  return (
    // Submit via onSubmit (not `action=`) so React doesn't reset the form when validation fails.
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <nav className="flex flex-wrap gap-2" aria-label="Agent setup steps">
        {STEPS.map((s, i) => (
          <button key={s} type="button" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${step === i ? "bg-brand text-white" : "bg-white text-muted border border-line hover:text-ink"}`}>
            {i + 1} {s}
          </button>
        ))}
      </nav>

      {state?.error && <p role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{state.error}</p>}

      <fieldset disabled={!canEdit} className="card space-y-5 p-6">
        {/* 1 Identity */}
        <Panel show={step === 0}>
          <Field label="Agent name" htmlFor="name">
            <input id="name" name="name" defaultValue={initial.name} placeholder="e.g. Priya – Sales" className="input" maxLength={120} />
          </Field>
          <Field label="Agent mode">
            <Seg name="mode" value={mode} onChange={(v) => setMode(v as typeof mode)}
              options={[["ASSISTANT", "Assistant (two-way conversation)"], ["ANNOUNCEMENT", "Announcement (plays a message)"]]} />
          </Field>
          <Field label="Call purpose">
            <Seg name="purpose" value={purpose} onChange={(v) => setPurpose(v as typeof purpose)}
              options={[["OUTBOUND", "Outbound"], ["INBOUND", "Inbound"], ["BOTH", "Both"]]} />
            <p className="text-xs text-muted">
              {purpose === "OUTBOUND" && "Calls leads and runs campaigns. Does not answer incoming calls."}
              {purpose === "INBOUND" && "Answers calls to its phone number. Can't run campaigns."}
              {purpose === "BOTH" && "Runs campaigns and answers calls to its phone number."}
            </p>
          </Field>
          <Field label="Phone number" htmlFor="phoneNumberId">
            <select id="phoneNumberId" name="phoneNumberId" defaultValue={initial.phoneNumberId} className="input">
              <option value="">No number yet (browser testing only)</option>
              {phoneNumbers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <Seg name="status" value={initial.status} options={[["ACTIVE", "Active"], ["PAUSED", "Paused"]]} />
          </Field>
        </Panel>

        {/* 2 What to say */}
        <Panel show={step === 1}>
          {mode === "ASSISTANT" ? (
            <>
              <Field label="Greeting" htmlFor="greeting" hint="First thing the agent says. Use {name} and other lead columns as placeholders.">
                <textarea id="greeting" name="greeting" defaultValue={initial.greeting} rows={3} className="input" placeholder="Namaste {name}, main Priya bol rahi hoon Brightlane Software se…" />
              </Field>
              <Field label="Instructions (system prompt)" htmlFor="systemPrompt" hint="Who the agent is, what it should find out, and what it must never say.">
                <textarea id="systemPrompt" name="systemPrompt" defaultValue={initial.systemPrompt} rows={8} className="input" placeholder="You are Priya, a friendly sales assistant for Brightlane Software…" />
              </Field>
            </>
          ) : (
            <>
              <input type="hidden" name="greeting" value={initial.greeting} />
              <input type="hidden" name="systemPrompt" value={initial.systemPrompt} />
              <Field label="Message to play" htmlFor="announcementScript" hint="Read out word for word. Placeholders like {name} work here too.">
                <textarea id="announcementScript" name="announcementScript" defaultValue={initial.announcementScript} rows={6} className="input" />
              </Field>
              <Check name="endAfterAnnouncement" label="Hang up when the message finishes" defaultChecked={initial.endAfterAnnouncement} />
            </>
          )}
          {mode === "ASSISTANT" && <input type="hidden" name="announcementScript" value={initial.announcementScript} />}
          {mode === "ASSISTANT" && initial.endAfterAnnouncement && <input type="hidden" name="endAfterAnnouncement" value="on" />}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="If something goes wrong, say" htmlFor="fallbackResponse">
              <textarea id="fallbackResponse" name="fallbackResponse" defaultValue={initial.fallbackResponse} rows={2} className="input" placeholder="Sorry, there's a temporary problem. Please try again shortly." />
            </Field>
            <Field label="If the caller goes silent, say (then hang up)" htmlFor="noResponseClosing">
              <textarea id="noResponseClosing" name="noResponseClosing" defaultValue={initial.noResponseClosing} rows={2} className="input" placeholder="I didn't hear a response, so I'll end the call now. Thank you." />
            </Field>
          </div>
          <Field label="Silence before hanging up (seconds)" htmlFor="noResponseTimeoutSec">
            <input id="noResponseTimeoutSec" name="noResponseTimeoutSec" type="number" min={5} max={120} defaultValue={initial.noResponseTimeoutSec} className="input max-w-32" />
          </Field>
        </Panel>

        {/* 3 What to sell */}
        <Panel show={step === 2}>
          <p className="text-sm text-muted">The agent only offers the items ticked here, using each item&apos;s price rule and next step.</p>
          {catalog.length === 0 ? (
            <p className="rounded-lg bg-paper px-4 py-3 text-sm">You haven&apos;t added any services or products yet. Add them under <b>Services &amp; Products</b>, then come back to tick them here.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {catalog.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-paper">
                    <input type="checkbox" name="catalog" value={c.id} defaultChecked={initial.catalogIds.includes(c.id)} className="mt-1" />
                    <span><b className="text-sm">{c.label}</b>{c.hint && <span className="block text-xs text-muted">{c.hint}</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 4 Knowledge */}
        <Panel show={step === 3}>
          <Field label="Company facts and notes" htmlFor="knowledgeText" hint="Anything the agent may need: timings, address, policies, offers.">
            <textarea id="knowledgeText" name="knowledgeText" defaultValue={initial.knowledgeText} rows={6} className="input" />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="label">Frequently asked questions ({faqs.length})</p>
              <button type="button" className="btn" onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}>+ Add question</button>
            </div>
            {faqs.length === 0 && <p className="text-sm text-muted">No FAQs yet.</p>}
            <ol className="space-y-2">
              {faqs.map((f, i) => (
                <li key={i} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_2fr_auto]">
                  <input name="faqQ" aria-label={`Question ${i + 1}`} placeholder="Question" className="input" defaultValue={f.question} />
                  <input name="faqA" aria-label={`Answer ${i + 1}`} placeholder="Answer" className="input" defaultValue={f.answer} />
                  <button type="button" className="btn-danger" aria-label={`Remove question ${i + 1}`}
                    onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}>Remove</button>
                </li>
              ))}
            </ol>
          </div>
        </Panel>

        {/* 5 Voice & language */}
        <Panel show={step === 4}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Language" htmlFor="language">
              <select id="language" name="language" defaultValue={initial.language} className="input">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Personality" htmlFor="personality">
              <select id="personality" name="personality" defaultValue={initial.personality} className="input">
                {PERSONALITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Voice gender">
              <Seg name="voiceGender" value={gender} onChange={(v) => pickGender(v as "female" | "male")} options={[["female", "Female"], ["male", "Male"]]} />
            </Field>
            <Field label="Voice" htmlFor="voiceId">
              <select id="voiceId" name="voiceId" value={voice} onChange={(e) => setVoice(e.target.value)} className="input">
                {VOICES[gender].map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Check name="memoryEnabled" label="Remember each caller between calls" defaultChecked={initial.memoryEnabled} />
            <Check name="recordingEnabled" label="Record calls" defaultChecked={initial.recordingEnabled} />
          </div>
        </Panel>

        {/* 6 Advanced */}
        <Panel show={step === 5}>
          <p className="text-sm text-muted">Most businesses can leave these as they are.</p>
          <Field label="AI brain" htmlFor="llmModel">
            <select id="llmModel" name="llmModel" defaultValue={initial.llmModel} className="input">
              {LLM_MODELS.map((m) => <option key={m.model} value={m.model}>{m.label}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Speech to text" htmlFor="sttProvider">
              <select id="sttProvider" name="sttProvider" defaultValue={initial.sttProvider} className="input">
                {STT_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Voice engine" htmlFor="ttsProvider">
              <select id="ttsProvider" name="ttsProvider" defaultValue={initial.ttsProvider} className="input">
                {TTS_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Max calls at the same time" htmlFor="maxConcurrentCalls">
              <input id="maxConcurrentCalls" name="maxConcurrentCalls" type="number" min={1} max={20} defaultValue={initial.maxConcurrentCalls} className="input" />
            </Field>
          </div>
        </Panel>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>← Back</button>}
          {step < STEPS.length - 1 && <button type="button" className="btn" onClick={() => setStep(step + 1)}>Next →</button>}
        </div>
        <div className="flex gap-2">
          <Link href="/agents" className="btn">Cancel</Link>
          {canEdit && <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save agent"}</button>}
        </div>
      </div>
    </form>
  );
}

function Panel({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <div className={show ? "space-y-5" : "hidden"}>{children}</div>;
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {htmlFor ? <label htmlFor={htmlFor} className="label block">{label}</label> : <p className="label">{label}</p>}
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Seg({ name, value, options, onChange }: { name: string; value: string; options: [string, string][]; onChange?: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-paper p-1" role="radiogroup">
      {options.map(([val, label]) => (
        <label key={val} className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold ${v === val ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
          <input type="radio" name={name} value={val} checked={v === val} className="sr-only"
            onChange={() => { setV(val); onChange?.(val); }} />
          {label}
        </label>
      ))}
    </div>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-brand" /> {label}
    </label>
  );
}
