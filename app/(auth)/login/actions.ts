'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  console.log("🔒 Attempting login for:", email)
  console.log("🔗 Redirecting to: http://localhost:3000/auth/callback")

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // We are hardcoding this to ensure no ENV variable mistakes
      emailRedirectTo: 'http://localhost:3000/auth/callback', 
    },
  })

  if (error) {
    console.error("❌ Supabase Error:", error.message)
    redirect('/error')
  }

  redirect('/check-email')
}