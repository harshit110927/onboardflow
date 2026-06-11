'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

async function getRequestOrigin() {
  const headerStore = await headers()
  const origin = headerStore.get('origin')
  if (origin) return origin

  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'https'
  return host ? `${protocol}://${host}` : 'http://localhost:3000'
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const origin = await getRequestOrigin()

  console.log("🔒 Attempting login for:", email)
  console.log("🔗 Redirecting to:", `${origin}/auth/callback`)

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    console.error("❌ Supabase Error:", error.message)
    redirect('/error')
  }

  redirect('/check-email')
}