export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities_field_trips: {
        Row: {
          activity_type: string
          capacity: number | null
          chaperone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          division_id: string | null
          event_date: string
          id: string
          location: string | null
          time: string | null
          title: string
        }
        Insert: {
          activity_type: string
          capacity?: number | null
          chaperone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date: string
          id?: string
          location?: string | null
          time?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          capacity?: number | null
          chaperone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date?: string
          id?: string
          location?: string | null
          time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_field_trips_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          category: string | null
          child_id: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          title: string
        }
        Insert: {
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          age: number | null
          allergies: string | null
          category: string | null
          created_at: string | null
          division_id: string | null
          emergency_contact: string | null
          gender: string | null
          grade: string | null
          group_name: string | null
          guardian_email: string | null
          guardian_phone: string | null
          id: string
          leader_id: string | null
          medical_notes: string | null
          name: string
          season: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          allergies?: string | null
          category?: string | null
          created_at?: string | null
          division_id?: string | null
          emergency_contact?: string | null
          gender?: string | null
          grade?: string | null
          group_name?: string | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          leader_id?: string | null
          medical_notes?: string | null
          name: string
          season?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          allergies?: string | null
          category?: string | null
          created_at?: string | null
          division_id?: string | null
          emergency_contact?: string | null
          gender?: string | null
          grade?: string | null
          group_name?: string | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          leader_id?: string | null
          medical_notes?: string | null
          name?: string
          season?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          activities: string | null
          child_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          meals: string | null
          mood: string | null
          nap: string | null
          notes: string | null
        }
        Insert: {
          activities?: string | null
          child_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          meals?: string | null
          mood?: string | null
          nap?: string | null
          notes?: string | null
        }
        Update: {
          activities?: string | null
          child_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          meals?: string | null
          mood?: string | null
          nap?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      division_permissions: {
        Row: {
          can_access: boolean | null
          created_at: string | null
          division_id: string
          id: string
          user_id: string
        }
        Insert: {
          can_access?: boolean | null
          created_at?: string | null
          division_id: string
          id?: string
          user_id: string
        }
        Update: {
          can_access?: boolean | null
          created_at?: string | null
          division_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "division_permissions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string | null
          gender: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          gender: string
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string | null
          gender?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      evaluation_questions: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          options: string[] | null
          question_text: string
          question_type: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          options?: string[] | null
          question_text: string
          question_type: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          options?: string[] | null
          question_text?: string
          question_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      evaluation_responses: {
        Row: {
          created_at: string | null
          evaluation_id: string | null
          id: string
          question_id: string | null
          response_text: string | null
          response_value: number | null
        }
        Insert: {
          created_at?: string | null
          evaluation_id?: string | null
          id?: string
          question_id?: string | null
          response_text?: string | null
          response_value?: number | null
        }
        Update: {
          created_at?: string | null
          evaluation_id?: string | null
          id?: string
          question_id?: string | null
          response_text?: string | null
          response_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_responses_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "staff_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "evaluation_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          location: string | null
          time: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          location?: string | null
          time?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          location?: string | null
          time?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      incident_reports: {
        Row: {
          child_id: string | null
          created_at: string | null
          date: string
          description: string
          id: string
          reported_by: string | null
          severity: string | null
          status: string | null
          type: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          date: string
          description: string
          id?: string
          reported_by?: string | null
          severity?: string | null
          status?: string | null
          type: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          reported_by?: string | null
          severity?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      master_calendar: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          division_id: string | null
          event_date: string
          id: string
          location: string | null
          time: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date: string
          id?: string
          location?: string | null
          time?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date?: string
          id?: string
          location?: string | null
          time?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_calendar_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_logs: {
        Row: {
          administered: boolean | null
          administered_at: string | null
          administered_by: string | null
          alert_sent: boolean | null
          child_id: string | null
          created_at: string | null
          date: string
          days_of_week: string[] | null
          dosage: string | null
          end_date: string | null
          frequency: string | null
          id: string
          is_recurring: boolean | null
          medication_name: string
          notes: string | null
          scheduled_time: string
          updated_at: string | null
        }
        Insert: {
          administered?: boolean | null
          administered_at?: string | null
          administered_by?: string | null
          alert_sent?: boolean | null
          child_id?: string | null
          created_at?: string | null
          date: string
          days_of_week?: string[] | null
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_recurring?: boolean | null
          medication_name: string
          notes?: string | null
          scheduled_time: string
          updated_at?: string | null
        }
        Update: {
          administered?: boolean | null
          administered_at?: string | null
          administered_by?: string | null
          alert_sent?: boolean | null
          child_id?: string | null
          created_at?: string | null
          date?: string
          days_of_week?: string[] | null
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_recurring?: boolean | null
          medication_name?: string
          notes?: string | null
          scheduled_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string | null
          created_at: string | null
          date: string
          id: string
          items: string
          meal_type: string
        }
        Insert: {
          allergens?: string | null
          created_at?: string | null
          date: string
          id?: string
          items: string
          meal_type: string
        }
        Update: {
          allergens?: string | null
          created_at?: string | null
          date?: string
          id?: string
          items?: string
          meal_type?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          read: boolean | null
          recipient_id: string | null
          sender_id: string | null
          subject: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          recipient_id?: string | null
          sender_id?: string | null
          subject: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          read?: boolean | null
          recipient_id?: string | null
          sender_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_requested_at: string | null
          approved: boolean | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          approval_requested_at?: string | null
          approved?: boolean | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_requested_at?: string | null
          approved?: boolean | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rainy_day_schedule: {
        Row: {
          activity_type: string
          capacity: number | null
          created_at: string | null
          date: string
          id: string
          location: string | null
          name: string
          notes: string | null
          status: string | null
          supervisor: string | null
          time: string | null
        }
        Insert: {
          activity_type: string
          capacity?: number | null
          created_at?: string | null
          date: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          status?: string | null
          supervisor?: string | null
          time?: string | null
        }
        Update: {
          activity_type?: string
          capacity?: number | null
          created_at?: string | null
          date?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          status?: string | null
          supervisor?: string | null
          time?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_access: boolean | null
          created_at: string | null
          id: string
          menu_item: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          menu_item: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          menu_item?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      special_meals: {
        Row: {
          allergens: string | null
          created_at: string | null
          date: string
          id: string
          items: string
          meal_type: string
        }
        Insert: {
          allergens?: string | null
          created_at?: string | null
          date: string
          id?: string
          items: string
          meal_type: string
        }
        Update: {
          allergens?: string | null
          created_at?: string | null
          date?: string
          id?: string
          items?: string
          meal_type?: string
        }
        Relationships: []
      }
      sports_calendar: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          division_id: string | null
          event_date: string
          id: string
          location: string | null
          opponent: string | null
          sport_type: string
          team: string | null
          time: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date: string
          id?: string
          location?: string | null
          opponent?: string | null
          sport_type: string
          team?: string | null
          time?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date?: string
          id?: string
          location?: string | null
          opponent?: string | null
          sport_type?: string
          team?: string | null
          time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_calendar_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string | null
          department: string | null
          email: string | null
          hire_date: string | null
          id: string
          leader_id: string | null
          name: string
          phone: string | null
          role: string
          season: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          leader_id?: string | null
          name: string
          phone?: string | null
          role: string
          season?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          hire_date?: string | null
          id?: string
          leader_id?: string | null
          name?: string
          phone?: string | null
          role?: string
          season?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_evaluations: {
        Row: {
          category: string | null
          comments: string | null
          created_at: string | null
          date: string
          evaluator: string | null
          id: string
          rating: number | null
          staff_id: string | null
          supervisor_id: string | null
        }
        Insert: {
          category?: string | null
          comments?: string | null
          created_at?: string | null
          date: string
          evaluator?: string | null
          id?: string
          rating?: number | null
          staff_id?: string | null
          supervisor_id?: string | null
        }
        Update: {
          category?: string | null
          comments?: string | null
          created_at?: string | null
          date?: string
          evaluator?: string | null
          id?: string
          rating?: number | null
          staff_id?: string | null
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_evaluations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_evaluations_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          capacity: number | null
          chaperone: string | null
          created_at: string | null
          date: string
          departure_time: string | null
          destination: string | null
          id: string
          name: string
          return_time: string | null
          status: string | null
          type: string
        }
        Insert: {
          capacity?: number | null
          chaperone?: string | null
          created_at?: string | null
          date: string
          departure_time?: string | null
          destination?: string | null
          id?: string
          name: string
          return_time?: string | null
          status?: string | null
          type: string
        }
        Update: {
          capacity?: number | null
          chaperone?: string | null
          created_at?: string | null
          date?: string
          departure_time?: string | null
          destination?: string | null
          id?: string
          name?: string
          return_time?: string | null
          status?: string | null
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "viewer"],
    },
  },
} as const
