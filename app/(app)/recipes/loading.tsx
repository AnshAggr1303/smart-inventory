export default function RecipesLoading() {
  return (
    <main className="ml-60 flex-1 flex flex-col min-h-screen">
      <header className="sticky top-0 z-30 bg-surface px-8 py-4">
        <div className="h-9 w-32 bg-surface-container-low rounded-lg animate-pulse" />
      </header>
      <div className="flex-1 flex overflow-hidden">
        <section className="w-80 bg-surface-container-low p-6 flex flex-col gap-4 shrink-0">
          <div className="h-12 bg-surface-container rounded-xl animate-pulse" />
          <div className="h-9 bg-surface-container rounded-lg animate-pulse" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-surface-container-lowest rounded-xl animate-pulse" />
          ))}
        </section>
        <section className="flex-1 bg-surface p-8 space-y-6">
          <div className="h-12 w-64 bg-surface-container-low rounded-lg animate-pulse" />
          <div className="h-64 bg-surface-container-low rounded-xl animate-pulse" />
          <div className="h-48 bg-surface-container-low rounded-2xl animate-pulse" />
        </section>
      </div>
    </main>
  )
}
