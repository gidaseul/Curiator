import type { AudienceLevel, Language, Mode, SourceSummary } from '../types'


const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: '한국어', flag: 'KR', label: '한국어' },
  { code: '영어', flag: 'EN', label: 'English' },
  { code: '일본어', flag: 'JP', label: '日本語' },
  { code: '스페인어', flag: 'ES', label: 'Español' },
  { code: '프랑스어', flag: 'FR', label: 'Français' },
]


const AUDIENCE_LEVELS: { key: AudienceLevel; label: string; hint: string }[] = [
  { key: 'child', label: '어린이', hint: '쉬운 낱말, 짧은 문장' },
  { key: 'general', label: '일반', hint: '기본 해설' },
  { key: 'expert', label: '전문가', hint: '용어와 서지 정보를 그대로' },
]


const LEVELS: {
  key: Mode
  badge: string
  title: string
  subtitle: string
  audience: string
  traits: string[]
}[] = [
  {
    key: 'story',
    badge: 'STORY',
    title: '이야기 중심 해설',
    subtitle: '장면과 감정선을 먼저 전달',
    audience: '첫 방문자 · 비전공 관람객',
    traits: ['친근한 말투', '장면 묘사', '전시 흐름 중심'],
  },
  {
    key: 'history',
    badge: 'ACADEMIC',
    title: '역사·정석 해설',
    subtitle: '맥락과 조형 정보를 더 밀도 있게',
    audience: '역사 관심자 · 전공 입문자',
    traits: ['역사적 맥락', '조형 분석', '정보 밀도 강화'],
  },
]


interface Props {
  language: Language
  level: AudienceLevel
  useKnowledge: boolean
  onLevelChange: (level: AudienceLevel) => void
  onUseKnowledgeChange: (value: boolean) => void
  mode: Mode
  sourceSummary: SourceSummary | null
  chapterIndex: number | null
  onLanguageChange: (l: Language) => void
  onModeChange: (m: Mode) => void
  onChapterChange: (index: number | null) => void
  onNext: () => void
  onBack: () => void
  isLoading: boolean
}


export default function Step2Level({
  language,
  level,
  useKnowledge,
  onLevelChange,
  onUseKnowledgeChange,
  mode,
  sourceSummary,
  chapterIndex,
  onLanguageChange,
  onModeChange,
  onChapterChange,
  onNext,
  onBack,
  isLoading,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cu-border bg-cu-surface mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-cu-cyan" style={{ boxShadow: '0 0 4px #00C8D7' }} />
          <span className="text-[11px] text-cu-muted tracking-label uppercase">Step 2 of 4</span>
        </div>
        <h2 className="font-display font-bold text-[1.8rem] sm:text-3xl tracking-display text-cu-text mb-3">
          큐레이션 설정
        </h2>
        <p className="text-cu-muted text-sm max-w-2xl leading-relaxed">
          언어, 해설 방식, 그리고 필요하다면 어떤 챕터를 해설할지 선택합니다.
        </p>
      </div>

      {sourceSummary?.chapters.length ? (
        <div className="rounded-3xl border border-cu-border bg-cu-surface p-5 sm:p-6 mb-4 shadow-card">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-cu-muted tracking-label uppercase mb-4">
            <div className="w-3 h-px bg-cu-cyan" />
            챕터 선택
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {sourceSummary.chapters.map((chapter) => {
              const active = (chapterIndex ?? 0) === chapter.index
              return (
                <button
                  key={chapter.index}
                  onClick={() => onChapterChange(chapter.index)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? 'border-cu-cyan bg-cu-cyan-dim'
                      : 'border-cu-border bg-cu-elevated hover:border-cu-border-bright'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <p className="text-sm font-semibold text-cu-text">{chapter.title}</p>
                    <span className="text-[11px] text-cu-cyan whitespace-nowrap">{chapter.artifactCount} 작품</span>
                  </div>
                  {chapter.description && (
                    <p className="text-xs text-cu-muted leading-relaxed">{chapter.description}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-cu-border bg-cu-surface p-5 sm:p-6 mb-4 shadow-card">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-cu-muted tracking-label uppercase mb-4">
          <div className="w-3 h-px bg-cu-cyan" />
          해설 언어
        </h3>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(({ code, flag, label }) => (
            <button
              key={code}
              onClick={() => onLanguageChange(code)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                language === code
                  ? 'bg-cu-cyan-dim border-cu-cyan text-cu-cyan'
                  : 'bg-transparent border-cu-border text-cu-muted hover:border-cu-border-bright hover:text-cu-text'
              }`}
              style={language === code ? { boxShadow: '0 0 10px rgba(0,200,215,0.15)' } : undefined}
            >
              <span className="text-[10px] font-semibold tracking-wide2">{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-cu-border bg-cu-surface p-5 sm:p-6 mb-4 shadow-card">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-cu-muted tracking-label uppercase mb-4">
          <div className="w-3 h-px bg-cu-cyan" />
          관람객 수준
        </h3>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_LEVELS.map(({ key, label, hint }) => (
            <button
              key={key}
              onClick={() => onLevelChange(key)}
              aria-pressed={level === key}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                level === key
                  ? 'bg-cu-cyan-dim border-cu-cyan text-cu-cyan'
                  : 'bg-transparent border-cu-border text-cu-muted hover:border-cu-border-bright hover:text-cu-text'
              }`}
            >
              <span>{label}</span>
              <span className="text-[11px] opacity-70">{hint}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm text-cu-muted cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={useKnowledge}
            onChange={(event) => onUseKnowledgeChange(event.target.checked)}
          />
          <span>
            <span className="text-cu-text">전시 자료에서 관련 작품을 찾아 함께 참고하기</span>
            <br />
            서버에 넣어 둔 전시 자료에서 이 작품과 이어지는 자료를 찾아 해설에 덧붙입니다.
          </span>
        </label>
      </div>

      <div className="rounded-3xl border border-cu-border bg-cu-surface p-5 sm:p-6 mb-6 shadow-card">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-cu-muted tracking-label uppercase mb-4">
          <div className="w-3 h-px bg-cu-cyan" />
          해설 유형
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEVELS.map((level) => {
            const active = mode === level.key
            return (
              <button
                key={level.key}
                onClick={() => onModeChange(level.key)}
                className={`group p-5 rounded-2xl border text-left transition-all duration-200 ${
                  active
                    ? 'border-cu-cyan bg-cu-cyan-dim'
                    : 'border-cu-border bg-cu-elevated hover:border-cu-border-bright'
                }`}
                style={active ? { boxShadow: '0 0 20px rgba(0,200,215,0.08)' } : undefined}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[10px] font-bold tracking-wide2 px-2 py-0.5 rounded border ${
                    active
                      ? 'border-cu-cyan/40 text-cu-cyan bg-cu-cyan/10'
                      : 'border-cu-border text-cu-muted bg-cu-surface'
                  }`}>
                    {level.badge}
                  </span>
                  {active ? (
                    <div className="w-4 h-4 rounded-full border border-cu-cyan flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-cu-cyan" />
                    </div>
                  ) : null}
                </div>

                <p className="font-semibold text-sm mb-1 text-cu-text">{level.title}</p>
                <p className="text-xs text-cu-muted mb-3">{level.subtitle}</p>
                <p className="text-[11px] text-cu-muted mb-3">{level.audience}</p>

                <div className="flex flex-wrap gap-1.5">
                  {level.traits.map((trait) => (
                    <span
                      key={trait}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        active ? 'border-cu-cyan/25 text-cu-cyan/70' : 'border-cu-border text-cu-dim'
                      }`}
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-cu-border bg-cu-elevated mb-6">
        <svg className="w-4 h-4 text-cu-cyan/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <p className="text-[11px] text-cu-muted leading-relaxed">
          텍스트 생성은 선택한 입력 구조를 기준으로 동작합니다. 챕터 입력이면 해당 챕터 전체에 대한
          도슨트 스크립트를 생성하고, 단일 작품이면 기존처럼 작품 하나 기준으로 생성합니다.
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-cu-border text-cu-muted hover:border-cu-border-bright hover:text-cu-text transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          이전
        </button>

        <button
          onClick={onNext}
          disabled={isLoading}
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-7 py-3 rounded-full font-medium text-sm bg-cu-cyan text-cu-bg tracking-label hover:bg-cu-cyan-muted active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={isLoading ? undefined : { boxShadow: '0 0 16px rgba(0,200,215,0.25)' }}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span>해설 생성 중...</span>
            </>
          ) : (
            <>
              <span>해설 생성하기</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
