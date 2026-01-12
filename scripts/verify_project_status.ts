
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkProjectStatus() {
    console.log('Checking project status for "TestTeknikProje1"...');

    // 1. Check Project Record
    const { data: projects, error: projectError } = await supabase
        .from('projects_greenco')
        .select('*')
        .eq('name', 'TestTeknikProje1');

    if (projectError) {
        console.error('Error fetching project:', projectError);
    } else {
        console.log('Found Projects:', projects);
    }

    // 2. Check Requests
    const { data: requests, error: requestError } = await supabase
        .from('personnel_requests')
        .select('id, project_name, status, is_new_project, created_at, approved_at')
        .eq('project_name', 'TestTeknikProje1')
        .order('created_at', { ascending: false });

    if (requestError) {
        console.error('Error fetching requests:', requestError);
    } else {
        console.log('Found Requests:', requests);
    }
}

checkProjectStatus();
