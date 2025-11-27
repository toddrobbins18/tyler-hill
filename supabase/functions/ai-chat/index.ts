import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Data type to menu item mapping for permission checks
const dataTypeToMenuItemMap: Record<string, string> = {
  campers: 'roster',
  staff: 'staff',
  incidents: 'incidents',
  health: 'nurse',
  notes: 'notes',
  awards: 'awards',
  activities: 'activities',
  'sports-academy': 'sports-academy',
  'sports-calendar': 'sports-calendar',
  tutoring: 'tutoring-therapy',
  menu: 'menu',
  transportation: 'transportation',
};

interface UserContext {
  userId: string;
  companyId: string;
  roles: string[];
  divisionIds: string[] | null;
  isSuperAdmin: boolean;
  allowedMenuItems: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, viewingCompanyId } = await req.json();
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user context
    const userContext = await getUserContext(supabase, user.id, viewingCompanyId);

    if (!userContext.companyId) {
      throw new Error('User has no company assigned');
    }

    console.log('User Context:', {
      userId: userContext.userId,
      companyId: userContext.companyId,
      roles: userContext.roles,
      isSuperAdmin: userContext.isSuperAdmin,
      hasRestrictions: !!userContext.divisionIds,
      allowedMenuItems: userContext.allowedMenuItems
    });

    // Define tools for the AI
    const tools = [
      {
        type: "function",
        function: {
          name: "search_campers",
          description: "Search for campers by name, division, or group. If query is empty, lists recent campers.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Optional search term for camper name. Leave empty to list campers." },
              division: { type: "string", description: "Optional division name filter" },
              group: { type: "string", description: "Optional group name filter" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_all_campers",
          description: "Get a sample list of all campers (limited to 20) for overview purposes",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of campers to return (default 20, max 50)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_divisions",
          description: "Get all available divisions in the camp",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_campers_by_division",
          description: "List all campers in a specific division",
          parameters: {
            type: "object",
            properties: {
              division: { type: "string", description: "Division name or ID" }
            },
            required: ["division"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_campers_by_group",
          description: "Get all campers in a specific group",
          parameters: {
            type: "object",
            properties: {
              group: { type: "string", description: "Group name" }
            },
            required: ["group"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_staff",
          description: "Search for staff members by name, role, or department. If query is empty, lists staff.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Optional search term for staff name. Leave empty to list staff." },
              role: { type: "string", description: "Optional role filter" },
              department: { type: "string", description: "Optional department filter" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_all_staff",
          description: "Get a sample list of all staff members (limited to 20) for overview purposes",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Number of staff to return (default 20, max 50)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_staff_by_department",
          description: "Get all staff members in a specific department",
          parameters: {
            type: "object",
            properties: {
              department: { type: "string", description: "Department name" }
            },
            required: ["department"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_incidents",
          description: "Search incident reports by date range, type, or severity",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: "Optional start date (YYYY-MM-DD)" },
              endDate: { type: "string", description: "Optional end date (YYYY-MM-DD)" },
              type: { type: "string", description: "Optional incident type" },
              severity: { type: "string", description: "Optional severity level" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_todays_events",
          description: "Get all events scheduled for today or a specific date",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Optional date (YYYY-MM-DD), defaults to today" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_health_admissions",
          description: "Get health center admissions for a date range",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: "Optional start date (YYYY-MM-DD)" },
              endDate: { type: "string", description: "Optional end date (YYYY-MM-DD)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_stats",
          description: "Get general statistics about campers, staff, or events",
          parameters: {
            type: "object",
            properties: {
              statsType: { 
                type: "string", 
                description: "Type of stats: 'campers', 'staff', 'incidents', 'events'" 
              }
            },
            required: ["statsType"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_awards",
          description: "Get awards for campers, can filter by camper name or award type",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Optional search term for camper name or award title" },
              category: { type: "string", description: "Optional award category filter" },
              limit: { type: "number", description: "Number of awards to return (default 20)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_daily_notes",
          description: "Get daily notes for campers, can filter by date or camper name",
          parameters: {
            type: "object",
            properties: {
              camper_name: { type: "string", description: "Optional camper name to filter by" },
              date: { type: "string", description: "Optional date (YYYY-MM-DD) to filter by" },
              limit: { type: "number", description: "Number of notes to return (default 20)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_medications",
          description: "Get medication schedules and logs for campers",
          parameters: {
            type: "object",
            properties: {
              camper_name: { type: "string", description: "Optional camper name to filter by" },
              date: { type: "string", description: "Optional date (YYYY-MM-DD) to filter by" },
              medication_name: { type: "string", description: "Optional medication name to filter by" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_menu",
          description: "Get menu items for a specific date or meal type",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Optional date (YYYY-MM-DD), defaults to today" },
              meal_type: { type: "string", description: "Optional meal type filter (breakfast, lunch, dinner, snack)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_trips",
          description: "Get trips and transportation schedules",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Optional date (YYYY-MM-DD) to filter by" },
              destination: { type: "string", description: "Optional destination to filter by" },
              type: { type: "string", description: "Optional trip type to filter by" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_sports_events",
          description: "Get sports events for a date range",
          parameters: {
            type: "object",
            properties: {
              start_date: { type: "string", description: "Optional start date (YYYY-MM-DD)" },
              end_date: { type: "string", description: "Optional end date (YYYY-MM-DD)" },
              sport_type: { type: "string", description: "Optional sport type filter" },
              division: { type: "string", description: "Optional division filter" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_special_events",
          description: "Get special events and activities",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Optional date (YYYY-MM-DD)" },
              event_type: { type: "string", description: "Optional event type filter" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_tutoring_therapy",
          description: "Get tutoring and therapy sessions for campers",
          parameters: {
            type: "object",
            properties: {
              camper_name: { type: "string", description: "Optional camper name to filter by" },
              service_type: { type: "string", description: "Optional service type filter" },
              instructor: { type: "string", description: "Optional instructor name to filter by" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_sports_academy",
          description: "Get sports academy enrollments",
          parameters: {
            type: "object",
            properties: {
              camper_name: { type: "string", description: "Optional camper name to filter by" },
              sport_name: { type: "string", description: "Optional sport name to filter by" },
              instructor: { type: "string", description: "Optional instructor name to filter by" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_calendar_events",
          description: "Get all calendar events for a date range",
          parameters: {
            type: "object",
            properties: {
              start_date: { type: "string", description: "Optional start date (YYYY-MM-DD)" },
              end_date: { type: "string", description: "Optional end date (YYYY-MM-DD)" },
              event_type: { type: "string", description: "Optional event type filter" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_special_meals",
          description: "Get special meal information",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Optional date (YYYY-MM-DD)" },
              meal_type: { type: "string", description: "Optional meal type filter" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_camper_reports",
          description: "Get evaluation reports for campers",
          parameters: {
            type: "object",
            properties: {
              camper_name: { type: "string", description: "Optional camper name to filter by" },
              report_type: { type: "string", description: "Optional report type filter" },
              date: { type: "string", description: "Optional date (YYYY-MM-DD)" }
            }
          }
        }
      }
    ];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // System prompt with permission context
    const systemPrompt = `You are a helpful AI assistant for a camp management system. 
You help users find information about campers, staff, incidents, events, and other camp data.

User's current access level:
- Company: ${userContext.companyId}
- Roles: ${userContext.roles.join(', ')}
- Super Admin: ${userContext.isSuperAdmin ? 'Yes' : 'No'}
${userContext.divisionIds ? `- Restricted to divisions: ${userContext.divisionIds.join(', ')}` : '- Access to all divisions'}

Important guidelines:
- Only search for and provide data that the user has permission to access
- If the user asks for data they cannot access, politely explain the limitation
- Be concise and helpful in your responses
- Format data in a clear, easy-to-read way

Tool usage tips:
- When users ask to "show", "list", or "find" without specific names, use list_all_campers or list_all_staff
- search_campers and search_staff can work without a query - they'll list recent records
- Use get_divisions first if users ask about divisions or groups
- For "all campers in [division]", use list_campers_by_division
- For "all staff in [department]", use get_staff_by_department
- Always check if you have permission before attempting to access data

Available data tools:
- Awards: get_awards - search camper awards and achievements
- Daily Notes: get_daily_notes - view daily camper notes and observations
- Medications: get_medications - check medication schedules and logs
- Menu: get_menu - see meal plans and menu items
- Trips: get_trips - view transportation and trip schedules
- Sports: get_sports_events - get sports calendar and games
- Special Events: get_special_events - see special activities and events
- Tutoring: get_tutoring_therapy - view tutoring and therapy sessions
- Sports Academy: get_sports_academy - check sports academy enrollments
- Calendar: get_calendar_events - get master calendar events
- Special Meals: get_special_meals - view special meal information
- Reports: get_camper_reports - access camper evaluation reports`;

    let conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    let shouldContinue = true;
    let iterations = 0;
    const maxIterations = 5;

    while (shouldContinue && iterations < maxIterations) {
      iterations++;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: conversationMessages,
          tools: tools,
          stream: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('AI service credits depleted. Please contact support.');
        }
        throw new Error('AI service error');
      }

      const data = await response.json();
      const message = data.choices[0].message;

      conversationMessages.push(message);

      // Check if AI wants to use tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`AI requested ${message.tool_calls.length} tool call(s)`);
        
        // Execute all tool calls
        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          console.log(`Executing tool: ${functionName}`, { args, userContext: userContext.userId });

          let result;
          try {
            result = await executeToolCall(supabase, userContext, functionName, args);
            console.log(`Tool ${functionName} completed:`, { 
              success: !result.error, 
              resultSize: JSON.stringify(result).length 
            });
          } catch (error) {
            console.error(`Tool ${functionName} failed:`, error);
            result = { error: error instanceof Error ? error.message : 'Unknown error' };
          }

          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      } else {
        // No more tool calls, we have the final response
        console.log('AI provided final response (no more tool calls)');
        shouldContinue = false;
      }
    }

    // Get the final message
    const finalMessage = conversationMessages[conversationMessages.length - 1];

    return new Response(
      JSON.stringify({ 
        message: finalMessage.content || "I apologize, but I couldn't generate a response." 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function getUserContext(supabase: any, userId: string, viewingCompanyId?: string): Promise<UserContext> {
  // Get profile with company
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('Profile not found');
  }

  // Get user roles
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const roles = rolesData?.map((r: any) => r.role) || [];
  const isSuperAdmin = roles.includes('super_admin');

  // For super admins, use the viewing company if provided
  let effectiveCompanyId = profile.company_id;
  if (isSuperAdmin && viewingCompanyId) {
    // Validate that the viewing company exists and is active
    const { data: viewingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('id', viewingCompanyId)
      .eq('is_active', true)
      .single();
    
    if (viewingCompany) {
      effectiveCompanyId = viewingCompanyId;
    }
  }

  // Get division permissions (only for non-admin/specialist roles)
  let divisionIds: string[] | null = null;
  if (!isSuperAdmin && !roles.includes('admin') && !roles.includes('staff') && !roles.includes('specialist')) {
    const { data: divisionData } = await supabase
      .from('division_permissions')
      .select('division_id')
      .eq('user_id', userId)
      .eq('can_access', true);

    if (divisionData && divisionData.length > 0) {
      divisionIds = divisionData.map((d: any) => d.division_id);
    }
  }

  // Get allowed menu items from role_permissions using effective company
  const { data: permissionsData } = await supabase
    .from('role_permissions')
    .select('menu_item')
    .eq('company_id', effectiveCompanyId)
    .in('role', roles)
    .eq('can_access', true);

  const allowedMenuItems = permissionsData?.map((p: any) => p.menu_item) || [];

  return {
    userId,
    companyId: effectiveCompanyId,
    roles,
    divisionIds,
    isSuperAdmin,
    allowedMenuItems
  };
}

function canAccessDataType(userContext: UserContext, dataType: string): boolean {
  const menuItem = dataTypeToMenuItemMap[dataType];
  return userContext.isSuperAdmin || userContext.allowedMenuItems.includes(menuItem);
}

async function executeToolCall(
  supabase: any, 
  userContext: UserContext, 
  functionName: string, 
  args: any
): Promise<any> {
  
  switch (functionName) {
    case 'search_campers': {
      if (!canAccessDataType(userContext, 'campers')) {
        return { error: 'You do not have permission to access camper information.' };
      }

      console.log(`search_campers: query="${args.query || ''}", division="${args.division || ''}", group="${args.group || ''}"`);

      let query = supabase
        .from('children')
        .select('id, name, age, gender, division_id, group_name, allergies, medical_notes')
        .eq('company_id', userContext.companyId);

      // If no query provided, just list first 10 campers
      if (args.query && args.query.trim() !== '') {
        query = query.ilike('name', `%${args.query}%`);
      }

      // Apply division filter if user is restricted
      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('division_id', userContext.divisionIds);
      }

      if (args.division) {
        query = query.ilike('division_id', `%${args.division}%`);
      }

      if (args.group) {
        query = query.ilike('group_name', `%${args.group}%`);
      }

      const { data, error } = await query.order('name').limit(10);

      if (error) {
        console.error('search_campers error:', error);
        throw error;
      }
      
      console.log(`search_campers: Found ${data?.length || 0} campers`);
      return { campers: data || [] };
    }

    case 'list_all_campers': {
      if (!canAccessDataType(userContext, 'campers')) {
        return { error: 'You do not have permission to access camper information.' };
      }

      const limit = Math.min(args.limit || 20, 50);
      console.log(`list_all_campers: limit=${limit}`);

      let query = supabase
        .from('children')
        .select('id, name, age, gender, division_id, group_name')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('division_id', userContext.divisionIds);
      }

      const { data, error } = await query.order('name').limit(limit);

      if (error) {
        console.error('list_all_campers error:', error);
        throw error;
      }
      
      console.log(`list_all_campers: Found ${data?.length || 0} campers`);
      return { campers: data || [], total: data?.length || 0 };
    }

    case 'get_divisions': {
      if (!canAccessDataType(userContext, 'campers')) {
        return { error: 'You do not have permission to access division information.' };
      }

      console.log('get_divisions: Fetching divisions');

      let query = supabase
        .from('divisions')
        .select('id, name, gender, sort_order')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('id', userContext.divisionIds);
      }

      const { data, error } = await query.order('sort_order');

      if (error) {
        console.error('get_divisions error:', error);
        throw error;
      }
      
      console.log(`get_divisions: Found ${data?.length || 0} divisions`);
      return { divisions: data || [] };
    }

    case 'list_campers_by_division': {
      if (!canAccessDataType(userContext, 'campers')) {
        return { error: 'You do not have permission to access camper information.' };
      }

      console.log(`list_campers_by_division: division="${args.division}"`);

      let query = supabase
        .from('children')
        .select('id, name, age, gender, division_id, group_name')
        .eq('company_id', userContext.companyId);

      // Try to match division by ID or name
      query = query.or(`division_id.eq.${args.division},division_id.ilike.%${args.division}%`);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('division_id', userContext.divisionIds);
      }

      const { data, error } = await query.order('name').limit(30);

      if (error) {
        console.error('list_campers_by_division error:', error);
        throw error;
      }
      
      console.log(`list_campers_by_division: Found ${data?.length || 0} campers`);
      return { campers: data || [], division: args.division };
    }

    case 'get_campers_by_group': {
      if (!canAccessDataType(userContext, 'campers')) {
        return { error: 'You do not have permission to access camper information.' };
      }

      console.log(`get_campers_by_group: group="${args.group}"`);

      let query = supabase
        .from('children')
        .select('id, name, age, gender, division_id, group_name')
        .eq('company_id', userContext.companyId)
        .ilike('group_name', `%${args.group}%`);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('division_id', userContext.divisionIds);
      }

      const { data, error } = await query.order('name').limit(30);

      if (error) {
        console.error('get_campers_by_group error:', error);
        throw error;
      }
      
      console.log(`get_campers_by_group: Found ${data?.length || 0} campers`);
      return { campers: data || [], group: args.group };
    }

    case 'search_staff': {
      if (!canAccessDataType(userContext, 'staff')) {
        return { error: 'You do not have permission to access staff information.' };
      }

      console.log(`search_staff: query="${args.query || ''}", role="${args.role || ''}", department="${args.department || ''}"`);

      let query = supabase
        .from('staff')
        .select('id, name, role, department, email, phone')
        .eq('company_id', userContext.companyId);

      // If no query provided, just list first 10 staff
      if (args.query && args.query.trim() !== '') {
        query = query.ilike('name', `%${args.query}%`);
      }

      if (args.role) {
        query = query.ilike('role', `%${args.role}%`);
      }

      if (args.department) {
        query = query.ilike('department', `%${args.department}%`);
      }

      const { data, error } = await query.order('name').limit(10);

      if (error) {
        console.error('search_staff error:', error);
        throw error;
      }
      
      console.log(`search_staff: Found ${data?.length || 0} staff`);
      return { staff: data || [] };
    }

    case 'list_all_staff': {
      if (!canAccessDataType(userContext, 'staff')) {
        return { error: 'You do not have permission to access staff information.' };
      }

      const limit = Math.min(args.limit || 20, 50);
      console.log(`list_all_staff: limit=${limit}`);

      let query = supabase
        .from('staff')
        .select('id, name, role, department, email, phone')
        .eq('company_id', userContext.companyId);

      const { data, error } = await query.order('name').limit(limit);

      if (error) {
        console.error('list_all_staff error:', error);
        throw error;
      }
      
      console.log(`list_all_staff: Found ${data?.length || 0} staff`);
      return { staff: data || [], total: data?.length || 0 };
    }

    case 'get_staff_by_department': {
      if (!canAccessDataType(userContext, 'staff')) {
        return { error: 'You do not have permission to access staff information.' };
      }

      console.log(`get_staff_by_department: department="${args.department}"`);

      let query = supabase
        .from('staff')
        .select('id, name, role, department, email, phone')
        .eq('company_id', userContext.companyId)
        .ilike('department', `%${args.department}%`);

      const { data, error } = await query.order('name').limit(30);

      if (error) {
        console.error('get_staff_by_department error:', error);
        throw error;
      }
      
      console.log(`get_staff_by_department: Found ${data?.length || 0} staff`);
      return { staff: data || [], department: args.department };
    }

    case 'search_incidents': {
      if (!canAccessDataType(userContext, 'incidents')) {
        return { error: 'You do not have permission to access incident reports.' };
      }

      console.log(`search_incidents: startDate="${args.startDate || ''}", endDate="${args.endDate || ''}", type="${args.type || ''}", severity="${args.severity || ''}"`);

      let query = supabase
        .from('incident_reports')
        .select('id, date, type, description, severity, status, child_id')
        .eq('company_id', userContext.companyId);

      // Apply division filter through incident_children if restricted
      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        const { data: incidentIds } = await supabase
          .from('incident_children')
          .select('incident_id, child_id')
          .in('child_id', 
            supabase
              .from('children')
              .select('id')
              .in('division_id', userContext.divisionIds)
          );

        if (incidentIds && incidentIds.length > 0) {
          query = query.in('id', incidentIds.map((i: any) => i.incident_id));
        } else {
          console.log('search_incidents: No incidents found for user divisions');
          return { incidents: [] };
        }
      }

      if (args.startDate) {
        query = query.gte('date', args.startDate);
      }

      if (args.endDate) {
        query = query.lte('date', args.endDate);
      }

      if (args.type) {
        query = query.eq('type', args.type);
      }

      if (args.severity) {
        query = query.eq('severity', args.severity);
      }

      const { data, error } = await query.order('date', { ascending: false }).limit(10);

      if (error) {
        console.error('search_incidents error:', error);
        throw error;
      }
      
      console.log(`search_incidents: Found ${data?.length || 0} incidents`);
      return { incidents: data || [] };
    }

    case 'get_todays_events': {
      if (!canAccessDataType(userContext, 'activities')) {
        return { error: 'You do not have permission to access event information.' };
      }

      const targetDate = args.date || new Date().toISOString().split('T')[0];
      console.log(`get_todays_events: date="${targetDate}"`);

      // Get activities
      let activitiesQuery = supabase
        .from('activities_field_trips')
        .select('id, title, event_date, time, location, activity_type, division_id')
        .eq('company_id', userContext.companyId)
        .eq('event_date', targetDate);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        activitiesQuery = activitiesQuery.in('division_id', userContext.divisionIds);
      }

      const { data: activities, error: activitiesError } = await activitiesQuery;

      if (activitiesError) {
        console.error('get_todays_events activities error:', activitiesError);
      }

      // Get sports events
      let sportsQuery = supabase
        .from('sports_calendar')
        .select('id, title, event_date, time, location, sport_type, division_id')
        .eq('company_id', userContext.companyId)
        .eq('event_date', targetDate);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        sportsQuery = sportsQuery.in('division_id', userContext.divisionIds);
      }

      const { data: sports, error: sportsError } = await sportsQuery;

      if (sportsError) {
        console.error('get_todays_events sports error:', sportsError);
      }

      console.log(`get_todays_events: Found ${activities?.length || 0} activities, ${sports?.length || 0} sports events`);

      return {
        date: targetDate,
        activities: activities || [],
        sports: sports || []
      };
    }

    case 'get_health_admissions': {
      if (!canAccessDataType(userContext, 'health')) {
        return { error: 'You do not have permission to access health center information.' };
      }

      console.log(`get_health_admissions: startDate="${args.startDate || ''}", endDate="${args.endDate || ''}"`);

      let query = supabase
        .from('health_center_admissions')
        .select('id, child_id, staff_id, admitted_at, checked_out_at, reason, notes')
        .eq('company_id', userContext.companyId);

      // Apply division filter through children
      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        const { data: childIds } = await supabase
          .from('children')
          .select('id')
          .in('division_id', userContext.divisionIds);

        if (childIds && childIds.length > 0) {
          query = query.in('child_id', childIds.map((c: any) => c.id));
        } else {
          console.log('get_health_admissions: No children found for user divisions');
          return { admissions: [] };
        }
      }

      if (args.startDate) {
        query = query.gte('admitted_at', args.startDate);
      }

      if (args.endDate) {
        query = query.lte('admitted_at', args.endDate);
      }

      const { data, error } = await query.order('admitted_at', { ascending: false }).limit(10);

      if (error) {
        console.error('get_health_admissions error:', error);
        throw error;
      }
      
      console.log(`get_health_admissions: Found ${data?.length || 0} admissions`);
      return { admissions: data || [] };
    }

    case 'get_stats': {
      const { statsType } = args;
      console.log(`get_stats: statsType="${statsType}"`);

      if (statsType === 'campers') {
        if (!canAccessDataType(userContext, 'campers')) {
          return { error: 'You do not have permission to access camper statistics.' };
        }

        let query = supabase
          .from('children')
          .select('id, division_id, gender', { count: 'exact' })
          .eq('company_id', userContext.companyId);

        if (userContext.divisionIds && userContext.divisionIds.length > 0) {
          query = query.in('division_id', userContext.divisionIds);
        }

        const { count, error } = await query;
        
        if (error) {
          console.error('get_stats campers error:', error);
        }
        
        console.log(`get_stats: Total campers = ${count || 0}`);
        return { totalCampers: count || 0 };
      }

      if (statsType === 'staff') {
        if (!canAccessDataType(userContext, 'staff')) {
          return { error: 'You do not have permission to access staff statistics.' };
        }

        const { count, error } = await supabase
          .from('staff')
          .select('id', { count: 'exact' })
          .eq('company_id', userContext.companyId);

        if (error) {
          console.error('get_stats staff error:', error);
        }
        
        console.log(`get_stats: Total staff = ${count || 0}`);
        return { totalStaff: count || 0 };
      }

      if (statsType === 'incidents') {
        if (!canAccessDataType(userContext, 'incidents')) {
          return { error: 'You do not have permission to access incident statistics.' };
        }

        let query = supabase
          .from('incident_reports')
          .select('id', { count: 'exact' })
          .eq('company_id', userContext.companyId);

        const { count, error } = await query;
        
        if (error) {
          console.error('get_stats incidents error:', error);
        }
        
        console.log(`get_stats: Total incidents = ${count || 0}`);
        return { totalIncidents: count || 0 };
      }

      return { error: 'Invalid stats type' };
    }

    case 'get_awards': {
      if (!canAccessDataType(userContext, 'awards')) {
        return { error: 'You do not have permission to access award information.' };
      }

      console.log(`get_awards: query="${args.query || ''}", category="${args.category || ''}"`);

      let query = supabase
        .from('awards')
        .select('id, title, description, category, date, child_id, children(name)')
        .eq('company_id', userContext.companyId);

      if (args.query) {
        query = query.or(`title.ilike.%${args.query}%,children.name.ilike.%${args.query}%`);
      }

      if (args.category) {
        query = query.eq('category', args.category);
      }

      const limit = Math.min(args.limit || 20, 50);
      const { data, error } = await query.order('date', { ascending: false }).limit(limit);

      if (error) {
        console.error('get_awards error:', error);
        throw error;
      }

      console.log(`get_awards: Found ${data?.length || 0} awards`);
      return { awards: data || [] };
    }

    case 'get_daily_notes': {
      if (!canAccessDataType(userContext, 'notes')) {
        return { error: 'You do not have permission to access daily notes.' };
      }

      console.log(`get_daily_notes: camper_name="${args.camper_name || ''}", date="${args.date || ''}"`);

      let query = supabase
        .from('daily_notes')
        .select('id, date, mood, activities, meals, nap, notes, child_id, children(name)')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        const { data: childIds } = await supabase
          .from('children')
          .select('id')
          .in('division_id', userContext.divisionIds);

        if (childIds && childIds.length > 0) {
          query = query.in('child_id', childIds.map((c: any) => c.id));
        } else {
          return { notes: [] };
        }
      }

      if (args.camper_name) {
        query = query.ilike('children.name', `%${args.camper_name}%`);
      }

      if (args.date) {
        query = query.eq('date', args.date);
      }

      const limit = Math.min(args.limit || 20, 50);
      const { data, error } = await query.order('date', { ascending: false }).limit(limit);

      if (error) {
        console.error('get_daily_notes error:', error);
        throw error;
      }

      console.log(`get_daily_notes: Found ${data?.length || 0} notes`);
      return { notes: data || [] };
    }

    case 'get_medications': {
      if (!canAccessDataType(userContext, 'health')) {
        return { error: 'You do not have permission to access medication information.' };
      }

      console.log(`get_medications: camper_name="${args.camper_name || ''}", date="${args.date || ''}", medication="${args.medication_name || ''}"`);

      let query = supabase
        .from('medication_logs')
        .select('id, medication_name, dosage, date, scheduled_time, administered, administered_at, notes, child_id, children(name)')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        const { data: childIds } = await supabase
          .from('children')
          .select('id')
          .in('division_id', userContext.divisionIds);

        if (childIds && childIds.length > 0) {
          query = query.in('child_id', childIds.map((c: any) => c.id));
        } else {
          return { medications: [] };
        }
      }

      if (args.camper_name) {
        query = query.ilike('children.name', `%${args.camper_name}%`);
      }

      if (args.date) {
        query = query.eq('date', args.date);
      }

      if (args.medication_name) {
        query = query.ilike('medication_name', `%${args.medication_name}%`);
      }

      const { data, error } = await query.order('date', { ascending: false }).limit(20);

      if (error) {
        console.error('get_medications error:', error);
        throw error;
      }

      console.log(`get_medications: Found ${data?.length || 0} medication logs`);
      return { medications: data || [] };
    }

    case 'get_menu': {
      if (!canAccessDataType(userContext, 'menu')) {
        return { error: 'You do not have permission to access menu information.' };
      }

      const targetDate = args.date || new Date().toISOString().split('T')[0];
      console.log(`get_menu: date="${targetDate}", meal_type="${args.meal_type || ''}"`);

      let query = supabase
        .from('menu_items')
        .select('id, meal_type, items, allergens, date')
        .eq('company_id', userContext.companyId)
        .eq('date', targetDate);

      if (args.meal_type) {
        query = query.eq('meal_type', args.meal_type);
      }

      const { data, error } = await query.order('meal_type');

      if (error) {
        console.error('get_menu error:', error);
        throw error;
      }

      console.log(`get_menu: Found ${data?.length || 0} menu items`);
      return { menu: data || [], date: targetDate };
    }

    case 'get_trips': {
      if (!canAccessDataType(userContext, 'transportation')) {
        return { error: 'You do not have permission to access trip information.' };
      }

      console.log(`get_trips: date="${args.date || ''}", destination="${args.destination || ''}", type="${args.type || ''}"`);

      let query = supabase
        .from('trips')
        .select('id, name, date, destination, departure_time, return_time, type, status, transportation_type, driver, chaperone')
        .eq('company_id', userContext.companyId);

      if (args.date) {
        query = query.eq('date', args.date);
      }

      if (args.destination) {
        query = query.ilike('destination', `%${args.destination}%`);
      }

      if (args.type) {
        query = query.eq('type', args.type);
      }

      const { data, error } = await query.order('date', { ascending: false }).limit(20);

      if (error) {
        console.error('get_trips error:', error);
        throw error;
      }

      console.log(`get_trips: Found ${data?.length || 0} trips`);
      return { trips: data || [] };
    }

    case 'get_sports_events': {
      if (!canAccessDataType(userContext, 'sports-calendar')) {
        return { error: 'You do not have permission to access sports calendar.' };
      }

      console.log(`get_sports_events: start_date="${args.start_date || ''}", end_date="${args.end_date || ''}", sport_type="${args.sport_type || ''}"`);

      let query = supabase
        .from('sports_calendar')
        .select('id, title, event_date, time, location, sport_type, event_type, opponent, team, home_away, division_id')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('division_id', userContext.divisionIds);
      }

      if (args.start_date) {
        query = query.gte('event_date', args.start_date);
      }

      if (args.end_date) {
        query = query.lte('event_date', args.end_date);
      }

      if (args.sport_type) {
        query = query.eq('sport_type', args.sport_type);
      }

      if (args.division) {
        query = query.ilike('division_id', `%${args.division}%`);
      }

      const { data, error } = await query.order('event_date', { ascending: true }).limit(20);

      if (error) {
        console.error('get_sports_events error:', error);
        throw error;
      }

      console.log(`get_sports_events: Found ${data?.length || 0} sports events`);
      return { sports_events: data || [] };
    }

    case 'get_special_events': {
      if (!canAccessDataType(userContext, 'activities')) {
        return { error: 'You do not have permission to access special events.' };
      }

      console.log(`get_special_events: date="${args.date || ''}", event_type="${args.event_type || ''}"`);

      let query = supabase
        .from('special_events_activities')
        .select('id, title, event_date, time_slot, location, event_type, description, division_id')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('division_id', userContext.divisionIds);
      }

      if (args.date) {
        query = query.eq('event_date', args.date);
      }

      if (args.event_type) {
        query = query.eq('event_type', args.event_type);
      }

      const { data, error } = await query.order('event_date', { ascending: false }).limit(20);

      if (error) {
        console.error('get_special_events error:', error);
        throw error;
      }

      console.log(`get_special_events: Found ${data?.length || 0} special events`);
      return { special_events: data || [] };
    }

    case 'get_tutoring_therapy': {
      if (!canAccessDataType(userContext, 'tutoring')) {
        return { error: 'You do not have permission to access tutoring/therapy information.' };
      }

      console.log(`get_tutoring_therapy: camper_name="${args.camper_name || ''}", service_type="${args.service_type || ''}", instructor="${args.instructor || ''}"`);

      let query = supabase
        .from('tutoring_therapy')
        .select('id, service_type, instructor, start_date, end_date, schedule_periods, notes, child_id, children(name)')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        const { data: childIds } = await supabase
          .from('children')
          .select('id')
          .in('division_id', userContext.divisionIds);

        if (childIds && childIds.length > 0) {
          query = query.in('child_id', childIds.map((c: any) => c.id));
        } else {
          return { tutoring_therapy: [] };
        }
      }

      if (args.camper_name) {
        query = query.ilike('children.name', `%${args.camper_name}%`);
      }

      if (args.service_type) {
        query = query.ilike('service_type', `%${args.service_type}%`);
      }

      if (args.instructor) {
        query = query.ilike('instructor', `%${args.instructor}%`);
      }

      const { data, error } = await query.order('start_date', { ascending: false }).limit(20);

      if (error) {
        console.error('get_tutoring_therapy error:', error);
        throw error;
      }

      console.log(`get_tutoring_therapy: Found ${data?.length || 0} sessions`);
      return { tutoring_therapy: data || [] };
    }

    case 'get_sports_academy': {
      if (!canAccessDataType(userContext, 'sports-academy')) {
        return { error: 'You do not have permission to access sports academy information.' };
      }

      console.log(`get_sports_academy: camper_name="${args.camper_name || ''}", sport_name="${args.sport_name || ''}", instructor="${args.instructor || ''}"`);

      let query = supabase
        .from('sports_academy')
        .select('id, sport_name, instructor, start_date, end_date, schedule_periods, notes, child_id, children(name)')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        const { data: childIds } = await supabase
          .from('children')
          .select('id')
          .in('division_id', userContext.divisionIds);

        if (childIds && childIds.length > 0) {
          query = query.in('child_id', childIds.map((c: any) => c.id));
        } else {
          return { sports_academy: [] };
        }
      }

      if (args.camper_name) {
        query = query.ilike('children.name', `%${args.camper_name}%`);
      }

      if (args.sport_name) {
        query = query.ilike('sport_name', `%${args.sport_name}%`);
      }

      if (args.instructor) {
        query = query.ilike('instructor', `%${args.instructor}%`);
      }

      const { data, error } = await query.order('start_date', { ascending: false }).limit(20);

      if (error) {
        console.error('get_sports_academy error:', error);
        throw error;
      }

      console.log(`get_sports_academy: Found ${data?.length || 0} enrollments`);
      return { sports_academy: data || [] };
    }

    case 'get_calendar_events': {
      if (!canAccessDataType(userContext, 'activities')) {
        return { error: 'You do not have permission to access calendar events.' };
      }

      console.log(`get_calendar_events: start_date="${args.start_date || ''}", end_date="${args.end_date || ''}", event_type="${args.event_type || ''}"`);

      let query = supabase
        .from('master_calendar')
        .select('id, title, event_date, time, location, type, description, division_id');

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        query = query.in('division_id', userContext.divisionIds);
      }

      if (args.start_date) {
        query = query.gte('event_date', args.start_date);
      }

      if (args.end_date) {
        query = query.lte('event_date', args.end_date);
      }

      if (args.event_type) {
        query = query.eq('type', args.event_type);
      }

      const { data, error } = await query.order('event_date', { ascending: true }).limit(20);

      if (error) {
        console.error('get_calendar_events error:', error);
        throw error;
      }

      console.log(`get_calendar_events: Found ${data?.length || 0} calendar events`);
      return { calendar_events: data || [] };
    }

    case 'get_special_meals': {
      if (!canAccessDataType(userContext, 'menu')) {
        return { error: 'You do not have permission to access special meal information.' };
      }

      console.log(`get_special_meals: date="${args.date || ''}", meal_type="${args.meal_type || ''}"`);

      let query = supabase
        .from('special_meals')
        .select('id, meal_type, items, allergens, date')
        .eq('company_id', userContext.companyId);

      if (args.date) {
        query = query.eq('date', args.date);
      }

      if (args.meal_type) {
        query = query.eq('meal_type', args.meal_type);
      }

      const { data, error } = await query.order('date', { ascending: false }).limit(20);

      if (error) {
        console.error('get_special_meals error:', error);
        throw error;
      }

      console.log(`get_special_meals: Found ${data?.length || 0} special meals`);
      return { special_meals: data || [] };
    }

    case 'get_camper_reports': {
      if (!canAccessDataType(userContext, 'campers')) {
        return { error: 'You do not have permission to access camper reports.' };
      }

      console.log(`get_camper_reports: camper_name="${args.camper_name || ''}", report_type="${args.report_type || ''}", date="${args.date || ''}"`);

      let query = supabase
        .from('camper_reports')
        .select('id, report_type, report_date, report_data, child_id, children(name)')
        .eq('company_id', userContext.companyId);

      if (userContext.divisionIds && userContext.divisionIds.length > 0) {
        const { data: childIds } = await supabase
          .from('children')
          .select('id')
          .in('division_id', userContext.divisionIds);

        if (childIds && childIds.length > 0) {
          query = query.in('child_id', childIds.map((c: any) => c.id));
        } else {
          return { reports: [] };
        }
      }

      if (args.camper_name) {
        query = query.ilike('children.name', `%${args.camper_name}%`);
      }

      if (args.report_type) {
        query = query.eq('report_type', args.report_type);
      }

      if (args.date) {
        query = query.eq('report_date', args.date);
      }

      const { data, error } = await query.order('report_date', { ascending: false }).limit(20);

      if (error) {
        console.error('get_camper_reports error:', error);
        throw error;
      }

      console.log(`get_camper_reports: Found ${data?.length || 0} reports`);
      return { reports: data || [] };
    }

    default:
      console.error(`Unknown function called: ${functionName}`);
      return { error: 'Unknown function' };
  }
}
