## SECTION 7: AGENT SYSTEM MODULE

---

### Overview

The agent system is the "brain" of Smart Inventory. It runs
three autonomous agents that watch stock data, detect
problems, and propose actions — all without the user having
to ask. Every agent action requires human approval before
anything external happens. Agents never act unilaterally.

The three agents:

1. REORDER AGENT — watches stock levels, drafts purchase
   orders when items hit reorder point
2. SHRINKAGE DETECTIVE — runs weekly variance analysis,
   flags unexplained stock losses
3. DEMAND FORECASTER — analyses consumption patterns,
   predicts future stock needs

All agents share the same infrastructure:
- They read from Supabase (never write directly)
- They create rows in agent_actions (their only write)
- They use the LLM router for reasoning
- They are triggered by events or schedules
- They never send external messages without approval

---

### Agent infrastructure

#### How agents are triggered

Two trigger types:

EVENT-BASED (immediate):
Triggered by specific DB events in the application flow.
These run synchronously inside Server Actions.

- Reorder agent: triggered after every recipe deduction
  that drops an item below reorder_point (Section 6 step 6)
- Reorder agent: triggered after every bill confirmation
  that reveals an item is still below reorder_point
- Shrinkage detective: triggered after every physical
  audit entry is saved

SCHEDULED (background):
Triggered on a time schedule via Vercel Cron Jobs.
These run as API route handlers, not Server Actions.

- Demand forecaster: runs every day at 6:00 AM IST
- Shrinkage detective: runs every Monday at 7:00 AM IST
  (weekly summary regardless of manual audit)
- Reorder agent: runs every day at 8:00 AM IST
  (catches any items that slipped through event triggers)

Vercel Cron config in vercel.json:
```json
{
  "crons": [
    {
      "path": "/api/agents/reorder/run",
      "schedule": "30 2 * * *"
    },
    {
      "path": "/api/agents/shrinkage/run",
      "schedule": "30 1 * * 1"
    },
    {
      "path": "/api/agents/forecast/run",
      "schedule": "30 0 * * *"
    }
  ]
}
```
Note: Vercel cron times are UTC. 2:30 UTC = 8:00 AM IST.
1:30 UTC Monday = 7:00 AM IST Monday.
0:30 UTC = 6:00 AM IST.

#### Deduplication

Before creating any agent_action, always check if a
pending action already exists for the same item and
agent type. Never create duplicate pending actions.
```typescript
// /lib/agents/deduplicateAction.ts

async function pendingActionExists(
  org_id: string,
  agent_type: string,
  item_id: string
): Promise<boolean>
// Queries agent_actions where:
// org_id = org_id AND
// agent_type = agent_type AND
// item_id inside payload->>'item_id' AND
// status = 'pending'
// Returns true if any row found
```

If pending action exists → skip creating a new one.
Do not overwrite or update the existing pending action.

#### Agent action lifecycle
```
created (triggered)
  → pending     (visible in agent panel, awaiting review)
    → approved  (user clicked approve)
      → executed  (system carried out the action)
      → failed    (execution threw an error)
    → rejected  (user clicked reject)
```

Status transitions are append-only updates to the
status column. Never delete agent_action rows.

---

### Agent 1 — Reorder Agent

#### What it does

Watches all items in the org. When an item's current_stock
falls at or below its reorder_point, the agent:
1. Calculates a suggested reorder quantity
2. Identifies the preferred supplier
3. Drafts a purchase order message
4. Creates a pending agent_action for human approval

#### Trigger logic
```typescript
// /lib/agents/reorderAgent.ts

async function runReorderAgent(
  org_id: string,
  triggered_by: 'event' | 'schedule',
  specific_item_id?: string  // if event-triggered for one item
): Promise<{ actions_created: number }>
```

Step 1 — Find items that need reorder:
```typescript
// Query items where:
// current_stock <= reorder_point AND
// reorder_point > 0 AND
// is_archived = false AND
// no pending reorder action already exists
```

Step 2 — For each item needing reorder:
Calculate suggested order quantity using this logic:
```typescript
// Average daily consumption (last 30 days):
const avg_daily = totalConsumed30Days / 30

// Days of stock remaining:
const days_remaining = current_stock / avg_daily

// Suggested order quantity:
// Cover 14 days of consumption + reorder_qty as buffer
// Use reorder_qty if set, otherwise use 14 × avg_daily
const suggested_qty = item.reorder_qty > 0
  ? item.reorder_qty
  : Math.ceil(avg_daily * 14)
```

Step 3 — Get supplier info:
Look up preferred_supplier_id on the item.
If no preferred supplier → use most recent supplier from
transactions for this item.
If still no supplier → leave supplier fields null.

Step 4 — Draft order message using Groq:

Prompt:
```
You are a procurement assistant for a small business.
Draft a short, professional WhatsApp message to order
stock from a supplier.
Item: {item_name}
Quantity needed: {suggested_qty} {unit}
Supplier name: {supplier_name}
Business name: {business_name}

Write only the message text. Keep it under 3 sentences.
Be polite and specific. Use plain text, no formatting.
```

Step 5 — Create agent_action row:
```typescript
{
  org_id,
  agent_type: 'reorder',
  status: 'pending',
  title: `Reorder ${suggested_qty}${unit} ${item_name}`,
  description: `Stock at ${current_stock}${unit},
    reorder point is ${reorder_point}${unit}.
    ${days_remaining.toFixed(1)} days of stock remaining
    at current usage rate.`,
  payload: {
    item_id,
    item_name,
    current_stock,
    reorder_point,
    suggested_qty,
    unit,
    supplier_id,
    supplier_name,
    supplier_phone,
    estimated_cost: suggested_qty * item.cost_per_unit,
    draft_message,         // the Groq-drafted WhatsApp text
    days_remaining,
    avg_daily_consumption
  }
}
```

#### Approval and execution

When user approves a reorder action:

Server Action: approveAgentAction(action_id, org_id)

1. Verify action belongs to org (RLS + explicit check)
2. Verify status is still 'pending' (race condition guard)
3. Update status to 'approved'
4. In Phase 1 — execution means:
   - Create a bill row in 'pending' status with the
     supplier info and expected items pre-filled
   - Show user: "Purchase order created. When stock arrives,
     scan the bill to confirm receipt."
   - Update status to 'executed'
5. In Phase 2 — execution will mean sending WhatsApp
   message via Twilio (not built yet, do not build now)

When user rejects:
- Update status to 'rejected'
- No other action
- The item stays below reorder point — user is aware

User can also edit the draft before approving:
- Edit suggested_qty (number input)
- Edit supplier name (text input)
- Edit draft message (textarea)
- These edits update the payload JSONB before approval
- Do not create a new action — update the existing one's
  payload and a reviewed_note field

---

### Agent 2 — Shrinkage Detective

#### What it does

Every week (and after every physical audit), compares
expected stock (calculated from transactions) against
actual stock (from physical count or current_stock).
Flags items where the variance exceeds a threshold and
reports the total unexplained loss in rupees.

#### Variance calculation
```typescript
// /lib/agents/shrinkageAgent.ts

type VarianceItem = {
  item_id: string
  item_name: string
  expected_qty: number    // sum of all transactions
  actual_qty: number      // current_stock (or audit count)
  variance_qty: number    // expected - actual
  variance_pct: number    // variance / expected × 100
  estimated_loss: number  // variance_qty × cost_per_unit
  unit: string
  is_flagged: boolean     // true if variance_pct > threshold
}

async function runShrinkageAnalysis(
  org_id: string,
  period_days: number = 7
): Promise<{
  total_loss_inr: number
  flagged_items: VarianceItem[]
  all_items: VarianceItem[]
  period_start: string
  period_end: string
}>
```

Flagging threshold:
- Variance > 5% of expected qty → flagged
- Variance > 15% → critical flag
- Items with zero consumption in period → skip
- Items with reorder_qty = 0 (non-tracked) → skip

#### LLM analysis step

After calculating raw variance numbers, send the flagged
items to Groq for pattern analysis:

Prompt:
```
You are an inventory analyst. Analyse this weekly
shrinkage report for a {industry} business and
identify likely causes and recommendations.

Flagged items with unexplained losses:
{JSON.stringify(flagged_items)}

Respond with a JSON object:
{
  "summary": "2-sentence plain English summary",
  "likely_causes": ["cause 1", "cause 2"],
  "recommendations": ["action 1", "action 2"],
  "risk_level": "low" | "medium" | "high"
}
```

Combine the raw numbers + LLM analysis into the
agent_action payload.

#### Agent action created:
```typescript
{
  org_id,
  agent_type: 'shrinkage',
  status: 'pending',
  title: `Shrinkage report: ₹${total_loss_inr} unexplained
    loss this week`,
  description: llm_summary,
  payload: {
    period_start,
    period_end,
    total_loss_inr,
    flagged_items,
    risk_level,
    likely_causes,
    recommendations
  }
}
```

#### Approval means

For shrinkage actions, "approval" means the user has
reviewed and acknowledged the report. No external
action is taken. Status moves to approved → executed
immediately on acknowledgement.

Optional: user can mark specific variance items as
"explained" with a note (e.g. "Spillage during event").
This creates a wastage transaction:
```typescript
{
  type: 'wastage',
  quantity: -(variance_qty),
  note: user_explanation
}
```
This clears the variance for that item going forward.

---

### Agent 3 — Demand Forecaster

#### What it does

Analyses the last 30 days of consumption transactions
per item and predicts how much stock will be needed
in the next 7 and 14 days. Also detects upcoming
demand spikes based on day-of-week and seasonal patterns.

#### Calculation logic
```typescript
// /lib/agents/forecastAgent.ts

type ForecastResult = {
  item_id: string
  item_name: string
  avg_daily_consumption: number
  predicted_7day: number
  predicted_14day: number
  current_stock: number
  days_until_stockout: number
  trend: 'increasing' | 'stable' | 'decreasing'
  spike_detected: boolean
  spike_reason?: string
  recommended_order_qty: number
  unit: string
}

async function runDemandForecast(
  org_id: string
): Promise<ForecastResult[]>
```

Calculation steps:

Step 1 — Get last 30 days of recipe_deduction and
manual_deduction transactions per item grouped by day.

Step 2 — Calculate rolling averages:
```typescript
const avg_daily = total_consumed_30d / 30
const avg_last_7d = total_consumed_7d / 7
const avg_prev_7d = total_consumed_prev7d / 7

// Trend detection
const trend = avg_last_7d > avg_prev_7d * 1.1
  ? 'increasing'
  : avg_last_7d < avg_prev_7d * 0.9
    ? 'decreasing'
    : 'stable'
```

Step 3 — Days until stockout:
```typescript
const days_until_stockout = avg_daily > 0
  ? current_stock / avg_daily
  : Infinity
```

Step 4 — Spike detection (day of week pattern):
```typescript
// Group consumption by day of week (0=Sun, 6=Sat)
// If any day's avg is > 1.5× the weekly avg → spike day
// If today + 3 days includes a spike day → spike_detected
```

Step 5 — Send top 5 at-risk items to Groq for
plain-English summary:

Prompt:
```
You are an inventory advisor for a {industry} business.
Based on this consumption forecast, write a brief
daily briefing (max 3 sentences) about what to watch
out for today and this week.

Forecast data: {JSON.stringify(top_5_at_risk)}

Write only the briefing text. Plain English, no lists,
no formatting.
```

Step 6 — Only create agent_action if actionable:
- At least one item has days_until_stockout < 7, OR
- At least one spike_detected = true
- If nothing urgent → log the forecast but do not
  create a pending action (avoid notification fatigue)

Agent action payload:
```typescript
{
  org_id,
  agent_type: 'demand_forecast',
  status: 'pending',
  title: `Forecast: ${urgent_items} items need attention
    this week`,
  description: llm_briefing,
  payload: {
    forecast_date,
    forecasts: ForecastResult[],
    urgent_items_count,
    spike_items: items where spike_detected = true
  }
}
```

#### Approval means

User reviews the forecast briefing. Acknowledges it.
If they want to act on a recommendation, they can
click "Create reorder" next to any forecast item —
this calls runReorderAgent() for that specific item
immediately rather than waiting for the schedule.

---

### Agent panel UI (shared across all agents)

Route: /app/(app)/agents/page.tsx

Three tabs: Pending | Activity log | Settings

PENDING TAB:
- Shows all agent_actions where status = 'pending'
- Sorted by triggered_at descending
- Each action card shows:
  - Agent type badge (color coded:
    reorder=indigo, shrinkage=amber, forecast=teal)
  - Title + description
  - Key numbers from payload (formatted, not raw JSON)
  - Approve / Reject buttons (reorder + forecast)
  - Acknowledge button (shrinkage)
  - "Edit details" expander for reorder actions

ACTIVITY LOG TAB:
- Shows all agent_actions regardless of status
- Filter by: agent type, status, date range
- Each row: agent badge + title + status chip + timestamp
- Expandable row shows full payload details

SETTINGS TAB:
- Toggle each agent on/off per org
  (stored in organisations table as agent_config JSONB)
- Set shrinkage threshold (default 5%, adjustable 1-20%)
- Set forecast horizon (7 days or 14 days)
- Set reorder lead time days (used in suggested qty calc)
- Notification preferences (email/push per agent type)

---

### Agent config storage

Add agent_config column to organisations table:
```sql
alter table organisations
add column agent_config jsonb default '{
  "reorder_enabled": true,
  "shrinkage_enabled": true,
  "forecast_enabled": true,
  "shrinkage_threshold_pct": 5,
  "forecast_horizon_days": 7,
  "reorder_lead_time_days": 3
}'::jsonb;
```

---

### Security rules for agents

- Cron endpoints (/api/agents/*/run) must verify the
  request is from Vercel Cron using the
  CRON_SECRET header. Reject all other requests.
```typescript
  if (req.headers.get('authorization') !==
      `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' },
      { status: 401 })
  }
```
- Agents only read and write data for their own org.
  org_id is always read from the DB, never from the
  cron request body.
- The cron job runs for ALL orgs that have the agent
  enabled. Loop through orgs inside the handler.
  Never expose one org's data to another.

---

### Files Claude Code must create for this module

/app/api/agents/
  reorder/run/route.ts      ← cron + event endpoint
  shrinkage/run/route.ts    ← cron + event endpoint
  forecast/run/route.ts     ← cron endpoint

/app/(app)/agents/
  page.tsx                  ← agent panel, 3 tabs
  actions.ts                ← approve, reject, acknowledge
  ActionCard.tsx            ← single action card component
  AgentSettings.tsx         ← settings tab component

/lib/agents/
  reorderAgent.ts           ← reorder logic
  shrinkageAgent.ts         ← variance calculation
  forecastAgent.ts          ← demand forecasting
  deduplicateAction.ts      ← prevent duplicate actions
  errors.ts                 ← agent-specific error classes

vercel.json                 ← cron job configuration