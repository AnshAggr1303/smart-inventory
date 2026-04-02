// app/(auth)/actions.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

const SignUpSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/\d/, 'Password must contain at least one number'),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type SignUpState = { error: string } | null

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
  }

  // Temporary debug — logs booleans only, never values (Rule S4)
  console.log('[signUpAction] fields received:', {
    hasName: !!raw.full_name,
    hasEmail: !!raw.email,
    hasPassword: !!raw.password,
    hasConfirm: !!raw.confirm_password,
  })

  const result = SignUpSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const { full_name, email, password } = result.data
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  })

  if (error) {
    // Cover all Supabase error variants for "email already exists"
    const msg = error.message.toLowerCase()
    if (
      msg.includes('already registered') ||
      msg.includes('already in use') ||
      msg.includes('already exists') ||
      error.code === 'email_address_already_used'
    ) {
      return {
        error:
          'An account with this email already exists. Log in instead?',
      }
    }
    return { error: 'Sign up failed. Please try again.' }
  }

  redirect('/onboarding/step-2')
}
