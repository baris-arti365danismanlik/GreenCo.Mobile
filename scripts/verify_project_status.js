
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
        }
    });
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables');
    console.log('Available env vars:', Object.keys(process.env));
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
        console.log('Found Projects in projects_greenco:', JSON.stringify(projects, null, 2));
    }

    // 2. Check Requests
    const { data: requests, error: requestError } = await supabase
        .from('personnel_requests')
        .select('id, project_name, status, is_new_project, created_at, approved_at, project_id')
        .eq('project_name', 'TestTeknikProje1')
        .order('created_at', { ascending: false });

    if (requestError) {
        console.error('Error fetching requests:', requestError);
    } else {
        console.log('Found Requests in personnel_requests:', JSON.stringify(requests, null, 2));
    }
}

checkProjectStatus();
