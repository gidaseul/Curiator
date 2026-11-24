export default function LoadingSpinner() {
  return (
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border border-cu-border" />
      <div className="absolute inset-0 rounded-full border border-cu-cyan border-t-transparent animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-cu-cyan animate-pulse" style={{ boxShadow: '0 0 6px #00C8D7' }} />
      </div>
    </div>
  )
}
