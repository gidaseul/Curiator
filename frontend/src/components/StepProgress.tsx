interface StepProgressProps {
  current: number
}

const STEPS = [
  { label: '작품 입력' },
  { label: '수준 선택' },
  { label: '해설 검토' },
  { label: '음성 생성' },
]

export default function StepProgress({ current }: StepProgressProps) {
  return (
    <div className="w-full">

      {/* Desktop */}
      <div className="hidden sm:flex items-center justify-center gap-0">
        {STEPS.map((step, idx) => {
          const num    = idx + 1
          const done   = num < current
          const active = num === current

          return (
            <div key={num} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                  transition-all duration-300 border
                  ${done
                    ? 'bg-cu-cyan border-cu-cyan text-cu-bg'
                    : active
                    ? 'bg-cu-cyan-dim border-cu-cyan text-cu-cyan'
                    : 'bg-transparent border-cu-border text-cu-muted'
                  }
                `}
                style={active ? { boxShadow: '0 0 12px rgba(0,200,215,0.3)' } : undefined}
                >
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : num}
                </div>
                <span className={`
                  text-[10px] font-medium tracking-wide2 uppercase whitespace-nowrap transition-colors
                  ${active ? 'text-cu-cyan' : done ? 'text-cu-muted' : 'text-cu-dim'}
                `}>
                  {step.label}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div
                  className="w-14 h-px mx-3 mb-5 transition-all duration-500"
                  style={{ background: num < current ? '#3182F6' : '#D7E2F0' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile */}
      <div className="sm:hidden flex items-center justify-between">
        <span className="text-xs font-medium text-cu-text">
          <span className="text-cu-cyan font-semibold">{current}</span>
          <span className="text-cu-muted"> / {STEPS.length}</span>
          <span className="text-cu-muted ml-1.5">— {STEPS[current - 1]?.label}</span>
        </span>
        <div className="flex gap-1.5">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className="h-0.5 rounded-full transition-all duration-300"
              style={{
                width: idx + 1 === current ? '28px' : '20px',
                background: idx + 1 <= current ? '#3182F6' : '#D7E2F0',
              }}
            />
          ))}
        </div>
      </div>

    </div>
  )
}
