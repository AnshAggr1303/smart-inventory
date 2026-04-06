// app/(app)/scanner/loading.tsx
export default function ScannerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-surface-container rounded-lg" />
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 h-[400px] bg-surface-container-low rounded-xl" />
        <div className="flex-[1.5] h-[400px] bg-surface-container-low rounded-xl" />
      </div>
    </div>
  )
}
