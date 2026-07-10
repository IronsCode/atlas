import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSEO } from '../useSEO.js'
import { Container, Section, Eyebrow, mutedText, subtleText, headingText, surfaceCard } from '../components/primitives.jsx'
import { Input, Textarea } from '../../components/ui/Input.jsx'
import { IconMail } from '../../components/ui/Icon.jsx'
import { IconPhone, IconMapPin, IconClock, IconMessage, IconBuilding, IconCheckCircle } from '../icons.jsx'

const TOPICS = [
  { value: 'sales', label: 'Sales', hint: 'Plans, schools & districts', reply: 'within 1 business day' },
  { value: 'support', label: 'Support', hint: 'Help with your account', reply: 'within a few hours on weekdays' },
  { value: 'general', label: 'General', hint: 'Anything else', reply: 'within 2 business days' },
  { value: 'demo', label: 'Book a demo', hint: 'See Elocin with your team', reply: 'within 1 business day' }
]

const CHANNELS = [
  { icon: IconMail, label: 'Email', value: 'hello@elocin.app', href: 'mailto:hello@elocin.app' },
  { icon: IconPhone, label: 'Phone', value: '+1 (555) 010-2400', href: 'tel:+15550102400' },
  { icon: IconBuilding, label: 'Office', value: '123 Learning Way, Suite 200' }
]

function Field({ label, children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className={`mb-1.5 block text-sm font-medium ${headingText}`}>{label}</span>
      {children}
    </label>
  )
}

export function ContactPage() {
  useSEO({
    title: 'Contact',
    path: '/contact',
    description: 'Get in touch with the Elocin team — sales, support, demos, or general questions. We respond fast.'
  })
  const [params] = useSearchParams()
  const initialTopic = TOPICS.some((t) => t.value === params.get('topic')) ? params.get('topic') : 'sales'
  const [topic, setTopic] = useState(initialTopic)
  const [sent, setSent] = useState(false)
  const activeTopic = TOPICS.find((t) => t.value === topic)

  function handleSubmit(e) {
    e.preventDefault()
    // Placeholder: no backend wired. Show a success confirmation.
    setSent(true)
  }

  return (
    <>
      <Section tone="bg" className="!pb-10">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="mb-3">Contact</Eyebrow>
            <h1 className={`text-balance text-4xl font-semibold tracking-tight sm:text-5xl ${headingText}`}>
              Let’s talk
            </h1>
            <p className={`mt-5 text-lg leading-relaxed ${mutedText}`}>
              Whether you’re a single teacher or a whole district, we’d love to help. Pick a topic and
              we’ll get back to you {activeTopic.reply}.
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="surface" className="!pt-4">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            {/* Form */}
            <div className={`${surfaceCard} p-7 sm:p-8`}>
              {sent ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-sageLight text-3xl text-sage dark:bg-night3">
                    <IconCheckCircle />
                  </span>
                  <h2 className={`text-xl font-semibold ${headingText}`}>Thanks — we’ve got it</h2>
                  <p className={`mt-2 max-w-sm text-sm ${mutedText}`}>
                    Your message is on its way to our team. We’ll reply {activeTopic.reply}.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-6 text-sm font-semibold text-sage hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <fieldset>
                    <legend className={`mb-2 text-sm font-medium ${headingText}`}>What can we help with?</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TOPICS.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setTopic(t.value)}
                          aria-pressed={topic === t.value}
                          className={`rounded-sm border px-3 py-2 text-center text-sm font-medium transition-colors ${
                            topic === t.value
                              ? 'border-sage bg-sageLight text-sage dark:bg-night3'
                              : 'border-border text-ink2 hover:bg-surface2 dark:border-nightBorder dark:text-ink4 dark:hover:bg-night3'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <p className={`mt-2 text-xs ${subtleText}`}>{activeTopic.hint} · Typical reply {activeTopic.reply}.</p>
                  </fieldset>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full name" htmlFor="name">
                      <Input id="name" name="name" required autoComplete="name" placeholder="Jane Doe" />
                    </Field>
                    <Field label="Work email" htmlFor="email">
                      <Input id="email" name="email" type="email" required autoComplete="email" placeholder="jane@school.edu" />
                    </Field>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Organization" htmlFor="org">
                      <Input id="org" name="org" placeholder="Sunrise Learning Center" />
                    </Field>
                    <Field label="Role" htmlFor="role">
                      <Input id="role" name="role" placeholder="Teacher, Director, Admin…" />
                    </Field>
                  </div>
                  <Field label="How can we help?" htmlFor="message">
                    <Textarea id="message" name="message" required rows={4} placeholder="Tell us a little about your classroom or organization…" />
                  </Field>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-sage px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sage/90 sm:w-auto"
                  >
                    Send message
                  </button>
                  <p className={`text-xs ${subtleText}`}>
                    By submitting, you agree to our <Link to="/privacy" className="underline hover:text-sage">Privacy Policy</Link>.
                  </p>
                </form>
              )}
            </div>

            {/* Sidebar: channels, hours, map, faq links */}
            <div className="space-y-6">
              <div className={`${surfaceCard} p-6`}>
                <h2 className={`text-sm font-semibold uppercase tracking-wide ${subtleText}`}>Reach us directly</h2>
                <ul className="mt-4 space-y-4">
                  {CHANNELS.map((c) => (
                    <li key={c.label} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-sageLight text-[1.1rem] text-sage dark:bg-night3">
                        <c.icon />
                      </span>
                      <div>
                        <div className={`text-xs ${subtleText}`}>{c.label}</div>
                        {c.href ? (
                          <a href={c.href} className={`text-sm font-medium hover:text-sage ${headingText}`}>{c.value}</a>
                        ) : (
                          <div className={`text-sm font-medium ${headingText}`}>{c.value}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${surfaceCard} p-6`}>
                <div className="flex items-center gap-2">
                  <span className="text-[1.1rem] text-sage"><IconClock /></span>
                  <h2 className={`text-sm font-semibold ${headingText}`}>Business hours</h2>
                </div>
                <dl className={`mt-3 space-y-1.5 text-sm ${mutedText}`}>
                  <div className="flex justify-between"><dt>Mon–Fri</dt><dd>8:00 AM – 6:00 PM ET</dd></div>
                  <div className="flex justify-between"><dt>Saturday</dt><dd>10:00 AM – 2:00 PM ET</dd></div>
                  <div className="flex justify-between"><dt>Sunday</dt><dd>Closed</dd></div>
                </dl>
              </div>

              {/* Map placeholder */}
              <div className={`overflow-hidden ${surfaceCard}`}>
                <div className="relative flex h-40 items-center justify-center bg-sageLight dark:bg-night3" role="img" aria-label="Map showing Elocin's office location">
                  <div aria-hidden="true" className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(0deg,transparent,transparent_22px,rgba(74,124,89,0.25)_23px),repeating-linear-gradient(90deg,transparent,transparent_22px,rgba(74,124,89,0.25)_23px)]" />
                  <span className="relative flex items-center gap-2 rounded-sm bg-surface px-3 py-1.5 text-sm font-medium text-sage shadow-sm dark:bg-night2">
                    <IconMapPin /> Elocin HQ
                  </span>
                </div>
              </div>

              <div className={`${surfaceCard} p-6`}>
                <div className="flex items-center gap-2">
                  <span className="text-[1.1rem] text-sage"><IconMessage /></span>
                  <h2 className={`text-sm font-semibold ${headingText}`}>Quick answers</h2>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><Link to="/pricing" className="text-sage hover:underline">Pricing &amp; plans</Link></li>
                  <li><Link to="/security" className="text-sage hover:underline">Security &amp; data privacy</Link></li>
                  <li><Link to="/features" className="text-sage hover:underline">What Elocin does</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
