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
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json();
    let companies = [];

    if (body.companies && Array.isArray(body.companies)) {
      for (const companyData of body.companies) {
        const { data: newCompany, error: insertError } = await supabaseAdmin
          .from('technical_service_companies')
          .insert({
            company_name: companyData.company_name,
            tax_number: companyData.tax_number,
            phone: companyData.phone,
            email: companyData.email,
            location_city: companyData.location_city,
            location_district: companyData.location_district,
            bank_name: companyData.bank_name,
            bank_account_holder: companyData.bank_account_holder,
            iban: companyData.iban,
          })
          .select('id, company_name, phone, email, location_city, location_district')
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: insertError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        if (companyData.specialty_ids && companyData.specialty_ids.length > 0) {
          const specialties = companyData.specialty_ids.map((typeId: string) => ({
            company_id: newCompany.id,
            service_type_id: typeId,
          }));

          const { error: specialtiesError } = await supabaseAdmin
            .from('technical_service_company_specialties')
            .insert(specialties);

          if (specialtiesError) {
            return new Response(
              JSON.stringify({ success: false, error: specialtiesError.message }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }

        if (companyData.authorized_brands) {
          const authorizedBrandRecords = [];
          for (const serviceTypeId of Object.keys(companyData.authorized_brands)) {
            for (const brandId of companyData.authorized_brands[serviceTypeId]) {
              authorizedBrandRecords.push({
                company_id: newCompany.id,
                service_type_id: serviceTypeId,
                brand_id: brandId,
              });
            }
          }

          if (authorizedBrandRecords.length > 0) {
            const { error: brandsError } = await supabaseAdmin
              .from('technical_company_authorized_brands')
              .insert(authorizedBrandRecords);

            if (brandsError) {
              return new Response(
                JSON.stringify({ success: false, error: brandsError.message }),
                {
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          }
        }

        companies.push({ ...newCompany, password: companyData.password });
      }
    } else {
      const { data: existingCompanies, error: companiesError } = await supabaseAdmin
        .from('technical_service_companies')
        .select('id, company_name, phone, email, location_city, location_district')
        .eq('is_active', true)
        .order('company_name');

      if (companiesError) {
        return new Response(
          JSON.stringify({ error: companiesError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      companies = existingCompanies || [];
    }

    const results = [];
    const errors = [];

    for (const company of companies || []) {
      try {
        // Format phone to E.164
        let phoneFormatted = company.phone;
        if (!phoneFormatted.startsWith('+')) {
          if (phoneFormatted.startsWith('0')) {
            phoneFormatted = '+90' + phoneFormatted.substring(1);
          } else {
            phoneFormatted = '+90' + phoneFormatted;
          }
        }

        // Generate email from phone
        const email = `${phoneFormatted.replace('+', '')}@greenco.app`;

        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users.some(u => u.email === email);

        if (userExists) {
          results.push({
            company_name: company.company_name,
            phone: phoneFormatted,
            status: 'skipped',
            message: 'User already exists',
          });
          continue;
        }

        // Create user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: company.password || 'GreenCo2025!',
          email_confirm: true,
          user_metadata: {
            full_name: company.company_name,
          },
          app_metadata: {
            role: 'technical_company',
            technical_company_id: company.id,
          },
        });

        if (authError) {
          errors.push({
            company_name: company.company_name,
            phone: phoneFormatted,
            error: authError.message,
          });
          continue;
        }

        // Update profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: company.company_name,
            phone: phoneFormatted,
            city: company.location_city,
            district: company.location_district,
            role: 'technical_company',
            technical_company_id: company.id,
            is_active: true,
          })
          .eq('id', authData.user.id);

        if (profileError) {
          errors.push({
            company_name: company.company_name,
            phone: phoneFormatted,
            error: profileError.message,
          });
          continue;
        }

        results.push({
          company_name: company.company_name,
          phone: phoneFormatted,
          status: 'created',
          user_id: authData.user.id,
        });
      } catch (error) {
        errors.push({
          company_name: company.company_name,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Technical company users creation completed',
        total_companies: companies?.length || 0,
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: errors.length,
        results,
        errors,
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