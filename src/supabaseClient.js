import { createClient } from '@supabase/supabase-js';

// We use placeholder values if the environment variables are missing
// so the app won't crash during build/dev before they are set.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbyggqsewoxhdbrkuzjt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieWdncXNld294aGRicmt1emp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjA1OTQsImV4cCI6MjA4MzMzNjU5NH0.ouB9HCyqH-p9MXv3ycW8bDH4VKrvqUzsn779FVQ3Nus';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
