import { useRef } from 'react'
import type { Mode, RuntimeTtsProvider, TtsProvider, Voice, VoiceInfo, VoiceMode } from '../types'
import AudioPlayer from '../components/AudioPlayer'
import LoadingSpinner from '../components/LoadingSpinner'
import VoiceCard from '../components/VoiceCard'


const VOICES: VoiceInfo[] = [
  { name: 'Adam', label: 'Adam', desc: '중후하고 차분한', gender: 'male', icon: '🎩', temperature: 'Calm · Deep' },
  { name: 'Noah', label: 'Noah', desc: '활기차고 열정적인', gender: 'male', icon: '⚡', temperature: 'Lively · Energetic' },
  { name: 'Chloe', label: 'Chloe', desc: '밝고 친근한', gender: 'female', icon: '🌸', temperature: 'Bright · Friendly' },
  { name: 'Sophie', label: 'Sophie', desc: '부드럽고 따뜻한', gender: 'female', icon: '🌙', temperature: 'Soft · Warm' },
]


const PROVIDERS: { key: TtsProvider; title: string; desc: string }[] = [
  {
    key: 'auto',
    title: 'Auto',
    desc: 'Gemini를 먼저 시도하고, 실패하면 로컬 오픈소스 TTS로 이어집니다.',
  },
  {
    key: 'gemini',
    title: 'Gemini',
    desc: '클라우드 기반 보이스 합성으로 가장 안정적인 프리셋 결과를 우선합니다.',
  },
  {
    key: 'opensource',
    title: 'Open-source',
    desc: 'MeloTTS 기반 로컬 합성으로 외부 TTS 의존도를 낮춥니다.',
  },
]


function providerLabel(provider: RuntimeTtsProvider | null): string {
  if (provider === 'gemini') return 'Gemini TTS'
  if (provider === 'opensource') return 'Open-source TTS'
  if (provider === 'openvoice') return 'OpenVoice Clone'
  return '미정'
}


interface Props {
  voiceMode: VoiceMode
  ttsProvider: TtsProvider
  voice: Voice
  customVoiceFile: File | null
  mode: Mode
  artifactName: string
  editedText: string
  audioUrl: string | null
  audioProviderUsed: RuntimeTtsProvider | null
  onVoiceModeChange: (m: VoiceMode) => void
  onProviderChange: (provider: TtsProvider) => void
  onVoiceChange: (v: Voice) => void
  onCustomVoiceFileChange: (f: File | null) => void
  onGenerate: () => void
  onBack: () => void
  onReset: () => void
  isLoading: boolean
  error: string | null
}


export default function Step4AudioResult({
  voiceMode,
  ttsProvider,
  voice,
  customVoiceFile,
  mode,
  artifactName,
  editedText,
  audioUrl,
  audioProviderUsed,
  onVoiceModeChange,
  onProviderChange,
  onVoiceChange,
  onCustomVoiceFileChange,
  onGenerate,
  onBack,
  onReset,
  isLoading,
  error,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const downloadName = `curiator-${artifactName.replace(/\s+/g, '-')}-${voice}-${mode}.mp3`
  const canGenerate = voiceMode === 'preset' || customVoiceFile !== null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cu-border bg-cu-surface mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-cu-cyan" style={{ boxShadow: '0 0 4px #00C8D7' }} />
          <span className="text-[11px] text-cu-muted tracking-label uppercase">Step 4 of 4</span>
        </div>
        <h2 className="font-display font-bold text-3xl tracking-display text-cu-text mb-3">
          음성 엔진과 보이스 선택
        </h2>
        <p className="text-cu-muted text-sm max-w-2xl leading-relaxed">
          프리셋 보이스는 Gemini 또는 오픈소스 TTS로 생성할 수 있고, 직접 업로드한 오디오 샘플은 OpenVoice
          복제 경로로 처리합니다.
        </p>
      </div>

      <div className="rounded-3xl border border-cu-border bg-cu-surface p-6 mb-4 shadow-card">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-cu-muted tracking-label uppercase mb-4">
          <div className="w-3 h-px bg-cu-cyan" />
          목소리 선택 방식
        </h3>

        <div className="flex gap-2 mb-5 p-1 rounded-full bg-cu-bg border border-cu-border">
          {(['preset', 'custom'] as VoiceMode[]).map((modeOption) => (
            <button
              key={modeOption}
              onClick={() => onVoiceModeChange(modeOption)}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${
                voiceMode === modeOption ? 'bg-cu-cyan text-cu-bg' : 'text-cu-muted hover:text-cu-text'
              }`}
              style={voiceMode === modeOption ? { boxShadow: '0 0 12px rgba(0,200,215,0.2)' } : undefined}
            >
              {modeOption === 'preset' ? '캐릭터 목소리' : '내 목소리 샘플'}
            </button>
          ))}
        </div>

        {voiceMode === 'preset' ? (
          <>
            <div className="mb-5">
              <p className="text-xs font-semibold text-cu-muted tracking-label uppercase mb-3">TTS 제공자</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PROVIDERS.map((provider) => {
                  const active = provider.key === ttsProvider
                  return (
                    <button
                      key={provider.key}
                      onClick={() => onProviderChange(provider.key)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        active
                          ? 'border-cu-cyan bg-cu-cyan-dim'
                          : 'border-cu-border bg-cu-elevated hover:border-cu-border-bright'
                      }`}
                    >
                      <p className="text-sm font-semibold text-cu-text mb-1">{provider.title}</p>
                      <p className="text-xs text-cu-muted leading-relaxed">{provider.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {VOICES.map((voiceOption) => (
                <VoiceCard
                  key={voiceOption.name}
                  voice={voiceOption}
                  isSelected={voice === voiceOption.name}
                  onClick={() => onVoiceChange(voiceOption.name)}
                />
              ))}
            </div>
          </>
        ) : (
          <div>
            <p className="text-xs text-cu-muted mb-4 leading-relaxed">
              오디오 샘플을 업로드하면 OpenVoice 기반 로컬 목소리 복제 경로로 도슨트 해설을 생성합니다.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => onCustomVoiceFileChange(e.target.files?.[0] ?? null)}
            />

            {customVoiceFile ? (
              <div
                className="flex items-center gap-3 p-4 rounded-2xl border border-cu-success/30 bg-cu-success/5"
                style={{ boxShadow: '0 0 12px rgba(0,196,140,0.08)' }}
              >
                <div className="w-9 h-9 rounded-lg bg-cu-success/10 border border-cu-success/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-cu-success" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cu-text truncate">{customVoiceFile.name}</p>
                  <p className="text-xs text-cu-muted mt-0.5">{(customVoiceFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={() => {
                    onCustomVoiceFileChange(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="text-cu-muted hover:text-cu-error transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-2xl border-2 border-dashed border-cu-border hover:border-cu-cyan/40 hover:bg-cu-cyan/[0.03] flex flex-col items-center gap-3 transition-all text-cu-muted hover:text-cu-text group"
              >
                <div className="w-12 h-12 rounded-full border border-cu-border group-hover:border-cu-cyan/30 flex items-center justify-center transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">오디오 파일 업로드</p>
                  <p className="text-xs text-cu-dim mt-1">wav, mp3, m4a, ogg · 3–30초 권장</p>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-cu-border bg-cu-surface overflow-hidden mb-4">
        <details className="group">
          <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-cu-elevated transition-colors">
            <span className="text-xs font-medium text-cu-muted flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              TTS 입력 텍스트 ({editedText.length.toLocaleString()}자)
            </span>
            <svg className="w-4 h-4 text-cu-dim transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>
          <div className="px-5 pb-5 pt-3">
            <p className="text-xs text-cu-muted leading-[1.85] p-4 bg-cu-bg rounded-2xl border border-cu-border whitespace-pre-wrap">
              {editedText}
            </p>
          </div>
        </details>
      </div>

      {!audioUrl && !isLoading ? (
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`w-full py-4 mb-4 rounded-full font-medium text-sm tracking-label transition-all flex items-center justify-center gap-2.5 ${
            canGenerate
              ? 'bg-cu-cyan text-cu-bg hover:bg-cu-cyan-muted active:scale-[0.99]'
              : 'bg-cu-elevated text-cu-dim cursor-not-allowed border border-cu-border'
          }`}
          style={canGenerate ? { boxShadow: '0 0 20px rgba(0,200,215,0.2)' } : undefined}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          <span>{voiceMode === 'custom' && !customVoiceFile ? '오디오 파일을 업로드하세요' : '음성 생성하기'}</span>
        </button>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-cu-border bg-cu-surface p-10 mb-4 flex flex-col items-center text-center">
          <LoadingSpinner />
          <div className="mt-5 space-y-1.5">
            <p className="text-cu-text font-medium text-sm">음성을 생성하고 있습니다</p>
            <p className="text-cu-muted text-xs">
              {voiceMode === 'custom'
                ? 'OpenVoice 로컬 추론 중...'
                : ttsProvider === 'opensource'
                ? '오픈소스 로컬 TTS 처리 중...'
                : ttsProvider === 'auto'
                ? 'Gemini 우선 시도 후 필요 시 로컬 TTS로 이어집니다...'
                : 'Gemini TTS 처리 중...'}
            </p>
            <p className="text-cu-dim text-xs">
              {voiceMode === 'custom' ? '첫 실행 시 모델 로딩으로 1–2분 소요될 수 있습니다' : '환경에 따라 10–40초 내외로 달라질 수 있습니다'}
            </p>
          </div>
        </div>
      ) : null}

      {error && !isLoading ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-cu-error" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-red-600 font-semibold text-sm">TTS 생성 오류</p>
              <p className="text-red-500 text-sm mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
          <button
            onClick={onGenerate}
            className="mt-3 text-xs text-cu-error hover:text-red-300 font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            다시 시도하기
          </button>
        </div>
      ) : null}

      {audioUrl && !isLoading ? (
        <>
          <div
            className="rounded-3xl border border-cu-border bg-cu-surface overflow-hidden mb-4"
            style={{ boxShadow: '0 0 24px rgba(0,200,215,0.07)' }}
          >
            <div className="h-px bg-gradient-to-r from-transparent via-cu-cyan/40 to-transparent" />
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <span className="text-cu-cyan text-[10px] font-semibold tracking-label uppercase">
                  {mode === 'story' ? 'Story Mode' : 'Academic Mode'}
                </span>
                <h3 className="font-display font-bold text-xl text-cu-text mt-1">{artifactName}</h3>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cu-success" style={{ boxShadow: '0 0 5px #00C48C' }} />
                  <span className="text-cu-muted text-[11px]">생성 완료</span>
                </div>
                <p className="text-[11px] text-cu-cyan mt-1">{providerLabel(audioProviderUsed)}</p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <AudioPlayer
              src={audioUrl}
              voiceName={voiceMode === 'custom' ? (customVoiceFile?.name ?? 'Custom') : voice}
              showDownload
              fileName={downloadName}
            />
          </div>

          <div className="rounded-3xl border border-cu-border bg-cu-surface p-6 mb-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-px bg-cu-cyan" />
                <h4 className="text-[11px] font-semibold text-cu-muted tracking-label uppercase">해설 전문</h4>
              </div>
              <span className="text-[11px] text-cu-dim">{providerLabel(audioProviderUsed)}</span>
            </div>
            <p className="text-cu-text text-sm leading-[1.8] whitespace-pre-wrap">{editedText}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onGenerate}
              className="flex-1 py-3 rounded-full border border-cu-border text-cu-muted hover:border-cu-border-bright hover:text-cu-text text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              다시 생성하기
            </button>
            <button
              onClick={onReset}
              className="flex-1 py-3 rounded-full bg-cu-cyan text-cu-bg text-sm font-medium tracking-label transition-all hover:bg-cu-cyan-muted flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 16px rgba(0,200,215,0.2)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              처음으로
            </button>
          </div>
        </>
      ) : null}

      {!audioUrl && !isLoading ? (
        <div className="mt-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-cu-border text-cu-muted hover:border-cu-border-bright hover:text-cu-text text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            이전
          </button>
        </div>
      ) : null}
    </div>
  )
}
