import { supabase } from "@/integrations/supabase/client";

export interface ConflictCheckParams {
  entityType: 'child' | 'staff';
  entityId: string;
  eventType: string;
  eventId: string;
  eventDate: string;
  eventTime?: string;
  companyId: string;
}

export interface Conflict {
  conflict_type: string;
  event1_type: string;
  event1_id: string;
  event1_name: string;
  event1_date: string;
  event1_time?: string;
  event2_type: string;
  event2_id: string;
  event2_name: string;
  event2_date: string;
  event2_time?: string;
  entity_name: string;
}

export const useConflictDetection = () => {
  const checkConflict = async (params: ConflictCheckParams): Promise<Conflict[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-schedule-conflicts', {
        body: params,
      });

      if (error) {
        console.error('Error checking conflicts:', error);
        return [];
      }

      return data?.conflicts || [];
    } catch (error) {
      console.error('Error invoking conflict detection:', error);
      return [];
    }
  };

  return { checkConflict };
};
