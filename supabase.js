// supabase.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://tgrvpuxyuwbphowcgzue.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncnZwdXh5dXdicGhvd2NnenVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MDI4MjIsImV4cCI6MjA2MTA3ODgyMn0.IWyKpGeW8aJ3UWCqMm_m3D-nr9KFivDkOzLcAXSfGsY'; // Replace with your public anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
