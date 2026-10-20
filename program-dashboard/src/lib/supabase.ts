import { createClient } from '@supabase/supabase-js'

// Config comes from .env.local (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
// The publishable/anon key is safe to ship in the browser bundle. The app
// still runs fully offline (localStorage) when these are absent.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseEnabled = Boolean(url && key)

export const supabase = supabaseEnabled ? createClient(url!, key!) : null
