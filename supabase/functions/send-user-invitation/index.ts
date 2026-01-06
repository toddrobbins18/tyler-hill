import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin or super_admin
    const { data: rolesData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError) {
      console.error('Failed to fetch user roles:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roles = rolesData?.map(r => r.role) || [];
    const isAdmin = roles.includes('admin') || roles.includes('super_admin');

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, fullName, role, companyId } = await req.json();

    console.log('Sending invitation to:', email, 'for company:', companyId);

    // Get admin's company if not provided
    let targetCompanyId = companyId;
    if (!targetCompanyId) {
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      targetCompanyId = adminProfile?.company_id;
    }

    // Get the app URL for redirect
    const projectId = Deno.env.get('SUPABASE_URL')?.match(/https:\/\/([^.]+)\./)?.[1] || '';
    const redirectUrl = `https://${projectId}.lovableproject.com/auth?company_id=${targetCompanyId}`;
    
    console.log('Using redirect URL:', redirectUrl);

    // Use Supabase Auth's built-in invite functionality
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        full_name: fullName,
        invited_role: role,
        company_id: targetCompanyId,
      }
    });

    if (inviteError) {
      console.error('Supabase invite error:', inviteError);
      
      // Check for existing user error
      if (inviteError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ 
            error: `${email} already has an account. They can log in directly at the portal.`,
            code: 'user_exists'
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to send invitation: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invitation sent successfully to:', email, 'User ID:', inviteData.user?.id);

    return new Response(
      JSON.stringify({ success: true, userId: inviteData.user?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-user-invitation function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
