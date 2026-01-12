
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
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function deactivateProjects() {
    const targetProjects = ['TestTeknikProje1', 'TestTeknikProje'];
    console.log(`Deactivating projects: ${targetProjects.join(', ')}...`);

    const { data, error } = await supabase
        .from('projects_greenco')
        .update({ is_active: false })
        .in('name', targetProjects)
        .select();

    if (error) {
        console.error('Error deactivating projects:', error);
    } else {
        console.log('Successfully deactivated projects:', JSON.stringify(data, null, 2));
    }
}

deactivateProjects();
