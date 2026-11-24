import type { VoiceInfo } from '../types'

interface VoiceCardProps {
  voice: VoiceInfo
  isSelected: boolean
  onClick: () => void
}

export default function VoiceCard({ voice, isSelected, onClick }: VoiceCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group p-4 rounded-xl border text-left w-full transition-all duration-200 ${
        isSelected
          ? 'border-cu-cyan bg-cu-cyan-dim'
          : 'border-cu-border bg-cu-surface hover:border-cu-border-bright hover:bg-cu-elevated'
      }`}
      style={isSelected ? { boxShadow: '0 0 16px rgba(0,200,215,0.1)' } : undefined}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 transition-colors duration-200 ${
            isSelected ? 'bg-cu-cyan/10' : 'bg-cu-elevated group-hover:bg-cu-border'
          }`}
        >
          {voice.icon}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-semibold text-sm ${isSelected ? 'text-cu-cyan' : 'text-cu-text'}`}>
            {voice.label}
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-medium border tracking-wide ${
              voice.gender === 'male'
                ? 'bg-sky-50 text-sky-600 border-sky-100'
                : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}
          >
            {voice.gender === 'male' ? 'M' : 'F'}
          </span>
        </div>
      </div>

      <p className="text-xs text-cu-muted leading-snug">{voice.desc}</p>
      <p className="text-[10px] text-cu-dim mt-1.5 tracking-wide">{voice.temperature}</p>

      {isSelected && (
        <div className="mt-2.5 w-4 h-0.5 rounded-full bg-cu-cyan" />
      )}
    </button>
  )
}
