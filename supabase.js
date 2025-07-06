import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'https://fsdomiwtzdhkxwpbbznc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZG9taXd0emRoa3h3cGJiem5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4MDMyMDAsImV4cCI6MjA2NzM3OTIwMH0.sePUOzZzO3A2qmjozyFHtNbnqWgQqPJyXzO0helr8UQ'
)
