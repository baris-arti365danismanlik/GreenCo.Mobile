import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if specific user update requested
    const body = await req.json().catch(() => null);

    if (body && body.email && body.new_password) {
      // Update specific user
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        return new Response(
          JSON.stringify({ success: false, error: listError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const user = users.users.find(u => u.email === body.email);

      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Kullanıcı bulunamadı' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: body.new_password }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Şifre başarıyla güncellendi',
          user_id: user.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Reset all users (original functionality)
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      return new Response(
        JSON.stringify({ error: usersError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = [];
    const newPassword = 'GreenCo2025!';

    for (const user of users.users) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle();

      let correctEmail = user.email;

      if (user.phone) {
        correctEmail = `${user.phone}@greenco.app`;
      } else if (profile?.phone) {
        const phoneNumber = profile.phone.replace('+', '');
        correctEmail = `${phoneNumber}@greenco.app`;
      } else if (user.email && !user.email.includes('@greenco.app')) {
        const phoneFromEmail = user.email.split('@')[0];
        correctEmail = `${phoneFromEmail}@greenco.app`;
      }

      const updateData: any = { password: newPassword };

      if (correctEmail !== user.email) {
        updateData.email = correctEmail;
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        updateData
      );

      if (updateError) {
        results.push({ id: user.id, old_email: user.email, new_email: correctEmail, success: false, error: updateError.message });
      } else {
        results.push({ id: user.id, old_email: user.email, new_email: correctEmail, success: true });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Password reset and email fix completed',
        total: users.users.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});