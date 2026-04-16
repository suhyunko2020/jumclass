import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Database 타입은 `npx supabase gen types typescript` 로 자동 생성 권장
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
