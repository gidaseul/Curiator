import { useState } from 'react'
import type { SourceSummary } from '../types'


interface Props {
  value: string
  summary: SourceSummary | null
  onChange: (v: string) => void
  onLoadArtifactExample: () => void
  onLoadMuseumExample: () => void
  onNext: () => void
}


export default function Step1Artifact({
  value,
  summary,
  onChange,
  onLoadArtifactExample,
  onLoadMuseumExample,
  onNext,
}: Props) {
  const [jsonError, setJsonError] = useState<string | null>(null)

  const handleNext = () => {
    try {
      JSON.parse(value)
      setJsonError(null)
      onNext()
    } catch {
      setJsonError('올바른 JSON 형식이 아닙니다.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cu-border bg-cu-surface/80 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-cu-cyan" style={{ boxShadow: '0 0 4px #00C8D7' }} />
          <span className="text-[11px] text-cu-muted tracking-label uppercase">Step 1 of 4</span>
        </div>
        <h2 className="font-display font-bold text-[1.8rem] sm:text-3xl tracking-display text-cu-text mb-3">
          입력 소스 구성
        </h2>
        <p className="text-cu-muted text-sm leading-relaxed max-w-2xl">
          단일 작품 JSON으로 바로 시작할 수도 있고, 박물관 아래 여러 챕터와 작품을 묶은 JSON 번들로
          큐레이션 흐름을 설계할 수도 있습니다. 현재 단계에서는 둘 다 동일한 입력창에서 받습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 mb-6">
        <button
          onClick={onLoadArtifactExample}
          className="rounded-2xl border border-cu-border bg-cu-surface/90 p-4 sm:p-5 text-left hover:border-cu-cyan/40 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold tracking-label uppercase text-cu-cyan">Single Artifact</span>
            <span className="text-xs text-cu-dim">빠른 시작</span>
          </div>
          <p className="text-cu-text text-lg font-semibold mb-1">작품 하나로 바로 도슨트 생성</p>
          <p className="text-sm text-cu-muted leading-relaxed">
            지금 바로 텍스트와 음성 흐름을 검증할 때 적합합니다.
          </p>
        </button>

        <button
          onClick={onLoadMuseumExample}
          className="rounded-2xl border border-cu-border bg-cu-surface/90 p-4 sm:p-5 text-left hover:border-cu-cyan/40 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold tracking-label uppercase text-cu-cyan">Museum Bundle</span>
            <span className="text-xs text-cu-dim">확장 구조</span>
          </div>
          <p className="text-cu-text text-lg font-semibold mb-1">박물관-챕터-작품 번들 입력</p>
          <p className="text-sm text-cu-muted leading-relaxed">
            이후 챕터 단위 큐레이션과 샘플 묶음 전개를 위한 구조입니다.
          </p>
        </button>
      </div>

      <div className="rounded-3xl border border-cu-border bg-cu-surface/90 overflow-hidden shadow-card">
        <div className="px-5 sm:px-6 py-4 border-b border-cu-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-cu-text">도슨트 입력 JSON</p>
            <p className="text-xs text-cu-muted mt-1">
              작품 하나 또는 박물관/챕터 번들을 그대로 붙여넣으세요
            </p>
          </div>
          {summary && (
            <div className="text-right">
              <p className="text-[11px] text-cu-cyan font-semibold tracking-label uppercase">
                {summary.scope === 'artifact' ? 'Artifact Mode' : 'Chapter Mode'}
              </p>
              <p className="text-xs text-cu-muted mt-1">{summary.displayName}</p>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <textarea
            className={`input-dark w-full h-64 sm:h-80 font-mono text-[11px] sm:text-xs leading-relaxed p-4 rounded-2xl resize-none border transition-all ${
              jsonError ? 'border-cu-error/60' : 'border-cu-border'
            }`}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setJsonError(null)
            }}
            spellCheck={false}
            placeholder={'{\n  "museum": { "name": "국립중앙박물관" },\n  "chapters": [ ... ]\n}'}
          />

          {jsonError && (
            <div className="mt-2.5 flex items-center gap-2 text-cu-error text-xs">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {jsonError}
            </div>
          )}

          {summary && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-cu-border bg-cu-elevated p-4">
                <p className="text-[11px] tracking-label uppercase text-cu-dim mb-2">Display</p>
                <p className="text-sm text-cu-text font-medium">{summary.displayName}</p>
              </div>
              <div className="rounded-2xl border border-cu-border bg-cu-elevated p-4">
                <p className="text-[11px] tracking-label uppercase text-cu-dim mb-2">Museum</p>
                <p className="text-sm text-cu-text font-medium">{summary.museumName ?? '미지정'}</p>
              </div>
              <div className="rounded-2xl border border-cu-border bg-cu-elevated p-4">
                <p className="text-[11px] tracking-label uppercase text-cu-dim mb-2">Artifacts</p>
                <p className="text-sm text-cu-text font-medium">{summary.artifactCount.toLocaleString()}개</p>
              </div>
            </div>
          )}

          {summary?.chapters.length ? (
            <div className="mt-5 rounded-2xl border border-cu-border bg-cu-elevated p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-cu-text">챕터 인식 결과</p>
                <span className="text-xs text-cu-dim">{summary.chapters.length}개 챕터</span>
              </div>
              <div className="space-y-2">
                {summary.chapters.map((chapter) => (
                  <div key={chapter.index} className="flex items-start justify-between gap-4 rounded-xl border border-cu-border px-3.5 sm:px-4 py-3">
                    <div>
                      <p className="text-sm text-cu-text font-medium">{chapter.title}</p>
                      {chapter.description && (
                        <p className="text-xs text-cu-muted mt-1 leading-relaxed">{chapter.description}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-cu-cyan whitespace-nowrap">{chapter.artifactCount} 작품</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleNext}
          disabled={!value.trim()}
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-7 py-3 rounded-full font-medium text-sm bg-cu-cyan text-cu-bg tracking-label hover:bg-cu-cyan-muted active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={{ boxShadow: value.trim() ? '0 0 16px rgba(0,200,215,0.25)' : undefined }}
        >
          <span>큐레이션 선택으로</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  )
}
