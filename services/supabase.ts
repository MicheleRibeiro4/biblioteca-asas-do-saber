import { createClient } from '@supabase/supabase-js';

// Tenta pegar das variáveis de ambiente da Vercel, senão usa o hardcoded
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://snbzmggzcnvpymabssmg.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuYnptZ2d6Y252cHltYWJzc21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4ODYzNzksImV4cCI6MjA3NzQ2MjM3OX0.rphtwn_q7K_zwgE4Jn5_o4U5GV3mp0l_lZMkOrOX0dU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);