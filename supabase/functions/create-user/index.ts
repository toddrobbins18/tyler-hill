import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const ALLOWED_ROLES = new Set([
  'admin',
  'staff',
  'viewer',
  'division_leader',
  'specialist',
  'health_center',
  'super_admin',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResponse({ error: 'Missing Authorization header. You must be signed in.' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify the caller is an admin or super_admin.
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: authError?.message ?? 'Unauthorized. Sign in again and retry.' }, 401);
    }

    const { data: rolesData, error: rolesErr } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (rolesErr) {
      console.error('user_roles lookup failed:', rolesErr);
      return jsonResponse({ error: 'Could not verify your role. Try again.' }, 500);
    }
    const roles = (rolesData ?? []).map((r: { role?: string }) => String(r?.role ?? '').toLowerCase());
    const isAdmin = roles.includes('admin') || roles.includes('super_admin');
    if (!isAdmin) {
      return jsonResponse(
        { error: 'Forbidden: your account must have Admin or Super Admin role. Add a user_roles row for this user.' },
        403
      );
    }

    let body: { email?: string; password?: string; fullName?: string; role?: string; companyId?: string };
    try {
      body = await req.json();
    } catch (_) {
      return jsonResponse({ error: 'Invalid request body. Send JSON with email, password, fullName, role, and optionally companyId.' }, 400);
    }
    const { email, password, fullName, role, companyId } = body ?? {};
    const normalizedRole = String(role ?? '').trim().toLowerCase();

    console.log('Creating user:', { email, fullName, role, companyId });

    // Get admin's company if companyId not provided
    let targetCompanyId = companyId;
    if (!targetCompanyId) {
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      targetCompanyId = adminProfile?.company_id;
    }
    if (!targetCompanyId) {
      return jsonResponse(
        { error: 'No company selected. Select a camp first, or ensure your profile has a company assigned.' },
        400
      );
    }

    if (!email?.trim() || !password || !fullName?.trim()) {
      return jsonResponse({ error: 'Email, password, and full name are required.' }, 400);
    }

    if (!ALLOWED_ROLES.has(normalizedRole)) {
      return jsonResponse({ error: `Invalid role: ${role}` }, 400);
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        company_id: targetCompanyId,
        approved: true,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return jsonResponse({ error: createError.message || 'Failed to create user' }, 400);
    }

    console.log('User created:', newUser.user.id);

    // Ensure profile exists and is approved (trigger may create it).
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        full_name: fullName,
        email,
        approved: true,
        company_id: targetCompanyId,
      }, { onConflict: 'id' });

    // Assign role (upsert in case a trigger left a placeholder row)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        {
          user_id: newUser.user.id,
          role: normalizedRole,
          company_id: targetCompanyId,
        },
        { onConflict: 'user_id,company_id' },
      );

    if (roleError) {
      console.error('Error assigning role:', roleError);
      return jsonResponse(
        { error: `Role assignment failed: ${roleError.message}. Check that the role is valid (staff/admin/viewer/etc).` },
        400
      );
    }

    console.log('Role assigned');
    return jsonResponse({ success: true, user: newUser.user }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in create-user function:', error);
    return jsonResponse({ error: message || 'Create user failed.' }, 500);
  }
});
