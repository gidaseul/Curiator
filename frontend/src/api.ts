import type {
  AudioRequest,
  AudioResponse,
  DocentRequest,
  DocentResponse,
  TextRequest,
  TextResponse,
} from './types'


async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const error = await response.json().catch(() => null)
    if (error && typeof error === 'object' && 'detail' in error && typeof error.detail === 'string') {
      return error.detail
    }
  }

  const text = await response.text().catch(() => '')
  if (text.trim()) {
    return text.trim()
  }

  return `HTTP ${response.status}`
}


async function post<Req, Res>(url: string, body: Req): Promise<Res> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readErrorDetail(response))
  }

  return response.json() as Promise<Res>
}


export const generateDocent = (req: DocentRequest) =>
  post<DocentRequest, DocentResponse>('/generate', req)


export const generateText = (req: TextRequest) =>
  post<TextRequest, TextResponse>('/generate-text', req)


export const generateAudio = (req: AudioRequest) =>
  post<AudioRequest, AudioResponse>('/generate-audio', req)


export async function generateAudioClone(
  text: string,
  language: string,
  referenceAudio: File,
): Promise<{ audio_url: string }> {
  const form = new FormData()
  form.append('text', text)
  form.append('language', language)
  form.append('reference_audio', referenceAudio)

  const response = await fetch('/generate-audio-clone', {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(await readErrorDetail(response))
  }

  return response.json() as Promise<{ audio_url: string }>
}
