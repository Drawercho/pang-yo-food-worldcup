import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Restaurant {
  id: number
  name: string
  genre: string
  location: string
  review: string | null
  link: string | null
  category: string
  verified: boolean
  created_at: string
}
