export type Language = '한국어' | '영어' | '일본어' | '스페인어' | '프랑스어'
export type Mode = 'story' | 'history'
export type AudienceLevel = 'child' | 'general' | 'expert'

export interface Reference {
  id: string
  kind: 'artifact' | 'chapter'
  title: string
  score: number
  method: 'embedding' | 'lexical'
}
export type Voice = 'Adam' | 'Noah' | 'Chloe' | 'Sophie'
export type VoiceMode = 'preset' | 'custom'
export type SaveMode = 'local' | 's3' | 'both'
export type Step = 1 | 2 | 3 | 4
export type TtsProvider = 'auto' | 'gemini' | 'opensource'
export type RuntimeTtsProvider = 'gemini' | 'opensource' | 'openvoice'

export interface ChapterSummary {
  index: number
  title: string
  artifactCount: number
  description?: string
}

export interface SourceSummary {
  scope: 'artifact' | 'chapter'
  displayName: string
  museumName: string | null
  artifactCount: number
  chapters: ChapterSummary[]
}

// ── Legacy (existing /generate endpoint) ────────────────────────────────
export interface DocentRequest {
  artifact?: Record<string, unknown>
  source?: Record<string, unknown>
  chapter_index?: number | null
  language: Language
  mode: Mode
  voice: Voice
  provider: TtsProvider
  save: SaveMode
}
export interface DocentResponse {
  mode: Mode
  voice: Voice
  provider: RuntimeTtsProvider
  language: Language
  save: SaveMode
  text: string
  audio_path: string
}

// ── Split endpoints ─────────────────────────────────────────────────────
export interface TextRequest {
  artifact?: Record<string, unknown>
  source?: Record<string, unknown>
  chapter_index?: number | null
  language: Language
  level?: AudienceLevel
  use_knowledge?: boolean
}
export interface TextResponse {
  story_text: string
  story_title: string
  history_text: string
  history_title: string
  level?: AudienceLevel
  references?: Reference[]
}

export interface AudioRequest {
  text: string
  voice: Voice
  language: Language
  provider: TtsProvider
}
export interface AudioResponse {
  audio_url: string
  voice: Voice
  provider: Exclude<RuntimeTtsProvider, 'openvoice'>
}

// ── Wizard shared state ─────────────────────────────────────────────────
export interface WizardState {
  sourceJson: string
  chapterIndex: number | null
  language: Language
  level: AudienceLevel
  useKnowledge: boolean
  references: Reference[]
  mode: Mode
  storyText: string
  historyText: string
  editedText: string
  voiceMode: VoiceMode
  ttsProvider: TtsProvider
  voice: Voice
  customVoiceFile: File | null
  audioUrl: string | null
  audioProviderUsed: RuntimeTtsProvider | null
}

// ── UI helpers ──────────────────────────────────────────────────────────
export interface VoiceInfo {
  name: Voice
  label: string
  desc: string
  gender: 'male' | 'female'
  icon: string
  temperature: string
}

export interface LevelInfo {
  key: Mode
  icon: React.ReactNode
  title: string
  subtitle: string
  audience: string
  style: string
}
