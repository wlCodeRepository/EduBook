import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey && !String(url).includes('your-project-ref'))
export const supabase = createClient(
  url || 'https://invalid-placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
