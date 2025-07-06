import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'https://fsdomiwtzdhkxwpbbznc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZG9taXd0emRoa3h3cGJiem5jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTgwMzIwMCwiZXhwIjoyMDY3Mzc5MjAwfQ.e0QzYktM4dCkX7CM2l3LoF5laj28Fg_ceDdeX4W34gw'
)
