## SECTION 3: AUTH + ONBOARDING MODULE

---

### Overview

Onboarding is a 3-step flow that runs once per user, immediately
after signup. It is gated — the user cannot access the main app
until all 3 steps are complete. After completion,
`user_profiles.onboarding_complete` is set to `true` and the user
is redirected to the dashboard permanently.

Flow:
  Sign up / Log in
    → Step 1: Create account (Supabase Auth)
    → Step 2: Business profile (org name, industry, city)
    → Step 3: API keys (Groq × 3 + Gemini)
    → Dashboard

---

### Auth setup (Supabase Auth)

Use Supabase Auth for all authentication. Do not build a custom
auth system.

Supported methods at launch:
- Email + password (primary)
- Google OAuth (secondary, "Continue with Google" button)

After a user signs up via Supabase Auth, a Postgres trigger
automatically creates a row in `user_profiles` with the new
`auth.users.id`. This trigger must be written in `schema.sql`.
```sql
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id, full_name)
  values (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name'
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

---

### Onboarding gate (middleware)

Create a Next.js middleware file at `/middleware.ts` that runs on
every request to `/(app)/*` routes. It checks two things:

1. Is the user authenticated? If not → redirect to `/login`
2. Is `onboarding_complete = true`? If not → redirect to
   `/onboarding/step-1`

This ensures no user can skip onboarding or access the app
with an incomplete setup.
```typescript
// middleware.ts logic (pseudocode — Claude writes the full version)
// 1. Get session from Supabase
// 2. If no session → redirect to /login
// 3. If session exists → check user_profiles.onboarding_complete
// 4. If false → redirect to /onboarding/step-1
// 5. If true → allow through to /(app)/*
```

The middleware must use the Supabase server client (cookies-based),
never the browser client.

---

### Step 1 — Create account

Route: `/signup`

What it does:
- Collects full name, work email, password, confirm password
- Calls `supabase.auth.signUp()` with email + password
- Passes `full_name` in `options.data` so the trigger picks it up
- On success → redirect to `/onboarding/step-2`
- Also shows "Continue with Google" button using
  `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Google OAuth redirect must also land at `/onboarding/step-2`
  if onboarding is incomplete

Validation rules (all server-side via Server Action):
- Full name: required, min 2 chars
- Email: valid email format, required
- Password: min 8 chars, at least one number
- Confirm password: must match password

Error handling:
- "Email already in use" → show inline error, link to login
- "Invalid email" → inline field error
- Network errors → toast notification, do not clear form

---

### Step 2 — Business profile

Route: `/onboarding/step-2`

What it does:
- Collects business name, industry (dropdown), city (text)
- Creates a new row in `organisations` with this data
- Updates `user_profiles.org_id` with the new org's id
- On success → redirect to `/onboarding/step-3`

Industry picker UI:
- Render as a 2×3 grid of selectable cards (not a dropdown)
- Each card has an icon, industry name, one-line description
- Selected state: indigo border + light indigo background
- Options:
  - restaurant     → "Recipes, ingredients, daily stock"
  - pharmacy       → "Medicines, batches, expiry tracking"
  - retail         → "SKUs, suppliers, reorder points"
  - hotel          → "Housekeeping, F&B, minibar"
  - manufacturing  → "Raw materials, BOMs, production runs"
  - other          → "Custom setup for your business"

After org is created, immediately seed industry-specific data:
- Call `seedIndustryTemplates(org_id, industry)` server-side
- This inserts default item categories and unit preferences
- See `/lib/utils/industryTemplates.ts` for template data

Seed templates per industry:
- restaurant:    categories = [Dairy, Grains, Vegetables, Oils,
                 Spices, Beverages], units = [g, kg, ml, l, pcs]
- pharmacy:      categories = [Tablets, Syrups, Injections,
                 Surgical, OTC], units = [tabs, ml, vials, strips]
- retail:        categories = [Electronics, Clothing, FMCG,
                 Stationery], units = [pcs, boxes, kg]
- hotel:         categories = [Linen, Toiletries, F&B, Minibar,
                 Cleaning], units = [pcs, ml, kg, sets]
- manufacturing: categories = [Raw Material, Packaging, Finished
                 Goods, Consumables], units = [kg, l, pcs, sheets]
- other:         No categories pre-seeded. Blank slate.

Validation rules:
- Business name: required, min 2 chars, max 80 chars
- Industry: required, must be one of the 6 valid values
- City: optional, max 60 chars

---

### Step 3 — API keys

Route: `/onboarding/step-3`

What it does:
- Collects up to 3 Groq API keys (key 1 required, key 2 and
  key 3 optional but strongly encouraged)
- Collects 1 Gemini API key (required for bill scanning)
- Validates each key format client-side (basic prefix check)
- Sends keys to a Server Action for encryption + storage
- On success → sets `onboarding_complete = true` → redirect
  to `/dashboard`

UI layout:
- Groq section: 3 input fields stacked, labeled
  "Key 1 (required)", "Key 2 (recommended)", "Key 3 (recommended)"
- Each input: password type, placeholder matching key prefix
- Helper text under section: "Get free keys at console.groq.com"
- Link opens in new tab
- Gemini section: 1 input field
- Helper text: "Get free key at aistudio.google.com"
- Security notice banner (indigo light bg):
  "Your keys are encrypted before saving. All AI calls are
   made from our servers. Keys are never visible in your browser."
- "Skip for now" ghost link at the bottom — sets
  `onboarding_complete = true` but leaves keys empty.
  AI features will prompt to add keys later.

Key validation (client-side, before sending to server):
- Groq keys must start with "gsk_"
- Gemini keys must start with "AIza"
- If format wrong → inline error "This doesn't look like a
  valid [Groq/Gemini] key"

Key storage (Server Action — never in API route or client):
```typescript
// /lib/crypto/encryptKey.ts
// Uses Node.js crypto module (AES-256-GCM)
// ENCRYPTION_SECRET is a 32-char env variable (never NEXT_PUBLIC_)
// Returns: iv:authTag:encryptedData as a single string

async function encryptKey(plaintext: string): Promise<string>
async function decryptKey(ciphertext: string): Promise<string>
```

Storage logic:
- Encrypt each Groq key individually
- Store as JSON array: `["enc_key1", "enc_key2", "enc_key3"]`
- Store in `user_settings.groq_keys` (text column)
- Store `groq_key_index = 0` (start at first key)
- Encrypt Gemini key, store in `user_settings.gemini_key`
- Upsert into `user_settings` (create if not exists, update
  if returning to settings later)

Environment variables needed (all server-only, no NEXT_PUBLIC_):
```
ENCRYPTION_SECRET=        # 32 character random string
NEXT_PUBLIC_SUPABASE_URL= # this one is fine as public
NEXT_PUBLIC_SUPABASE_ANON_KEY= # this one is fine as public
SUPABASE_SERVICE_ROLE_KEY= # server only, never expose
```

---

### Auth pages (login + signup)

Route `/login`:
- Email + password form
- "Continue with Google" button
- Link to `/signup`
- On success → middleware handles redirect (dashboard or
  onboarding depending on completion status)
- "Forgot password" link → `/reset-password`
  (Supabase handles the reset email flow)

Route `/signup`:
- Same as Step 1 of onboarding described above

Route `/reset-password`:
- Email input → calls `supabase.auth.resetPasswordForEmail()`
- Supabase sends the reset link automatically
- No custom email logic needed

---

### Session handling rules

- Always use Supabase server client (from `@supabase/ssr`)
  in Server Components, Server Actions, and API routes
- Always use Supabase browser client in Client Components
  (only for auth state listening and realtime — not for data)
- Never pass session tokens manually between client and server
- The `org_id` for any server operation must ALWAYS be read
  from `user_profiles` using `auth.uid()` — never trusted
  from request input
```typescript
// Correct pattern for getting org_id in a Server Action
const supabase = createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error('Unauthenticated')

const { data: profile } = await supabase
  .from('user_profiles')
  .select('org_id')
  .eq('id', user.id)
  .single()

const org_id = profile.org_id
// Now use org_id safely — it came from the DB, not the client
```

---

### Onboarding progress persistence

If a user drops off mid-onboarding (closes browser after step 1),
they must resume where they left off, not restart.

Logic:
- Step 2 complete check: `user_profiles.org_id IS NOT NULL`
- Step 3 complete check: `user_settings` row exists with
  at least one non-null key OR user explicitly skipped
- `onboarding_complete = true` is only set after step 3

Middleware checks `onboarding_complete`. If false, it also
checks which step was last completed and redirects to the
correct step — not always step 1.
```typescript
// Resume logic in middleware (pseudocode)
if (!profile.onboarding_complete) {
  if (!profile.org_id) redirect('/onboarding/step-2')
  // org exists but keys not set
  else redirect('/onboarding/step-3')
}
```

---

### Files Claude Code must create for this module

/app/(auth)/
  login/page.tsx
  signup/page.tsx
  reset-password/page.tsx

/app/(onboarding)/
  layout.tsx          ← step indicator, progress bar
  step-2/page.tsx     ← business profile
  step-3/page.tsx     ← API keys

/app/api/auth/
  callback/route.ts   ← Supabase OAuth callback handler

/lib/supabase/
  client.ts           ← browser client
  server.ts           ← server client (cookies)

/lib/crypto/
  encryptKey.ts       ← AES-256-GCM encrypt + decrypt

/lib/utils/
  industryTemplates.ts ← seed data per industry

/middleware.ts         ← auth gate + onboarding gate

/types/
  auth.ts             ← User, OrgProfile, UserSettings types