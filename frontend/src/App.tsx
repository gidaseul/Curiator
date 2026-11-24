import { useState } from 'react'
import { generateAudio, generateAudioClone, generateText } from './api'
import StepProgress from './components/StepProgress'
import { buildTextRequest, EXAMPLE_ARTIFACT, EXAMPLE_MUSEUM_BUNDLE, summarizeSourceInput } from './source'
import Step1Artifact from './steps/Step1Artifact'
import Step2Level from './steps/Step2Level'
import Step3TextReview from './steps/Step3TextReview'
import Step4AudioResult from './steps/Step4AudioResult'
import type {
  AudienceLevel,
  Language,
  Mode,
  RuntimeTtsProvider,
  Step,
  TtsProvider,
  Voice,
  VoiceMode,
  WizardState,
} from './types'


const INITIAL_STATE: WizardState = {
  sourceJson: JSON.stringify(EXAMPLE_ARTIFACT, null, 2),
  chapterIndex: null,
  language: '한국어',
  level: 'general',
  useKnowledge: false,
  references: [],
  mode: 'story',
  storyText: '',
  historyText: '',
  editedText: '',
  voiceMode: 'preset',
  ttsProvider: 'auto',
  voice: 'Adam',
  customVoiceFile: null,
  audioUrl: null,
  audioProviderUsed: null,
}


function providerBadgeText(provider: RuntimeTtsProvider | null) {
  if (provider === 'gemini') return 'Gemini TTS'
  if (provider === 'opensource') return 'Open-source TTS'
  if (provider === 'openvoice') return 'OpenVoice Clone'
  return 'Engine Pending'
}


export default function App() {
  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<WizardState>(INITIAL_STATE)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceSummary = summarizeSourceInput(state.sourceJson)
  const effectiveChapterIndex = sourceSummary?.chapters.length ? (state.chapterIndex ?? 0) : null

  const getDisplayName = () => sourceSummary?.displayName ?? '도슨트 해설'

  const handleSourceChange = (value: string) => {
    setState((prev) => ({
      ...prev,
      sourceJson: value,
      audioUrl: null,
      audioProviderUsed: null,
    }))
  }

  const handleLoadArtifactExample = () => {
    setState((prev) => ({
      ...prev,
      sourceJson: JSON.stringify(EXAMPLE_ARTIFACT, null, 2),
      chapterIndex: null,
      audioUrl: null,
      audioProviderUsed: null,
    }))
    setError(null)
  }

  const handleLoadMuseumExample = () => {
    setState((prev) => ({
      ...prev,
      sourceJson: JSON.stringify(EXAMPLE_MUSEUM_BUNDLE, null, 2),
      chapterIndex: 0,
      audioUrl: null,
      audioProviderUsed: null,
    }))
    setError(null)
  }

  const handleStep1Next = () => {
    setError(null)
    setStep(2)
  }

  const handleGenerateText = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const request = buildTextRequest(
        state.sourceJson,
        effectiveChapterIndex,
        state.language,
        state.level,
        state.useKnowledge,
      )
      const response = await generateText(request)
      const selectedText = state.mode === 'story' ? response.story_text : response.history_text

      setState((prev) => ({
        ...prev,
        storyText: response.story_text,
        references: response.references ?? [],
        historyText: response.history_text,
        editedText: selectedText,
        audioUrl: null,
        audioProviderUsed: null,
      }))
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : '텍스트 생성 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const request = buildTextRequest(
        state.sourceJson,
        effectiveChapterIndex,
        state.language,
        state.level,
        state.useKnowledge,
      )
      const response = await generateText(request)
      const selectedText = state.mode === 'story' ? response.story_text : response.history_text

      setState((prev) => ({
        ...prev,
        storyText: response.story_text,
        references: response.references ?? [],
        historyText: response.history_text,
        editedText: selectedText,
        audioUrl: null,
        audioProviderUsed: null,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '재생성 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStep3Next = () => {
    setError(null)
    setState((prev) => ({ ...prev, audioUrl: null, audioProviderUsed: null }))
    setStep(4)
  }

  const handleGenerateAudio = async () => {
    setIsLoading(true)
    setError(null)

    try {
      let audioUrl: string
      let audioProviderUsed: RuntimeTtsProvider

      if (state.voiceMode === 'custom' && state.customVoiceFile) {
        const response = await generateAudioClone(state.editedText, state.language, state.customVoiceFile)
        audioUrl = response.audio_url
        audioProviderUsed = 'openvoice'
      } else {
        const response = await generateAudio({
          text: state.editedText,
          voice: state.voice,
          language: state.language,
          provider: state.ttsProvider,
        })
        audioUrl = response.audio_url
        audioProviderUsed = response.provider
      }

      setState((prev) => ({
        ...prev,
        audioUrl,
        audioProviderUsed,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '음성 생성 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setState(INITIAL_STATE)
    setStep(1)
    setError(null)
  }

  const handleChapterChange = (index: number | null) => {
    setState((prev) => ({
      ...prev,
      chapterIndex: index,
      audioUrl: null,
      audioProviderUsed: null,
    }))
  }

  const handleVoiceModeChange = (mode: VoiceMode) => {
    setState((prev) => ({
      ...prev,
      voiceMode: mode,
      audioUrl: null,
      audioProviderUsed: null,
    }))
  }

  const handleProviderChange = (provider: TtsProvider) => {
    setState((prev) => ({
      ...prev,
      ttsProvider: provider,
      audioUrl: null,
      audioProviderUsed: null,
    }))
  }

  const handleVoiceChange = (voice: Voice) => {
    setState((prev) => ({
      ...prev,
      voice,
      audioUrl: null,
      audioProviderUsed: null,
    }))
  }

  const handleLanguageChange = (language: Language) => {
    setState((prev) => ({
      ...prev,
      language,
      audioUrl: null,
      audioProviderUsed: null,
    }))
  }

  const handleLevelChange = (level: AudienceLevel) => {
    setState((prev) => ({ ...prev, level, audioUrl: null, audioProviderUsed: null }))
  }

  const handleUseKnowledgeChange = (useKnowledge: boolean) => {
    setState((prev) => ({ ...prev, useKnowledge }))
  }

  const handleModeChange = (mode: Mode) => {
    setState((prev) => ({
      ...prev,
      mode,
      audioUrl: null,
      audioProviderUsed: null,
    }))
  }

  return (
    <div className="min-h-screen text-cu-text">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[18px] bg-[linear-gradient(135deg,#3182F6_0%,#57A7FF_45%,#6DE4C7_100%)] flex items-center justify-center shadow-cyan"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L3 8.5v.5h18v-.5L12 3zM3 9h18v1H3V9zM5 10v8m4-8v8m4-8v8m4-8v8M3 18h18" />
              </svg>
            </div>
            <div>
              <p className="font-display font-extrabold text-[15px] tracking-[-0.03em]">Curiator Studio</p>
              <p className="text-[11px] text-cu-dim tracking-wide">Museum voice and narrative workflow</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-cu-muted">
            <a href="#overview" className="hover:text-cu-text transition-colors">Overview</a>
            <a href="#studio" className="hover:text-cu-text transition-colors">Studio</a>
            <a href="#verification" className="hover:text-cu-text transition-colors">Validation</a>
          </div>

          <a
            href="#studio"
            className="inline-flex items-center gap-2 rounded-full bg-cu-cyan px-4 py-2.5 text-sm font-semibold text-white shadow-btn-cyan hover:bg-cu-cyan-muted transition-all"
          >
            시작하기
          </a>
        </div>
      </header>

      <main>
        <section id="overview" className="max-w-7xl mx-auto px-5 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5 xl:gap-7 items-stretch">
            <div className="rounded-[34px] border border-white/70 bg-white px-6 py-7 sm:px-10 sm:py-9 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-cu-cyan-dim px-3 py-1.5 text-[11px] font-semibold tracking-wide text-cu-cyan">
                  Hybrid Docent Engine
                </div>
                <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-cu-border bg-cu-elevated px-3 py-1.5 text-[11px] font-semibold tracking-wide text-cu-dim">
                  Responsive museum workflow
                </div>
              </div>
              <h1 className="mt-5 max-w-4xl break-keep font-display text-[2.15rem] sm:text-[3.2rem] xl:text-[3.85rem] leading-[0.97] tracking-[-0.055em] text-cu-text">
                <span className="block">선명하고 반응형인</span>
                <span className="block text-cu-cyan">박물관 도슨트 스튜디오</span>
              </h1>
              <p className="mt-5 max-w-xl text-[15px] sm:text-[16px] leading-7 text-cu-muted">
                단일 작품부터 박물관 챕터 번들까지 한 화면에서 입력하고, 이야기형 또는 정석형 해설을
                만든 뒤, Gemini와 오픈소스 TTS를 상황에 맞게 선택해 바로 음성으로 이어집니다.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <a
                  href="#studio"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-cu-cyan px-5 py-3 text-sm font-semibold text-white shadow-btn-cyan hover:bg-cu-cyan-muted transition-all"
                >
                  Studio 열기
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
                <button
                  onClick={handleLoadMuseumExample}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-cu-border bg-cu-surface px-5 py-3 text-sm font-semibold text-cu-text hover:border-cu-cyan/35 hover:text-cu-cyan transition-all"
                >
                  챕터 번들 예시
                </button>
                <a
                  href="#verification"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-cu-elevated px-5 py-3 text-sm font-semibold text-cu-muted hover:text-cu-text transition-all"
                >
                  검증 흐름 보기
                </a>
              </div>

              <div className="mt-7 rounded-[28px] border border-cu-border bg-[linear-gradient(135deg,#F7FAFF_0%,#FFFFFF_54%,#F5FFFC_100%)] p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  ['구조', sourceSummary?.scope === 'chapter' ? 'Museum bundle' : 'Single artifact'],
                  ['엔진', state.voiceMode === 'custom' ? 'OpenVoice clone' : state.ttsProvider],
                  ['현재 대상', getDisplayName()],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[20px] border border-white bg-white/90 px-4 py-3">
                      <p className="text-[10px] font-semibold tracking-[0.08em] text-cu-dim">{label}</p>
                      <p className="mt-1 text-[13px] sm:text-sm font-semibold text-cu-text">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className="rounded-[34px] overflow-hidden border border-white/70 shadow-card bg-[linear-gradient(145deg,#F2F7FF_0%,#EEF7FF_42%,#F6FFFC_100%)] p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 h-full">
                <div className="rounded-[28px] bg-[linear-gradient(160deg,#3182F6_0%,#57A7FF_52%,#68E3D0_100%)] p-5 sm:p-7 text-white relative overflow-hidden min-h-[240px] sm:min-h-[280px]">
                  <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.9),transparent_34%)]" />
                  <div className="relative">
                    <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-white/70">Narrative OS</p>
                    <h2 className="mt-4 max-w-md break-keep text-[1.65rem] sm:text-[2.05rem] font-display font-extrabold leading-[1] tracking-[-0.05em]">
                      입력 구조가 바뀌어도
                      <span className="block">동일한 스튜디오에서</span>
                      <span className="block">텍스트와 음성을 설계합니다.</span>
                    </h2>
                    <p className="mt-4 max-w-md text-sm leading-6 text-white/82">
                      챕터 선택, 스크립트 편집, 보이스 엔진 분기를 한 흐름으로 정리해 모바일에서도 카드가
                      자연스럽게 이어지도록 구성했습니다.
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-2.5 sm:max-w-md">
                      {[
                        ['Museum', sourceSummary?.museumName ?? '지정되지 않음'],
                        ['Artifacts', `${sourceSummary?.artifactCount ?? 0}개`],
                        ['Mode', state.mode === 'story' ? 'Story docent' : 'Academic docent'],
                        ['Audio', providerBadgeText(state.audioProviderUsed)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/20 bg-white/12 px-3.5 py-3 backdrop-blur-sm">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-white/65">{label}</p>
                          <p className="mt-1 text-[13px] sm:text-sm font-semibold text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[0.95fr_1.05fr] gap-4">
                  <div className="rounded-[26px] bg-white p-5 shadow-card border border-white/80">
                    <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-cu-cyan">Current setup</p>
                    <div className="mt-4 space-y-3">
                      {[
                        ['입력 범위', sourceSummary?.scope === 'chapter' ? '챕터 번들' : '단일 작품'],
                        ['선택 언어', state.language],
                        ['보이스 경로', state.voiceMode === 'custom' ? '사용자 음성 복제' : '프리셋 보이스'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-cu-elevated px-4 py-3">
                          <p className="text-[11px] text-cu-muted">{label}</p>
                          <p className="text-[13px] sm:text-sm font-semibold text-cu-text text-right">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[26px] bg-white p-5 shadow-card border border-white/80">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-cu-cyan">Responsive flow</p>
                      <span className="text-[11px] text-cu-dim">4-step studio</span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        ['Step 1', '입력 JSON 분석'],
                        ['Step 2', '언어와 챕터 선택'],
                        ['Step 3', '텍스트 수정'],
                        ['Step 4', '음성 엔진 선택'],
                      ].map(([label, text]) => (
                        <div key={label} className="rounded-2xl bg-cu-elevated px-4 py-3">
                          <span className="text-[13px] sm:text-sm font-semibold text-cu-text">{label}</span>
                          <p className="mt-1 text-[11px] text-cu-muted">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-5 sm:px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ['입력 구조 확장', '단일 유물과 박물관-챕터 번들을 동일한 위저드에서 처리합니다.', 'bg-[linear-gradient(135deg,#EAF2FF_0%,#FFFFFF_100%)]'],
              ['TTS 엔진 다중화', 'Gemini와 오픈소스 MeloTTS, 그리고 OpenVoice 복제 경로를 분리했습니다.', 'bg-[linear-gradient(135deg,#ECFFF8_0%,#FFFFFF_100%)]'],
              ['자동 검증 흐름', '백엔드 스모크 테스트, 프론트 빌드, openvoice 환경 확인 스크립트를 추가했습니다.', 'bg-[linear-gradient(135deg,#FFF7EC_0%,#FFFFFF_100%)]'],
            ].map(([title, desc, background]) => (
              <div
                key={title}
                className="rounded-[28px] border border-white/80 p-6 shadow-card"
                style={{ background: background as string }}
              >
                <p className="text-lg font-display font-extrabold tracking-[-0.04em] text-cu-text">{title}</p>
                <p className="mt-3 text-sm leading-7 text-cu-muted">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="studio" className="max-w-7xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
          <div className="rounded-[36px] border border-white/80 bg-white/90 shadow-card overflow-hidden backdrop-blur-md">
            <div className="px-5 sm:px-8 py-6 sm:py-7 border-b border-cu-border bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]">
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 items-start">
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.14em] uppercase text-cu-cyan">Studio</p>
                  <h2 className="mt-3 font-display text-[1.85rem] sm:text-[2.3rem] leading-[1] tracking-[-0.05em] text-cu-text">
                    한 번의 입력으로
                    <span className="block">스크립트와 음성을 함께 조정합니다.</span>
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm sm:text-[15px] leading-7 text-cu-muted">
                    모바일에서는 카드가 세로로 쌓이고, 데스크톱에서는 스튜디오 헤더와 요약 카드가 나란히 보이도록
                    구성했습니다. 기능보다 먼저 화면이 답답해 보이지 않도록 레이아웃 밀도를 조절했습니다.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] bg-cu-elevated px-4 py-3.5">
                    <p className="text-[11px] tracking-wide text-cu-dim">Current source</p>
                    <p className="mt-1 text-sm font-semibold text-cu-text">{getDisplayName()}</p>
                  </div>
                  <div className="rounded-[24px] bg-cu-elevated px-4 py-3.5">
                    <p className="text-[11px] tracking-wide text-cu-dim">Audio engine</p>
                    <p className="mt-1 text-sm font-semibold text-cu-text">
                      {state.voiceMode === 'custom' ? 'OpenVoice' : state.ttsProvider}
                    </p>
                  </div>
                  <div className="rounded-[24px] bg-cu-elevated px-4 py-3.5">
                    <p className="text-[11px] tracking-wide text-cu-dim">Museum</p>
                    <p className="mt-1 text-sm font-semibold text-cu-text">{sourceSummary?.museumName ?? '미지정'}</p>
                  </div>
                  <div className="rounded-[24px] bg-cu-elevated px-4 py-3.5">
                    <p className="text-[11px] tracking-wide text-cu-dim">Artifacts</p>
                    <p className="mt-1 text-sm font-semibold text-cu-text">{sourceSummary?.artifactCount ?? 0}개</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-8 py-5 border-b border-cu-border bg-white">
              <StepProgress current={step} />
            </div>

            {error ? (
              <div className="px-5 sm:px-8 pt-6">
                <div className="flex items-center gap-3 p-3 px-5 bg-red-50 border border-red-200 rounded-full">
                  <svg className="w-4 h-4 text-cu-error flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-600 text-sm flex-1">{error}</p>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="px-4 sm:px-8 py-8 sm:py-10">
              {step === 1 ? (
                <Step1Artifact
                  value={state.sourceJson}
                  summary={sourceSummary}
                  onChange={handleSourceChange}
                  onLoadArtifactExample={handleLoadArtifactExample}
                  onLoadMuseumExample={handleLoadMuseumExample}
                  onNext={handleStep1Next}
                />
              ) : null}

              {step === 2 ? (
                <Step2Level
                  language={state.language}
                  level={state.level}
                  useKnowledge={state.useKnowledge}
                  onLevelChange={handleLevelChange}
                  onUseKnowledgeChange={handleUseKnowledgeChange}
                  mode={state.mode}
                  sourceSummary={sourceSummary}
                  chapterIndex={effectiveChapterIndex}
                  onLanguageChange={handleLanguageChange}
                  onModeChange={handleModeChange}
                  onChapterChange={handleChapterChange}
                  onNext={handleGenerateText}
                  onBack={() => {
                    setError(null)
                    setStep(1)
                  }}
                  isLoading={isLoading}
                />
              ) : null}

              {step === 3 ? (
                <Step3TextReview
                  mode={state.mode}
                  references={state.references}
                  storyText={state.storyText}
                  historyText={state.historyText}
                  editedText={state.editedText}
                  onEditedTextChange={(text) =>
                    setState((prev) => ({
                      ...prev,
                      editedText: text,
                      audioUrl: null,
                      audioProviderUsed: null,
                    }))
                  }
                  onRegenerate={handleRegenerate}
                  onNext={handleStep3Next}
                  onBack={() => {
                    setError(null)
                    setStep(2)
                  }}
                  isRegenerating={isLoading}
                />
              ) : null}

              {step === 4 ? (
                <Step4AudioResult
                  voiceMode={state.voiceMode}
                  ttsProvider={state.ttsProvider}
                  voice={state.voice}
                  customVoiceFile={state.customVoiceFile}
                  mode={state.mode}
                  artifactName={getDisplayName()}
                  editedText={state.editedText}
                  audioUrl={state.audioUrl}
                  audioProviderUsed={state.audioProviderUsed}
                  onVoiceModeChange={handleVoiceModeChange}
                  onProviderChange={handleProviderChange}
                  onVoiceChange={handleVoiceChange}
                  onCustomVoiceFileChange={(file) =>
                    setState((prev) => ({
                      ...prev,
                      customVoiceFile: file,
                      audioUrl: null,
                      audioProviderUsed: null,
                    }))
                  }
                  onGenerate={handleGenerateAudio}
                  onBack={() => {
                    setError(null)
                    setStep(3)
                  }}
                  onReset={handleReset}
                  isLoading={isLoading}
                  error={error}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section id="verification" className="max-w-7xl mx-auto px-5 sm:px-6 pb-16">
          <div className="rounded-[32px] bg-[linear-gradient(135deg,#EAF2FF_0%,#FFFFFF_55%,#ECFFF8_100%)] border border-white/80 shadow-card p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.14em] uppercase text-cu-cyan">Validation</p>
                <h3 className="mt-3 font-display text-[2rem] leading-[1] tracking-[-0.05em] text-cu-text">
                  정리한 뒤에는
                  <span className="block">자동 검증까지 이어집니다.</span>
                </h3>
                <p className="mt-4 text-sm leading-7 text-cu-muted">
                  백엔드 스모크 테스트와 프론트 번들 검증은 자동화했고, `openvoice` 환경은 import까지 통과한 상태이며
                  체크포인트 경로만 추가 확인하면 됩니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  ['Backend smoke', '입력 해석과 FastAPI 라우트 스모크 테스트'],
                  ['Frontend build', '반응형 레이아웃과 타입 체크를 다시 번들링'],
                  ['Openvoice env', 'conda 환경 import 검증과 체크포인트 경로 판별'],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-[24px] bg-white/80 border border-white px-5 py-5 shadow-card">
                    <p className="text-base font-display font-extrabold tracking-[-0.04em] text-cu-text">{title}</p>
                    <p className="mt-3 text-sm leading-6 text-cu-muted">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/60 bg-white/70">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="font-display text-sm font-extrabold tracking-[-0.03em] text-cu-dim">Curiator</span>
          <span className="text-cu-dim text-xs">Responsive museum docent studio with hybrid audio generation</span>
        </div>
      </footer>
    </div>
  )
}
