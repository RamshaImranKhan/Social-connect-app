import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fhqrusvmemfjbvnmsorn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocXJ1c3ZtZW1mamJ2bm1zb3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNjM1NzIsImV4cCI6MjA2ODkzOTU3Mn0.blNBiH7J10qlGVrpRTL8_8OdAVTJOXV7r2K3qTb0ptM'; // Copy the full anon key from your Supabase dashboard
export const supabase = createClient(supabaseUrl, supabaseKey);



