import { useRef, useState, useEffect } from 'react'

interface AudioPlayerProps {
  src: string
  voiceName: string
  showDownload?: boolean
  fileName?: string
}

export default function AudioPlayer({
  src,
  voiceName,
  showDownload = false,
  fileName = 'curiator-docent.mp3',
}: AudioPlayerProps) {
  const audioRef    = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const [isLoaded, setIsLoaded]       = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setIsLoaded(false)
  }, [src])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false) }
    else { void audioRef.current.play(); setIsPlaying(true) }
  }

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const res  = await fetch(src)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } catch { window.open(src, '_blank') }
    finally { setIsDownloading(false) }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="rounded-xl border border-cu-border bg-cu-surface overflow-hidden"
      style={{ boxShadow: '0 0 24px rgba(0,200,215,0.06)' }}
    >
      {/* Cyan top stripe */}
      <div className="h-px bg-gradient-to-r from-transparent via-cu-cyan/50 to-transparent" />

      <div className="p-5">
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => { setDuration(audioRef.current?.duration ?? 0); setIsLoaded(true) }}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="flex items-center gap-4">
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            disabled={!isLoaded}
            className="w-11 h-11 rounded-full border border-cu-cyan flex items-center justify-center
                       flex-shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed
                       hover:bg-cu-cyan/10 active:scale-95"
            style={isLoaded ? { boxShadow: '0 0 12px rgba(0,200,215,0.2)' } : undefined}
            aria-label={isPlaying ? '일시정지' : '재생'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-cu-cyan" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-cu-cyan ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            )}
          </button>

          {/* Track + time */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-cu-cyan text-xs font-medium tracking-wide">{voiceName}</span>
                <span className="text-cu-muted text-[10px]">· Docent Voice</span>
              </div>
              <span className="text-cu-muted text-xs tabular-nums font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="relative h-5 flex items-center">
              <div className="h-px w-full bg-cu-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{ width: `${pct}%`, background: '#3182F6' }}
                />
              </div>
              {duration > 0 && (
                <div
                  className="absolute w-2.5 h-2.5 rounded-full pointer-events-none -translate-x-1/2 transition-all duration-100"
                  style={{ left: `${pct}%`, background: '#3182F6', boxShadow: '0 0 8px rgba(49,130,246,0.35)' }}
                />
              )}
              <input
                type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
                onChange={handleSeek} disabled={!isLoaded}
                className="seek-bar absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Download */}
          {showDownload && (
            <button
              onClick={handleDownload}
              disabled={!isLoaded || isDownloading}
              title="MP3 다운로드"
              className="w-9 h-9 rounded-full border border-cu-border flex items-center justify-center
                         text-cu-muted hover:text-cu-cyan hover:border-cu-cyan/40
                         active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isDownloading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              )}
            </button>
          )}
        </div>

        {!isLoaded && (
          <p className="text-cu-dim text-xs mt-3 text-center tracking-wide">오디오 로딩 중...</p>
        )}
      </div>
    </div>
  )
}
