import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { decryptKey } from '@/lib/crypto/encryptKey'
import OrgSection from '@/app/(app)/settings/OrgSection'
import ApiKeysSection from '@/app/(app)/settings/ApiKeysSection'
import AccountSection from '@/app/(app)/settings/AccountSection'

function last4(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null
  try {
    const plain = decryptKey(encrypted)
    return plain.slice(-4)
  } catch {
    return null
  }
}

export default async function SettingsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, full_name')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) redirect('/onboarding/step-2')
  const org_id = profile.org_id

  const [orgResult, settingsResult] = await Promise.all([
    supabase
      .from('organisations')
      .select('name, industry')
      .eq('id', org_id)
      .single(),
    supabase
      .from('user_settings')
      .select('groq_keys, gemini_key')
      .eq('user_id', user.id)
      .single(),
  ])

  const org = orgResult.data
  const settings = settingsResult.data

  // Decrypt groq_keys JSON array → extract last-4 per slot
  let groqEncArr: (string | null)[] = [null, null, null]
  if (settings?.groq_keys) {
    try {
      groqEncArr = JSON.parse(settings.groq_keys) as (string | null)[]
    } catch {
      // malformed — treat as empty
    }
  }

  const groqLast4: [string | null, string | null, string | null] = [
    last4(groqEncArr[0] ?? null),
    last4(groqEncArr[1] ?? null),
    last4(groqEncArr[2] ?? null),
  ]

  const geminiLast4 = last4(settings?.gemini_key ?? null)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-heading-md font-semibold text-on-surface">Settings</h1>

      <OrgSection
        name={org?.name ?? ''}
        industry={org?.industry ?? 'other'}
      />

      <ApiKeysSection
        groqLast4={groqLast4}
        geminiLast4={geminiLast4}
      />

      <AccountSection
        email={user.email ?? ''}
        fullName={profile.full_name ?? null}
      />
    </div>
  )
}
