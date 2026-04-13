export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-dark">
      <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  )
}
