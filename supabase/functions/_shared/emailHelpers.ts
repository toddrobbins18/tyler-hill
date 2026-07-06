/**
 * Get recipients based on user notification preferences with division filtering
 * This ensures users only get alerts for children in their assigned divisions
 */
export async function getRecipientsForUserPreferences(
  supabase: any,
  notificationType: string,
  companyId: string,
  childDivisionId?: string
): Promise<any[]> {
  console.log(`Getting user preference recipients for ${notificationType}, division: ${childDivisionId}`);
  
  // 1. Get all users who have this notification type enabled
  const { data: preferences, error: prefError } = await supabase
    .from('user_notification_preferences')
    .select('user_id, timing_options, delivery_methods')
    .eq('notification_type', notificationType)
    .eq('company_id', companyId)
    .eq('enabled', true);
  
  if (prefError) {
    console.error('Error fetching user preferences:', prefError);
    return [];
  }
  
  if (!preferences?.length) {
    console.log('No users have this notification type enabled');
    return [];
  }
  
  console.log(`Found ${preferences.length} users with ${notificationType} enabled`);
  
  const eligibleRecipients: any[] = [];
  
  for (const pref of preferences) {
    // 2. Get user's role and profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', pref.user_id)
      .eq('company_id', companyId)
      .maybeSingle();
    
    if (!profile) continue;
    
    // 3. Check user's role to determine access level
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', pref.user_id)
      .eq('company_id', companyId);
    
    const userRoles = roles?.map((r: any) => r.role) || [];
    
    // Admins, staff, and health_center get all notifications (no division filter)
    const hasFullAccess = userRoles.some((r: string) => 
      ['admin', 'staff', 'health_center', 'super_admin'].includes(r)
    );
    
    if (hasFullAccess) {
      eligibleRecipients.push({
        ...profile,
        timing_options: pref.timing_options,
        delivery_methods: pref.delivery_methods
      });
      continue;
    }
    
    // 4. For division-based roles, check if they have access to the child's division
    if (childDivisionId) {
      const hasDivisionRole = userRoles.some((r: string) => 
        ['division_leader', 'specialist', 'viewer'].includes(r)
      );
      
      if (hasDivisionRole) {
        const { data: divisionAccess } = await supabase
          .from('division_permissions')
          .select('id')
          .eq('user_id', pref.user_id)
          .eq('division_id', childDivisionId)
          .eq('can_access', true)
          .maybeSingle();
        
        if (divisionAccess) {
          eligibleRecipients.push({
            ...profile,
            timing_options: pref.timing_options,
            delivery_methods: pref.delivery_methods
          });
        } else {
          console.log(`User ${pref.user_id} doesn't have access to division ${childDivisionId}`);
        }
      }
    } else {
      // No division context (e.g., staff-only events), include the user
      eligibleRecipients.push({
        ...profile,
        timing_options: pref.timing_options,
        delivery_methods: pref.delivery_methods
      });
    }
  }
  
  console.log(`Returning ${eligibleRecipients.length} eligible recipients based on preferences + division access`);
  return eligibleRecipients;
}

const MISSED_MED_EXCLUDED_LEADERSHIP_TAGS = [
  'director',
  'head_of_girls_side',
  'head_of_boys_side',
  'admin_staff',
] as const;

/** Camp admins/directors must not receive every division's missed-med alerts. */
async function userIsExcludedFromMissedMedAlerts(
  supabase: any,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const [{ data: roles }, { data: leadershipTags }] = await Promise.all([
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('company_id', companyId),
    supabase
      .from('user_tags')
      .select('tag')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .in('tag', [...MISSED_MED_EXCLUDED_LEADERSHIP_TAGS]),
  ]);

  const roleList = (roles || []).map((r: { role: string }) => r.role);
  if (roleList.some((role) => role === 'admin' || role === 'super_admin')) {
    return true;
  }
  return (leadershipTags || []).length > 0;
}

/**
 * Get recipients with optional division and sport filtering
 * @param divisionIds - Filter division_leader tag to only these divisions
 * @param sportType - Filter specialist tag to only this sport
 */
export async function getRecipientsForEmailTypeWithFilters(
  supabase: any,
  emailType: string,
  companyId: string,
  filters?: {
    divisionIds?: string[];
    sportType?: string;
  }
): Promise<any[]> {
  console.log(`Getting recipients for ${emailType} with filters:`, filters);
  
  // 1. Get email config
  const { data: config, error: configError } = await supabase
    .from('automated_email_config')
    .select('recipient_tags, enabled')
    .eq('email_type', emailType)
    .eq('company_id', companyId)
    .maybeSingle();
  
  if (configError) {
    console.error('Error fetching email config:', configError);
    return [];
  }
  
  if (!config?.enabled || !config?.recipient_tags?.length) {
    console.log('Email type disabled or no recipient tags configured');
    return [];
  }
  
  // Missed med alerts are always division-scoped division leaders only — never
  // director/admin/nurse tags (prevents camp-wide staff like Victoria from getting every alert).
  const tags =
    emailType === 'missed_medication'
      ? ['division_leader']
      : config.recipient_tags;
  let allRecipients: any[] = [];
  
  // 2. Process each tag with appropriate filtering
  for (const tag of tags) {
    if (tag === 'division_leader') {
      // Division leaders are ALWAYS scoped to their own division(s). Without a
      // division context we must NOT email every division leader, or they would
      // receive alerts for campers outside their division. Skip instead.
      if (!filters?.divisionIds?.length) {
        console.log('Skipping division_leader tag: no division context provided');
        continue;
      }

      // DIVISION-FILTERED: users tagged division_leader with access to the child's division
      console.log(`Filtering division_leader tag by divisions:`, filters.divisionIds);

      const { data: taggedLeaders } = await supabase
        .from('user_tags')
        .select('user_id')
        .eq('tag', 'division_leader')
        .eq('company_id', companyId);

      for (const leader of taggedLeaders || []) {
        if (emailType === 'missed_medication') {
          const excluded = await userIsExcludedFromMissedMedAlerts(
            supabase,
            leader.user_id,
            companyId,
          );
          if (excluded) {
            console.log(
              `Skipping missed med for camp leadership user ${leader.user_id}`,
            );
            continue;
          }
        }

        const { data: permissions } = await supabase
          .from('division_permissions')
          .select('division_id')
          .eq('user_id', leader.user_id)
          .eq('can_access', true)
          .in('division_id', filters.divisionIds);

        if (!permissions?.length) continue;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', leader.user_id)
          .eq('company_id', companyId)
          .maybeSingle();

        if (profile) {
          allRecipients.push(profile);
        }
      }
    } 
    else if (tag === 'specialist') {
      // Specialists are ALWAYS scoped to their assigned sport(s). Without a sport
      // context, skip rather than emailing every specialist.
      if (!filters?.sportType) {
        console.log('Skipping specialist tag: no sport context provided');
        continue;
      }

      // SPORT-FILTERED: Only specialists assigned to this sport
      console.log(`Filtering specialist tag by sport:`, filters.sportType);
      
      const { data: assignments } = await supabase
        .from('specialist_sport_assignments')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('sport', filters.sportType);
      
      if (assignments?.length) {
        const userIds = assignments.map((a: any) => a.user_id);
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
          .eq('company_id', companyId);
        
        if (profiles) {
          allRecipients.push(...profiles);
        }
      }
    }
    else {
      // UNFILTERED TAG: Get all users with this tag (nurses, directors, etc.)
      console.log(`Getting all users with tag:`, tag);
      
      // Also check user_roles, mapping 'nurse' tag to 'health_center' role
      const roleToCheck = tag === 'nurse' ? 'health_center' : tag;
      
      const [tagsResponse, rolesResponse] = await Promise.all([
        supabase
          .from('user_tags')
          .select('user_id')
          .eq('tag', tag)
          .eq('company_id', companyId),
        supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', roleToCheck)
          .eq('company_id', companyId)
      ]);
      
      const userIds = new Set([
        ...(tagsResponse.data?.map((t: any) => t.user_id) || []),
        ...(rolesResponse.data?.map((r: any) => r.user_id) || [])
      ]);
      
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', Array.from(userIds))
          .eq('company_id', companyId);
        
        if (profiles) {
          allRecipients.push(...profiles);
        }
      }
    }
  }
  
  // 3. Remove duplicates based on user ID
  const uniqueRecipients = Array.from(
    new Map(allRecipients.map(r => [r.id, r])).values()
  );
  
  console.log(`Returning ${uniqueRecipients.length} unique recipients`);
  return uniqueRecipients;
}

// Keep backward compatibility - use the new function without filters
export async function getRecipientsForEmailType(
  supabase: any,
  emailType: string,
  companyId?: string
): Promise<any[]> {
  if (!companyId) {
    console.error('Company ID required for email recipients');
    return [];
  }
  return getRecipientsForEmailTypeWithFilters(supabase, emailType, companyId);
}

export async function sendEmailNotifications(
  supabase: any,
  recipients: any[],
  subject: string,
  content: string,
  companyId?: string,
  senderId?: string
): Promise<void> {
  console.log(`Sending email notifications to ${recipients.length} recipients${companyId ? ` in company ${companyId}` : ''}`);
  console.log(`Subject: ${subject}`);
  
  // TODO: Microsoft Graph API integration will go here
  // For now, send in-app messages
  
  if (!recipients.length) {
    console.log('No recipients to send to');
    return;
  }
  
  const messages = recipients.map(recipient => ({
    recipient_id: recipient.id,
    sender_id: senderId || null,
    subject,
    content,
    read: false,
    notification_type: senderId ? 'notification' : 'automated',
    sender_display_name: senderId ? null : 'Camp notification',
  }));

  const BATCH_SIZE = 50;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const insertResult = await supabase.from('messages').insert(batch);
    const insertError = insertResult?.error;
    if (insertError) {
      console.error('Error sending messages:', insertError);
      throw new Error(insertError.message || 'Failed to insert in-app messages');
    }
  }
  
  console.log(`Successfully sent ${messages.length} in-app messages`);

  // --- Real Email Sending via Microsoft 365 ---
  if (!companyId) {
    console.log('No company_id provided, skipping real email sending.');
    return;
  }

  const { data: emailConfig } = await supabase
    .from("company_email_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!emailConfig?.is_configured || emailConfig?.is_active === false) {
    console.log("Email not configured for company, skipping M365 email.");
    return;
  }

  const decryptResult = await supabase.rpc('decrypt_secret', {
    encrypted: emailConfig.m365_client_secret_encrypted,
  });
  const decryptedSecret = decryptResult?.data;
  const decryptError = decryptResult?.error;

  if (decryptError || !decryptedSecret) {
    console.error("Failed to decrypt M365 secret", decryptError);
    return;
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${emailConfig.m365_tenant_id}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: emailConfig.m365_client_id,
        client_secret: decryptedSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData?.access_token) {
    console.error("Failed to get Graph token", tokenData);
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const recipient of recipients) {
    if (!recipient.email || recipient.email === 'no-email@example.com') {
      continue;
    }

    try {
      const emailPayload = {
        message: {
          subject,
          body: {
            contentType: "HTML",
            content: content.replace(/\n/g, "<br>"),
          },
          from: {
            emailAddress: {
              address: emailConfig.m365_sender_email,
              name: emailConfig.m365_sender_name || "Camp Notification",
            },
          },
          toRecipients: [
            {
              emailAddress: {
                address: recipient.email,
                name: recipient.full_name || "",
              },
            },
          ],
        },
      };

      const sendResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${emailConfig.m365_sender_email}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        },
      );

      if (sendResponse.ok) {
        successCount++;
      } else {
        failCount++;
        console.error(`M365 send failed for ${recipient.email}:`, await sendResponse.text());
      }
    } catch (e) {
      failCount++;
      console.error(`Error sending M365 email to ${recipient.email}:`, e);
    }
  }

  console.log(`Successfully sent ${successCount} emails, failed ${failCount}`);
}
