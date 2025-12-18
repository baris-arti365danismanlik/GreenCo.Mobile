import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: managerProjects, error: mpError } = await supabase
      .from('project_managers')
      .select('project_id')
      .eq('manager_id', user.id);

    if (mpError) {
      throw mpError;
    }

    const projectIds = managerProjects?.map((mp: any) => mp.project_id) || [];

    if (projectIds.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: assignments, error: assignError } = await supabase
      .from('project_assignments')
      .select(`
        personnel_id,
        project_id,
        projects_greenco!project_assignments_project_id_fkey(name)
      `)
      .in('project_id', projectIds)
      .is('removed_at', null);

    if (assignError) {
      throw assignError;
    }

    const personnelIds = [...new Set(assignments?.map((a: any) => a.personnel_id) || [])];

    if (personnelIds.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: personnelData, error: pError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        avatar_url,
        is_active,
        city,
        district,
        personnel_types(name)
      `)
      .in('id', personnelIds);

    if (pError) {
      throw pError;
    }

    const personnelWithProjects = (personnelData || []).map((p: any) => {
      const projectNames = assignments
        ?.filter((a: any) => a.personnel_id === p.id)
        .map((a: any) => a.projects_greenco?.name)
        .filter(Boolean) || [];

      return {
        ...p,
        projects: projectNames,
        project_ids: assignments
          ?.filter((a: any) => a.personnel_id === p.id)
          .map((a: any) => a.project_id) || [],
      };
    });

    return new Response(
      JSON.stringify({ data: personnelWithProjects }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});