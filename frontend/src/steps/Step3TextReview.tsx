import type { Mode, Reference } from '../types'

interface Props {
  mode: Mode
  references: Reference[]
  storyText: string
  historyText: string
  editedText: string
  onEditedTextChange: (t: string) => void
  onRegenerate: () => void
  onNext: () => void
  onBack: () => void
  isRegenerating: boolean
}

const MODE_LABEL: Record<Mode, string> = {
  story:   '이야기 중심 해설',
  history: '역사·정석 해설',
}

export default function Step3TextReview({
  mode, references, storyText, historyText,
  editedText, onEditedTextChange,
  onRegenerate, onNext, onBack,
  isRegenerating,
}: Props) {
  const charCount  = editedText.length
  const otherMode  = mode === 'story' ? 'history' : 'story'
  const otherText  = mode === 'story' ? historyText : storyText
  const otherLabel = MODE_LABEL[otherMode]

  return (
    <div className="max-w-2xl mx-auto">

      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cu-border bg-cu-surface mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-cu-cyan" style={{ boxShadow: '0 0 4px #00C8D7' }} />
          <span className="text-[11px] text-cu-muted tracking-label uppercase">Step 3 of 4</span>
        </div>
        <h2 className="font-display font-bold text-3xl tracking-display text-cu-text mb-3">
          해설 검토 및 수정
        </h2>
        <p className="text-cu-muted text-sm max-w-md">
          AI가 생성한 해설을 확인하고 직접 수정할 수 있습니다.
          수정된 내용이 음성으로 변환됩니다.
        </p>
      </div>

      {/* Mode badge */}
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cu-cyan/30 bg-cu-cyan-dim text-cu-cyan text-[11px] font-semibold tracking-label">
          {mode === 'story' ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          )}
          {MODE_LABEL[mode]}
        </span>
        <div className="h-px flex-1 bg-cu-border" />
      </div>

      {/* Editable card */}
      <div className="rounded-xl border border-cu-border bg-cu-surface overflow-hidden mb-4 shadow-card">
        <div className="px-5 py-3.5 border-b border-cu-border flex items-center justify-between">
          <span className="text-[11px] font-semibold text-cu-muted tracking-label uppercase">해설 텍스트</span>
          <div className="flex items-center gap-3">
            <span className={`text-[11px] tabular-nums ${charCount > 1500 ? 'text-amber-400' : 'text-cu-dim'}`}>
              {charCount.toLocaleString()}자
            </span>
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 text-[11px] text-cu-muted hover:text-cu-cyan
                         px-2.5 py-1 rounded-md border border-cu-border hover:border-cu-cyan/30
                         transition-all disabled:opacity-40"
            >
              {isRegenerating ? (
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
              다시 생성
            </button>
          </div>
        </div>

        <div className="p-5">
          <textarea
            className="input-dark w-full h-64 text-sm leading-[1.85] p-4 border border-cu-border
                       rounded-lg resize-none transition-all font-sans"
            value={editedText}
            onChange={(e) => onEditedTextChange(e.target.value)}
            placeholder="생성된 해설이 여기에 표시됩니다..."
          />
          <p className="text-[10px] text-cu-dim mt-2 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-cu-cyan/40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            텍스트를 직접 수정하면 수정된 내용이 TTS에 사용됩니다
          </p>
        </div>
      </div>

      {references.length > 0 && (
        <div className="rounded-xl border border-cu-border bg-cu-surface px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-cu-muted mb-2">함께 참고한 전시 자료</p>
          <ul className="flex flex-wrap gap-2">
            {references.map((reference) => (
              <li
                key={reference.id}
                className="text-xs text-cu-text border border-cu-border rounded-full px-3 py-1"
              >
                {reference.title}
                <span className="text-cu-dim ml-2">
                  {reference.kind === 'chapter' ? '챕터' : '작품'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Other mode reference */}
      {otherText && (
        <details className="group rounded-xl border border-cu-border bg-cu-surface overflow-hidden mb-6">
          <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none
                             hover:bg-cu-elevated transition-colors">
            <div className="flex items-center gap-2 text-xs font-medium text-cu-muted">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.58-3.007-9.964-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {otherLabel} 참고용 보기
            </div>
            <svg className="w-4 h-4 text-cu-dim transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>
          <div className="px-5 pb-5 pt-3">
            <div className="p-4 bg-cu-bg rounded-lg text-xs text-cu-muted leading-[1.85] border border-cu-border">
              {otherText}
            </div>
            <button
              onClick={() => onEditedTextChange(otherText)}
              className="mt-2.5 text-[11px] text-cu-cyan hover:text-cu-cyan-muted flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m0-3l-3-3m0 0l-3 3m3-3v11.25m6-2.25h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
              </svg>
              이 텍스트 사용하기
            </button>
          </div>
        </details>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium
                     border border-cu-border text-cu-muted hover:border-cu-border-bright hover:text-cu-text
                     transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          이전
        </button>

        <button
          onClick={onNext}
          disabled={!editedText.trim()}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full font-medium text-sm
                     bg-cu-cyan text-cu-bg tracking-label
                     hover:bg-cu-cyan-muted active:scale-[0.99]
                     disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={{ boxShadow: editedText.trim() ? '0 0 16px rgba(0,200,215,0.25)' : undefined }}
        >
          <span>목소리 선택으로</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  )
}
