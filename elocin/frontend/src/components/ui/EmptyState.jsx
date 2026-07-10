import { Card } from './Card.jsx'

// Instructional empty state: an icon, a title, a one-line "why/value", and a
// primary action. Replaces terse "No X yet." lines so every empty screen
// tells the user what the feature is for and what to do next.
export function EmptyState({ icon: Icon, title, description, action, secondary }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sageLight text-lg text-sage">
          <Icon />
        </span>
      )}
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-ink3">{description}</p>}
      </div>
      {(action || secondary) && (
        <div className="mt-1 flex items-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </Card>
  )
}
