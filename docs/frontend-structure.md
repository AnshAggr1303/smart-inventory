## SECTION 8: FRONTEND STRUCTURE MODULE

---

### Overview

The frontend is built with Next.js 14 App Router,
TypeScript (strict), and TailwindCSS. The base design
comes from the Stitch export in /stitch/. This section
defines how the frontend is organised, how components
are built, how routing works, and the conventions Claude
Code must follow on every UI file it creates.

This is a web-only application for Phase 1.
No mobile bottom tab bar. The sidebar collapses to a
hamburger menu on smaller screens.

Full detail is here in this file. Referenced in
CLAUDE.md Section 7 (Design System).

---

### Stitch export — how to use it

The /stitch/ folder contains HTML design references
exported from Stitch (by Google). Each screen folder
contains two files:
- code.html  — the full HTML/CSS design reference
- screen.png — the visual target screenshot

The /stitch/indigo_ledger/DESIGN.md file is the
single source of truth for all design tokens —
colors, typography, elevation, components.

### Stitch screen → route mapping

| Stitch folder           | Route                         |
|-------------------------|-------------------------------|
| landing_page            | /                             |
| signup_onboarding       | /(onboarding)/                |
| main_dashboard          | /(app)/dashboard              |
| bill_scanner            | /(app)/scanner                |
| inventory_item_detail   | /(app)/inventory/[id]         |
| recipe_manager          | /(app)/recipes                |
| reorder_agent_panel     | /(app)/agents                 |
| analytics_reports       | /(app)/analytics              |

One screen has no Stitch reference — build from the
design system tokens in DESIGN.md:
→ /(app)/inventory  (main inventory list page)

### Stitch conversion rule — critical

Each code.html is a design reference, not copy-paste.
For every screen, Claude Code must:

1. Read code.html carefully — understand layout,
   spacing, component structure, interactions
2. Study screen.png — this is the visual target
3. Read /stitch/indigo_ledger/DESIGN.md — apply
   the correct tokens (colors, typography, elevation)
4. Rebuild as a proper Next.js page + components
   using TailwindCSS and the design system
5. Replace all hardcoded data with real Supabase data
6. Wire all buttons and forms to Server Actions
7. Split large screens into focused components

Never copy HTML directly into JSX.
Never use inline styles from the HTML reference.
Always use Tailwind classes that map to DESIGN.md tokens.

---

### Design system — from DESIGN.md

Read /stitch/indigo_ledger/DESIGN.md before building
any component. These are the key rules extracted:

#### Color tokens
```typescript
// tailwind.config.ts — extend with these exact values
colors: {
  // Surfaces — background hierarchy
  surface: {
    DEFAULT: '#FAFAEF',        // global page background
    low:     '#F5F4EA',        // sidebar, section areas
    lowest:  '#FFFFFF',        // cards, inputs (focal point)
  },
  // Primary
  primary: {
    DEFAULT:   '#1E0CDE',      // buttons, active states
    container: '#3D3BF3',      // gradient end, accents
    fixed:     '#E1E0FF',      // focus ring glow
  },
  // Text
  'on-surface':  '#1B1C16',    // ALL body text — never #000
  'on-primary':  '#FFFFFF',    // text on primary buttons
  // Semantic
  tertiary: {
    DEFAULT: '#7B5800',        // AI insights label text
    fixed:   '#FFDDB8',        // low stock pill background
  },
  secondary: {
    container: '#A3A6FE',      // processing pill background
  },
  // Outline
  'outline-variant': '#C6C4D9', // ghost border color
}
```

#### The no-line rule

Never use 1px borders to separate sections.
Separate content areas through background color shifts:
- Page background:   surface (#FAFAEF)
- Sidebar + panels:  surface-low (#F5F4EA)
- Cards + inputs:    surface-lowest (#FFFFFF)

The only permitted border is the ghost border:
outline-variant (#C6C4D9) at 15% opacity.
Use it only when background shift alone is insufficient
for accessibility contrast.

#### Typography
```typescript
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['Inter Mono', 'monospace'],
  // font-mono is mandatory for ALL quantities,
  // stock counts, SKU numbers, prices
}

fontSize: {
  'display':        ['3.5rem',  { lineHeight: '1.1',
                      fontWeight: '700' }],
  'heading-lg':     ['2rem',    { lineHeight: '1.2',
                      fontWeight: '600' }],
  'heading-md':     ['1.5rem',  { lineHeight: '1.3',
                      fontWeight: '600' }],
  'body-md':        ['0.875rem',{ lineHeight: '1.6',
                      fontWeight: '400' }],
  'body-sm':        ['0.75rem', { lineHeight: '1.5',
                      fontWeight: '400' }],
  'label-sm':       ['0.75rem', { lineHeight: '1.4',
                      fontWeight: '500',
                      letterSpacing: '0.05em' }],
  // label-sm: uppercase + tracking for category headers
}
```

#### Elevation — tonal layering only

No standard drop shadows from any UI kit.
Depth is created by stacking surfaces:
card (surface-lowest) on section (surface-low)
on page (surface) = natural lift, no shadows needed.

When a floating element genuinely needs a shadow
(dropdown, command palette, tooltip):
```css
box-shadow: 0 12px 32px -4px rgba(27, 28, 22, 0.06);
```
This is the only permitted shadow value.

#### Glassmorphism — floating elements only

For command palette, tooltips, insight toasts:
```css
background: rgba(255, 255, 255, 0.80);
backdrop-filter: blur(12px);
```
Never use glassmorphism on static page elements.

#### Buttons

Primary:
```css
background: linear-gradient(135deg, #1E0CDE, #3D3BF3);
border-radius: 8px;
color: #FFFFFF;
/* hover: translateY(-1px) + slight shadow increase */
```

Secondary:
```css
background: #FFFFFF;        /* surface-lowest */
border: 1px solid rgba(198, 196, 217, 0.15); /* ghost */
border-radius: 8px;
color: #1E0CDE;
```

#### Input fields
```css
background: #FFFFFF;        /* surface-lowest, no border */
border-radius: 8px;
border: none;
/* focus state — soft glow ring */
outline: 2px solid #E1E0FF; /* primary-fixed */
```

#### Status pills
```typescript
// Low stock
className="bg-[#FFDDB8] text-[#7B5800]
           px-3 py-1 rounded-full text-label-sm"

// Processing / in progress
className="bg-[#A3A6FE] text-[#1E0CDE]
           px-3 py-1 rounded-full text-label-sm"

// AI-powered insight (always use tertiary/amber)
className="bg-tertiary-fixed text-tertiary
           px-3 py-1 rounded-full text-label-sm"
```

#### The divider ban

Never use horizontal <hr> or border-bottom lines
to separate list items or table rows.
Use vertical padding (py-4) and hover background
shifts (hover:bg-surface-low) to define rows.

#### Card roundedness

Standard functional cards: rounded-lg (0.5rem)
Large summary/hero cards:  rounded-2xl (1.5rem)
Never mix these — use xl only for top-level KPI cards.

---

### Tailwind config — full setup
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#FAFAEF',
          low:     '#F5F4EA',
          lowest:  '#FFFFFF',
        },
        primary: {
          DEFAULT:   '#1E0CDE',
          container: '#3D3BF3',
          fixed:     '#E1E0FF',
        },
        'on-surface':  '#1B1C16',
        'on-primary':  '#FFFFFF',
        tertiary: {
          DEFAULT: '#7B5800',
          fixed:   '#FFDDB8',
        },
        secondary: {
          container: '#A3A6FE',
        },
        'outline-variant': '#C6C4D9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Inter Mono', 'monospace'],
      },
      fontSize: {
        'display':    ['3.5rem',  { lineHeight: '1.1' }],
        'heading-lg': ['2rem',    { lineHeight: '1.2' }],
        'heading-md': ['1.5rem',  { lineHeight: '1.3' }],
        'body-md':    ['0.875rem',{ lineHeight: '1.6' }],
        'body-sm':    ['0.75rem', { lineHeight: '1.5' }],
        'label-sm':   ['0.75rem', { lineHeight: '1.4',
                        letterSpacing: '0.05em' }],
      },
      boxShadow: {
        'ambient': '0 12px 32px -4px rgba(27,28,22,0.06)',
        // Only permitted shadow — use sparingly
      },
      borderRadius: {
        'card':    '0.5rem',   // standard cards
        'card-lg': '1.5rem',   // hero / KPI cards only
      },
    },
  },
  plugins: [],
}

export default config
```

---

### Layout structure

#### Root layout — /app/layout.tsx

- Sets html lang="en"
- Loads Inter + Inter Mono via next/font/google
- Wraps in Supabase session provider
- Sets body background to surface (#FAFAEF)
- No sidebar or nav here

#### Auth layout — /app/(auth)/layout.tsx

- Centered single column, max-width 480px
- Background: surface (#FAFAEF)
- White card (surface-lowest) centered on page
- Smart Inventory wordmark at top
- Used for: login, signup, reset-password

#### Onboarding layout — /app/(onboarding)/layout.tsx

- Centered single column, max-width 560px
- Background: surface (#FAFAEF)
- Step indicator: 3 dots, filled = complete
- Progress bar (thin, primary gradient) below dots
- Smart Inventory wordmark top left
- No sidebar, no nav

#### App layout — /app/(app)/layout.tsx

Main authenticated layout. All inner screens use this.
```tsx
<div className="flex h-screen overflow-hidden
                bg-surface">
  <Sidebar />
  {/* 240px fixed, bg-surface-low */}

  <div className="flex-1 flex flex-col overflow-hidden">
    <TopBar />
    {/* 56px, bg-surface-low, no bottom border —
        separation via background shift only */}

    <main className="flex-1 overflow-y-auto p-6
                     bg-surface">
      {children}
    </main>
  </div>
</div>
```

On screens < 768px:
- Sidebar hidden by default
- TopBar shows hamburger icon (menu from lucide-react)
- Tapping hamburger slides sidebar in as overlay
  (z-50, backdrop: bg-on-surface/20)
- No bottom tab bar in Phase 1

---

### Sidebar — /components/shared/Sidebar.tsx

240px wide. Background: surface-low (#F5F4EA).
No right border — background shift separates it
from the main content area.
```
[Smart Inventory logo]
[Business name — body-md, on-surface]
[Industry badge — label-sm pill]
────────────────────────── (spacing only, no line)
Dashboard          (home)
Inventory          (package)
Bill Scanner       (camera)
[Recipes/Formulas] (book-open) ← label by industry
Agents             (cpu)
Analytics          (bar-chart)
Suppliers          (truck)
────────────────────────── (spacing only, no line)
Settings           (settings)
────────────────────────── (spacing only, no line)
[Avatar] [Name] [logout icon]
```

Active nav item:
```tsx
className="bg-primary/10 text-primary
           border-l-2 border-primary
           rounded-r-lg"
// Left border + light primary tint
// No box, no full highlight
```

Recipe label by industry:
```typescript
const RECIPE_LABELS: Record<string, string> = {
  restaurant:    'Recipes',
  pharmacy:      'Formulas',
  manufacturing: 'Bill of Materials',
  hotel:         'Service Kits',
  retail:        'Usage Templates',
  other:         'Recipes',
}
```

---

### TopBar — /components/shared/TopBar.tsx

56px tall. Background: surface-low (#F5F4EA).
No bottom border — main content area shifts to
surface (#FAFAEF) creating a natural separation.
```
Left:   Page title (heading-md, on-surface)
Center: Co-pilot search bar (320px → 480px on focus)
Right:  Notification bell + "Scan Bill" primary button
```

Co-pilot search bar:
- Placeholder: "Ask anything... e.g. how much paneer left?"
- Background: surface-lowest (white), no border
- Focus: 2px ring of primary-fixed (#E1E0FF)
- Cmd/Ctrl + K keyboard shortcut to focus
- On submit → Server Action → Gemini copilot task
- Response in glassmorphic dropdown panel below bar
- Panel: surface-lowest 80% opacity + blur(12px)

---

### Page layout convention

Every inner app page follows this structure:
```tsx
export default function PageName() {
  return (
    <div className="max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-center
                      justify-between mb-8">
        <div>
          <h1 className="text-heading-lg
                         text-on-surface font-semibold">
            Page Title
          </h1>
          <p className="text-body-md
                        text-on-surface/60 mt-1">
            Optional subtitle
          </p>
        </div>
        <div className="flex gap-3">
          {/* Primary action */}
        </div>
      </div>

      {/* Page content */}
      {children}

    </div>
  )
}
```

Max content width: 1280px (max-w-7xl), centered.
Outer padding applied by layout — pages do not add
their own outer padding.

---

### Component conventions

#### Server vs Client

Default: Server Component.
Add "use client" only for: useState, useEffect,
event listeners, browser APIs, client-only libs.

Every "use client" file must have a comment:
```typescript
'use client'
// Client component: needs useState for [reason]
```

#### Component file order
```typescript
'use client' // only if needed, with comment

// 1. External imports
// 2. Internal imports
// 3. Local type definitions
// 4. Component function
//    a. State (if client)
//    b. Derived values
//    c. Handlers
//    d. JSX return
```

#### Naming

- Component files:    PascalCase.tsx
- Server Actions:     actions.ts (per route folder)
- Utility files:      camelCase.ts
- Type files:         camelCase.ts
- Pages:              page.tsx (Next.js convention)
- Route handlers:     route.ts (Next.js convention)

#### Props

- Boolean:   is/has prefix  (isLoading, hasError)
- Handlers:  on prefix      (onConfirm, onDismiss)
- Data:      specific noun  (item, recipe, bill)
- Never use 'data' as a prop name

---

### Data fetching patterns

#### Server Components (preferred)
```typescript
export default async function InventoryPage() {
  const supabase = createServerClient()
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('is_archived', false)
    .order('name')

  return <ItemsTable items={items ?? []} />
}
```

#### Client Components

Use SWR. Never use raw fetch + useEffect for data.
```typescript
import useSWR from 'swr'
const { data, isLoading } = useSWR('/api/inventory', fetcher)
```

#### Optimistic updates

Use React's useOptimistic for actions that feel slow.
Update UI immediately, confirm in background,
rollback on error.

---

### Loading and error states

Every data route must have loading.tsx + error.tsx.

Loading: skeleton components matching page layout.
Never full-page spinners.
```tsx
// loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 rounded-card
                      bg-surface-low animate-pulse"/>
      <div className="h-64 w-full rounded-card
                      bg-surface-low animate-pulse"/>
    </div>
  )
}
```

Error: friendly message + retry button.
Must be "use client".
Log technical details server-side only.

Empty state: every list/table/feed must have one.
```tsx
<div className="flex flex-col items-center
                justify-center py-16 gap-3">
  <PackageIcon className="w-12 h-12
                           text-outline-variant"/>
  <h3 className="text-heading-md text-on-surface">
    No items yet
  </h3>
  <p className="text-body-md text-on-surface/60">
    Add your first item or scan a bill to get started
  </p>
  <Button>Add item</Button>
</div>
```

---

### Stock quantity display rules
```typescript
// /lib/utils/formatQuantity.ts

// Always font-mono
// Max 2 decimal places (trim trailing zeros)
// Always with unit: "340g", "12.4 kg", "840 tabs"
function formatQuantity(qty: number, unit: string): string

// Color class based on stock status
function getStockColor(
  current: number,
  reorderPoint: number
): string
// above reorder  → 'text-on-surface'       (default)
// at/below       → 'text-tertiary'         (amber)
// below 20%      → 'text-red-600'          (critical)
// zero           → 'text-red-600 font-bold'(zero)
```

All stock quantities in the app use:
```tsx
<span className={`font-mono ${getStockColor(...)}`}>
  {formatQuantity(item.current_stock, item.unit)}
</span>
```

---

### Toast notifications

Use react-hot-toast. Add <Toaster/> once in
/app/(app)/layout.tsx.

Style toasts to match DESIGN.md:
```typescript
// Success
toast.success('Added 5kg paneer to stock', {
  style: {
    background: '#FFFFFF',
    color: '#1B1C16',
    boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)',
    borderRadius: '8px',
  }
})
```

Conventions:
- Success: "Added X to stock" / "Recipe saved"
- Warning: "Low confidence scan — please verify"
- Error:   "Failed to save. Please try again."
- Info:    "Reorder draft created for your approval"

---

### Form conventions

Use React native forms with Server Actions by default.
No react-hook-form unless form has 10+ fields with
complex interdependencies.
```tsx
<form action={createItemAction}>
  <input name="name" required minLength={2}/>
  <input name="quantity" type="number" min={0}/>
  <button type="submit">Add item</button>
</form>
```

For forms needing instant validation (OCR confirm table)
use controlled Client Components with validate-on-blur.

---

### Realtime

Use Supabase Realtime on two places only:
1. Dashboard stock table (items UPDATE events)
2. Notification bell (agent_actions INSERT events)

Do not use Realtime on every page.
Too many concurrent connections drain free tier.
```typescript
// Pattern for realtime subscription
useEffect(() => {
  const channel = supabase
    .channel('stock-updates')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'items',
      filter: `org_id=eq.${org_id}`
    }, (payload) => {
      updateItemInState(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [org_id])
```

---

### Responsive — web first, mobile aware

This is a web application. Design desktop-first.
Sidebar collapses on < 768px to hamburger overlay.
No bottom tab bar in Phase 1.

Mobile awareness rules:
- No horizontal scroll on any screen
- Tables: hide lower-priority columns on mobile
  use: hidden md:table-cell on non-essential columns
  always show: name + stock + status columns
- Minimum tap target: 44px height on interactive elements
- Stack card grids to single column on mobile:
  grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Form inputs: full width on mobile, label above input

---

### Files Claude Code must create for this module

/app/layout.tsx
/app/(auth)/layout.tsx
/app/(auth)/login/page.tsx
/app/(auth)/signup/page.tsx
/app/(auth)/reset-password/page.tsx
/app/(onboarding)/layout.tsx
/app/(onboarding)/step-2/page.tsx
/app/(onboarding)/step-3/page.tsx
/app/api/auth/callback/route.ts
/app/(app)/layout.tsx
/app/(app)/dashboard/page.tsx
/app/(app)/dashboard/loading.tsx
/app/(app)/inventory/page.tsx
/app/(app)/inventory/loading.tsx
/app/(app)/inventory/error.tsx
/app/(app)/inventory/[id]/page.tsx
/app/(app)/scanner/page.tsx
/app/(app)/scanner/ConfirmTable.tsx
/app/(app)/scanner/UploadZone.tsx
/app/(app)/recipes/page.tsx
/app/(app)/agents/page.tsx
/app/(app)/analytics/page.tsx
/app/(app)/settings/page.tsx

/components/shared/
  Sidebar.tsx
  TopBar.tsx
  CopilotBar.tsx

/lib/utils/
  formatQuantity.ts

/tailwind.config.ts
/middleware.ts