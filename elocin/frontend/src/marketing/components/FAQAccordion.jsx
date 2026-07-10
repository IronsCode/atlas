import { useState, useId } from 'react'
import { IconChevronDown } from '../icons.jsx'
import { mutedText, headingText } from './primitives.jsx'

function FAQItem({ q, a, open, onToggle }) {
  const id = useId()
  return (
    <div className="border-b border-border last:border-0 dark:border-nightBorder">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-btn`}
          className="flex w-full items-center justify-between gap-4 py-5 text-left"
        >
          <span className={`text-base font-medium ${headingText}`}>{q}</span>
          <span
            className={`flex-shrink-0 text-[1.2rem] text-ink3 transition-transform duration-200 dark:text-ink4 ${
              open ? 'rotate-180' : ''
            }`}
          >
            <IconChevronDown />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-btn`}
        hidden={!open}
        className="pb-5 pr-8"
      >
        <p className={`text-sm leading-relaxed ${mutedText}`}>{a}</p>
      </div>
    </div>
  )
}

/** Single-open accessible accordion. `items`: [{ q, a }]. */
export function FAQAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0)
  return (
    <div className="mx-auto max-w-3xl">
      {items.map((item, i) => (
        <FAQItem
          key={i}
          q={item.q}
          a={item.a}
          open={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
        />
      ))}
    </div>
  )
}
