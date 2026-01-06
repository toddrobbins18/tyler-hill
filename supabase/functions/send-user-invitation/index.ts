import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Get the app URL - use the correct Lovable project URL
    const projectId = Deno.env.get('SUPABASE_URL')?.match(/https:\/\/([^.]+)\./)?.[1] || '';
    const appUrl = `https://${projectId}.lovableproject.com`;
    const signupUrl = `${appUrl}/auth?company_id=${targetCompanyId}&email=${encodeURIComponent(email)}`;
    
    console.log('Generated signup URL:', signupUrl);

    // Send invitation email
    console.log('Sending email via Resend to:', email);
    
    const emailResponse = await resend.emails.send({
      from: "Camp Database <onboarding@resend.dev>",
      to: [email],
      subject: "You've been invited to join Camp Database",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to Camp Database!</h1>
          <p>Hi ${fullName},</p>
          <p>You've been invited to join our camp management system with the role of <strong>${role}</strong>.</p>
          <p>To get started, please click the button below to create your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupUrl}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Create Your Account
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${signupUrl}">${signupUrl}</a>
          </p>
          <p style="color: #666; font-size: 14px;">
            After creating your account, an administrator will need to approve your access.
          </p>
          <p>Best regards,<br>The Camp Database Team</p>
        </div>
      `,
    });

    console.log('Resend API response:', JSON.stringify(emailResponse));
    
    // Check if Resend returned an error
    if (emailResponse.error) {
      console.error('Resend email error:', emailResponse.error);
      return new Response(
        JSON.stringify({ error: `Email send failed: ${emailResponse.error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invitation email sent successfully to:', email, 'Email ID:', emailResponse.data?.id);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
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
