import { cn } from '../lib/utils'

const DEFAULT_STEPS = [
  { key: 'intake', label: 'Client Profile' },
  { key: 'encoding', label: 'Case Study' },
  { key: 'for_review', label: 'For Review' },
  { key: 'recommending_approval', label: 'Recommending' },
  { key: 'for_approval', label: 'For Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'released', label: 'Released' },
]

export default function CaseStepper({ status, onStepClick, isStepClickable, steps = DEFAULT_STEPS }) {
  const stepIndex = Object.fromEntries(steps.map((step, index) => [step.key, index]))
  stepIndex.rejected = -1
  const current = stepIndex[status] ?? 0
  const isRejected = status === 'rejected'

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-max items-center px-2">
        {steps.map((step, i) => {
          const isDone = current > i
          const isCurrent = current === i
          const isFailed = isRejected && isCurrent
          const clickable = !!isStepClickable?.(step.key, i)

          return (
            <div key={step.key} className="flex items-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(step.key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-md outline-none',
                  clickable ? 'cursor-pointer' : 'cursor-default'
                )}
                title={clickable ? `Go to ${step.label}` : undefined}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300',
                    isDone
                      ? 'border-brand-teal bg-brand-teal text-white'
                      : isFailed
                        ? 'border-red-500 bg-red-500 text-white'
                        : isCurrent
                          ? 'border-brand-primary bg-brand-primary text-white'
                          : 'border-slate-300 bg-white text-slate-400',
                    clickable && 'hover:opacity-90'
                  )}
                >
                  {isDone ? 'OK' : isFailed ? 'X' : i + 1}
                </div>
                <span
                  className={cn(
                    'whitespace-nowrap text-[10px] font-medium',
                    isDone
                      ? 'text-brand-teal'
                      : isFailed
                        ? 'text-red-500'
                        : isCurrent
                          ? 'font-semibold text-brand-primary'
                          : 'text-slate-400'
                  )}
                >
                  {step.label}
                </span>
              </button>

              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-1 mb-4 h-0.5 w-10 transition-all duration-500 md:w-16',
                    isDone ? 'bg-brand-teal' : 'bg-slate-200'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
