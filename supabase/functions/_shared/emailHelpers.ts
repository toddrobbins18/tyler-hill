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
  
  const tags = config.recipient_tags;
  let allRecipients: any[] = [];
  
  // 2. Process each tag with appropriate filtering
  for (const tag of tags) {
    if (tag === 'division_leader' && filters?.divisionIds?.length) {
      // DIVISION-FILTERED: Only leaders with access to specified divisions
      console.log(`Filtering division_leader tag by divisions:`, filters.divisionIds);
      
      const { data: leaders } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'division_leader')
        .eq('company_id', companyId);
      
      if (leaders?.length) {
        for (const leader of leaders) {
          // Check if leader has permission for any of the event divisions
          const { data: permissions } = await supabase
            .from('division_permissions')
            .select('division_id')
            .eq('user_id', leader.user_id)
            .eq('can_access', true)
            .in('division_id', filters.divisionIds);
          
          if (permissions?.length > 0) {
            // Get profile for this leader
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
      }
    } 
    else if (tag === 'specialist' && filters?.sportType) {
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
      
      const { data: userTags } = await supabase
        .from('user_tags')
        .select('user_id')
        .eq('tag', tag)
        .eq('company_id', companyId);
      
      if (userTags?.length) {
        const userIds = userTags.map((t: any) => t.user_id);
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
  
  const messages = recipients.map(recipient => {
    const message: any = {
      recipient_id: recipient.id,
      sender_id: senderId || null,
      subject: subject,
      content: content,
      read: false,
    };

    if (!senderId) {
      message.sender_display_name = 'Camp notification';
    }
    
    // Add company_id if provided
    if (companyId) {
      message.company_id = companyId;
    }
    
    return message;
  });
  
  const { error } = await supabase.from('messages').insert(messages);
  
  if (error) {
    console.error('Error sending messages:', error);
    throw error;
  }
  
  console.log(`Successfully sent ${messages.length} in-app messages`);
}
