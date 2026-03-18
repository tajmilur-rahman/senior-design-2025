import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ofthvbabxgzsjercdjmo.supabase.co';
const supabaseAnonKey = 'sb_publishable_NCH5Y02VVQmMRmllrstbYA_MAi5AelO'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)