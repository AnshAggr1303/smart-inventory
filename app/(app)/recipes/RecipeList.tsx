'use client'
// Client component: needs useState for client-side search filter

import { useState } from 'react'
import { BookOpen, Plus, ChevronRight, ArrowRight, ListChecks } from 'lucide-react'
import type { RecipeListItem } from '@/types/recipes'

type Props = {
  recipes: RecipeListItem[]
  selectedId: string | null
  label: string
  onSelect: (id: string) => void
  onNew: () => void
}

export function RecipeList({ recipes, selectedId, label, onSelect, onNew }: Props) {
  const [search, setSearch] = useState('')

  const filtered = recipes.filter(
    r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section className="w-80 bg-surface-container-low overflow-y-auto p-6 flex flex-col gap-6 shrink-0">
      <div className="space-y-4">
        <button
          onClick={onNew}
          className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          New {label}
        </button>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/40 text-sm select-none">
            ⌕
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}s...`}
            className="w-full pl-9 pr-4 py-2 bg-surface-container-lowest border-none rounded-lg text-xs focus:ring-2 focus:ring-primary-fixed outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
          <BookOpen className="w-12 h-12 text-on-surface/20" />
          <p className="font-semibold text-on-surface/60">
            {search
              ? `No ${label.toLowerCase()}s match "${search}"`
              : `No ${label.toLowerCase()}s yet`}
          </p>
          {!search && (
            <>
              <p className="text-xs text-on-surface/40">
                Create your first {label.toLowerCase()} to start tracking ingredient usage
              </p>
              <button
                onClick={onNew}
                className="mt-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-lg text-sm font-bold hover:opacity-90 transition-all"
              >
                New {label}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(recipe => {
            const isSelected = recipe.id === selectedId
            return (
              <button
                key={recipe.id}
                onClick={() => onSelect(recipe.id)}
                className={`w-full text-left p-4 rounded-xl transition-all group ${
                  isSelected
                    ? 'bg-surface-container-lowest shadow-md border-2 border-primary-container'
                    : 'bg-surface-container-lowest shadow-sm hover:bg-surface-container-low'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-on-surface">{recipe.name}</h3>
                  {isSelected ? (
                    <ArrowRight className="w-4 h-4 text-primary-container shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-on-surface/30 group-hover:text-primary transition-colors shrink-0" />
                  )}
                </div>
                {recipe.category && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed-variant text-[10px] font-bold uppercase tracking-wider rounded">
                      {recipe.category}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-on-surface/60">
                  <ListChecks className="w-4 h-4" />
                  <span className="font-mono">{recipe.ingredient_count}</span> ingredients
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
