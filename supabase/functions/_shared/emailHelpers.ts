export async function getRecipientsForEmailType(
  supabase: any,
  emailType: string
): Promise<any[]> {
  console.log(`Getting recipients for email type: ${emailType}`);
  
  // Get configuration for this email type
  const { data: config, error: configError } = await supabase
    .from('automated_email_config')
    .select('recipient_tags, enabled')
    .eq('email_type', emailType)
    .single();
  
  if (configError) {
    console.error('Error fetching email config:', configError);
    return [];
  }
  
  if (!config?.enabled || !config?.recipient_tags?.length) {
    console.log('Email type disabled or no recipient tags configured');
    return [];
  }
  
  console.log(`Config found. Recipient tags:`, config.recipient_tags);
  
  // Get all users with any of the specified tags
  const { data: userTags, error: tagsError } = await supabase
    .from('user_tags')
    .select('user_id')
    .in('tag', config.recipient_tags);
  
  if (tagsError) {
    console.error('Error fetching user tags:', tagsError);
    return [];
  }
  
  if (!userTags?.length) {
    console.log('No users found with specified tags');
    return [];
  }
  
  const userIds = [...new Set(userTags.map((t: any) => t.user_id))];
  console.log(`Found ${userIds.length} unique users with tags`);
  
  // Get profiles for these users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds);
  
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }
  
  console.log(`Returning ${profiles?.length || 0} recipient profiles`);
  return profiles || [];
}

export async function sendEmailNotifications(
  supabase: any,
  recipients: any[],
  subject: string,
  content: string
): Promise<void> {
  console.log(`Sending email notifications to ${recipients.length} recipients`);
  console.log(`Subject: ${subject}`);
  
  // TODO: Microsoft Graph API integration will go here
  // For now, send in-app messages
  
  if (!recipients.length) {
    console.log('No recipients to send to');
    return;
  }
  
  const messages = recipients.map(recipient => ({
    recipient_id: recipient.id,
    subject: subject,
    content: content,
    read: false,
  }));
  
  const { error } = await supabase.from('messages').insert(messages);
  
  if (error) {
    console.error('Error sending messages:', error);
    throw error;
  }
  
  console.log(`Successfully sent ${messages.length} in-app messages`);
}
