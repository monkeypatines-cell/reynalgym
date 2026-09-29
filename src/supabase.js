import { createClient } from '@supabase/supabase-js'

const supabaseUrl =  'https://aiusnmbfencdedwovqau.supabase.co'
const supabaseKey = 'sb_publishable_lSc9IJ5-yCgdjYVJzxIUag_KX1PMflV'

export const supabase = createClient(supabaseUrl, supabaseKey)