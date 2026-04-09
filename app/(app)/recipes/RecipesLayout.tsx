'use client'
// Client component: manages selected recipe ID, view/create/edit mode

import { useState } from 'react'
import { RecipeList } from './RecipeList'
import { RecipeDetail } from './RecipeDetail'
import { RecipeForm } from './RecipeForm'
import type { Recipe, RecipeListItem } from '@/types/recipes'

type InventoryItem = { id: string; name: string; unit: string }

type Props = {
  recipes: RecipeListItem[]
  allRecipes: Recipe[]
  items: InventoryItem[]
  label: string
}

type Mode = 'view' | 'create' | 'edit'

export function RecipesLayout({ recipes, allRecipes, items, label }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(recipes[0]?.id ?? null)
  const [mode, setMode] = useState<Mode>('view')
  const [recipeList, setRecipeList] = useState<RecipeListItem[]>(recipes)
  const [fullRecipes, setFullRecipes] = useState<Recipe[]>(allRecipes)

  const selectedRecipe = fullRecipes.find(r => r.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(id)
    setMode('view')
  }

  function handleNew() {
    setSelectedId(null)
    setMode('create')
  }

  function handleEdit() {
    setMode('edit')
  }

  function handleFormSuccess(_recipe_id: string) {
    // Trigger a full page refresh to pull fresh data from the server
    window.location.reload()
  }

  function handleArchived() {
    const nextId = recipeList.find(r => r.id !== selectedId)?.id ?? null
    setRecipeList(prev => prev.filter(r => r.id !== selectedId))
    setFullRecipes(prev => prev.filter(r => r.id !== selectedId))
    setSelectedId(nextId)
    setMode('view')
  }

  const rightPanel =
    mode === 'create' || mode === 'edit' ? (
      <section className="flex-1 overflow-y-auto bg-surface p-8">
        <div className="max-w-2xl mx-auto">
          <RecipeForm
            label={label}
            items={items}
            recipe={mode === 'edit' ? (selectedRecipe ?? undefined) : undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setMode('view')}
          />
        </div>
      </section>
    ) : (
      <RecipeDetail
        recipe={selectedRecipe}
        label={label}
        onEdit={handleEdit}
        onArchived={handleArchived}
      />
    )

  return (
    <div className="flex-1 flex overflow-hidden">
      <RecipeList
        recipes={recipeList}
        selectedId={selectedId}
        label={label}
        onSelect={handleSelect}
        onNew={handleNew}
      />
      {rightPanel}
    </div>
  )
}
