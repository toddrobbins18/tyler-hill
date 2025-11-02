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
          meal_notes: string | null
          meal_options: string[] | null
          season: string | null
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
          meal_notes?: string | null
          meal_options?: string[] | null
          season?: string | null
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
          meal_notes?: string | null
          meal_options?: string[] | null
          season?: string | null
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
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      automated_email_config: {
        Row: {
          created_at: string | null
          email_type: string
          enabled: boolean | null
          id: string
          recipient_tags: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          enabled?: boolean | null
          id?: string
          recipient_tags?: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          enabled?: boolean | null
          id?: string
          recipient_tags?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      awards: {
        Row: {
          category: string | null
          child_id: string | null
          created_at: string | null
          date: string
          description: string | null
          id: string
          season: string | null
          title: string
        }
        Insert: {
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          season?: string | null
          title: string
        }
        Update: {
          category?: string | null
          child_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          season?: string | null
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
          company_id: string | null
          created_at: string | null
          date_of_birth: string | null
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
          person_id: string | null
          season: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          allergies?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
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
          person_id?: string | null
          season?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          allergies?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
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
          person_id?: string | null
          season?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      companies: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          theme_color: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          theme_color?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          theme_color?: string
          updated_at?: string | null
        }
        Relationships: []
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
          season: string | null
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
          season?: string | null
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
          season?: string | null
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
      email_logs: {
        Row: {
          created_at: string | null
          error_details: Json | null
          id: string
          recipient_count: number
          recipient_ids: string[] | null
          recipient_tags: string[] | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          id?: string
          recipient_count: number
          recipient_ids?: string[] | null
          recipient_tags?: string[] | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          id?: string
          recipient_count?: number
          recipient_ids?: string[] | null
          recipient_tags?: string[] | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
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
      health_center_admissions: {
        Row: {
          admitted_at: string
          admitted_by: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          child_id: string
          created_at: string
          id: string
          notes: string | null
          reason: string | null
          season: string
          updated_at: string
        }
        Insert: {
          admitted_at?: string
          admitted_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          child_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reason?: string | null
          season?: string
          updated_at?: string
        }
        Update: {
          admitted_at?: string
          admitted_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          child_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reason?: string | null
          season?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_health_center_admissions_child_id"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_center_admissions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_children: {
        Row: {
          child_id: string
          created_at: string | null
          id: string
          incident_id: string
        }
        Insert: {
          child_id: string
          created_at?: string | null
          id?: string
          incident_id: string
        }
        Update: {
          child_id?: string
          created_at?: string | null
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_children_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          child_id: string | null
          created_at: string | null
          date: string
          description: string
          id: string
          reported_by: string | null
          reporter_id: string | null
          season: string | null
          severity: string | null
          status: string | null
          tags: string[] | null
          type: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          date: string
          description: string
          id?: string
          reported_by?: string | null
          reporter_id?: string | null
          season?: string | null
          severity?: string | null
          status?: string | null
          tags?: string[] | null
          type: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          reported_by?: string | null
          reporter_id?: string | null
          season?: string | null
          severity?: string | null
          status?: string | null
          tags?: string[] | null
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
          {
            foreignKeyName: "incident_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
          season: string | null
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
          season?: string | null
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
          season?: string | null
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
          late_notes: string | null
          late_notes_timestamp: string | null
          meal_time: string | null
          medication_name: string
          notes: string | null
          scheduled_time: string | null
          season: string | null
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
          late_notes?: string | null
          late_notes_timestamp?: string | null
          meal_time?: string | null
          medication_name: string
          notes?: string | null
          scheduled_time?: string | null
          season?: string | null
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
          late_notes?: string | null
          late_notes_timestamp?: string | null
          meal_time?: string | null
          medication_name?: string
          notes?: string | null
          scheduled_time?: string | null
          season?: string | null
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
          season: string | null
        }
        Insert: {
          allergens?: string | null
          created_at?: string | null
          date: string
          id?: string
          items: string
          meal_type: string
          season?: string | null
        }
        Update: {
          allergens?: string | null
          created_at?: string | null
          date?: string
          id?: string
          items?: string
          meal_type?: string
          season?: string | null
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
      notification_logs: {
        Row: {
          created_at: string | null
          event_id: string | null
          event_type: string
          id: string
          notification_version: number | null
          recipient_count: number
          sent_at: string | null
          trip_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          notification_version?: number | null
          recipient_count: number
          sent_at?: string | null
          trip_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          notification_version?: number | null
          recipient_count?: number
          sent_at?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sports_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_requested_at: string | null
          approved: boolean | null
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          season: string | null
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
          season?: string | null
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
          season?: string | null
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
      roster_template_children: {
        Row: {
          child_id: string | null
          created_at: string | null
          id: string
          template_id: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          template_id?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_template_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_template_children_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "roster_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      special_events_activities: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          division_id: string | null
          event_date: string
          event_type: string
          id: string
          location: string | null
          season: string | null
          time_slot: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date: string
          event_type: string
          id?: string
          location?: string | null
          season?: string | null
          time_slot: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division_id?: string | null
          event_date?: string
          event_type?: string
          id?: string
          location?: string | null
          season?: string | null
          time_slot?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedule_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      special_meals: {
        Row: {
          allergens: string | null
          created_at: string | null
          date: string
          id: string
          items: string
          meal_type: string
          season: string | null
        }
        Insert: {
          allergens?: string | null
          created_at?: string | null
          date: string
          id?: string
          items: string
          meal_type: string
          season?: string | null
        }
        Update: {
          allergens?: string | null
          created_at?: string | null
          date?: string
          id?: string
          items?: string
          meal_type?: string
          season?: string | null
        }
        Relationships: []
      }
      sports_academy: {
        Row: {
          child_id: string
          created_at: string | null
          end_date: string | null
          id: string
          instructor: string | null
          notes: string | null
          schedule_periods: string[] | null
          season: string | null
          sport_name: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          child_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          instructor?: string | null
          notes?: string | null
          schedule_periods?: string[] | null
          season?: string | null
          sport_name: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          instructor?: string | null
          notes?: string | null
          schedule_periods?: string[] | null
          season?: string | null
          sport_name?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sports_academy_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_calendar: {
        Row: {
          created_at: string | null
          created_by: string | null
          custom_sport_type: string | null
          description: string | null
          division_id: string | null
          division_provides_coach: boolean | null
          division_provides_ref: boolean | null
          event_date: string
          event_type: string | null
          home_away: string | null
          id: string
          location: string | null
          meal_notes: string | null
          meal_options: string[] | null
          opponent: string | null
          season: string | null
          sport_type: string
          team: string | null
          time: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custom_sport_type?: string | null
          description?: string | null
          division_id?: string | null
          division_provides_coach?: boolean | null
          division_provides_ref?: boolean | null
          event_date: string
          event_type?: string | null
          home_away?: string | null
          id?: string
          location?: string | null
          meal_notes?: string | null
          meal_options?: string[] | null
          opponent?: string | null
          season?: string | null
          sport_type: string
          team?: string | null
          time?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custom_sport_type?: string | null
          description?: string | null
          division_id?: string | null
          division_provides_coach?: boolean | null
          division_provides_ref?: boolean | null
          event_date?: string
          event_type?: string | null
          home_away?: string | null
          id?: string
          location?: string | null
          meal_notes?: string | null
          meal_options?: string[] | null
          opponent?: string | null
          season?: string | null
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
      sports_calendar_divisions: {
        Row: {
          created_at: string | null
          division_id: string
          id: string
          sports_event_id: string
        }
        Insert: {
          created_at?: string | null
          division_id: string
          id?: string
          sports_event_id: string
        }
        Update: {
          created_at?: string | null
          division_id?: string
          id?: string
          sports_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_calendar_divisions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_calendar_divisions_sports_event_id_fkey"
            columns: ["sports_event_id"]
            isOneToOne: false
            referencedRelation: "sports_calendar"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_event_roster: {
        Row: {
          child_id: string
          confirmed: boolean | null
          created_at: string | null
          event_id: string
          id: string
        }
        Insert: {
          child_id: string
          confirmed?: boolean | null
          created_at?: string | null
          event_id: string
          id?: string
        }
        Update: {
          child_id?: string
          confirmed?: boolean | null
          created_at?: string | null
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_event_roster_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_event_roster_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sports_calendar"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_event_staff: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          role: string
          staff_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          role: string
          staff_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          role?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sports_event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sports_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_event_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          company_id: string | null
          created_at: string | null
          date_of_birth: string | null
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
          company_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
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
          company_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
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
            foreignKeyName: "staff_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          season: string | null
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
          season?: string | null
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
          season?: string | null
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
      trip_attendees: {
        Row: {
          child_id: string
          confirmed: boolean | null
          created_at: string | null
          id: string
          trip_id: string
        }
        Insert: {
          child_id: string
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          trip_id: string
        }
        Update: {
          child_id?: string
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_attendees_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_attendees_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          driver: string | null
          event_length: string | null
          event_type: string | null
          id: string
          meal: string | null
          name: string
          return_time: string | null
          season: string | null
          sports_event_id: string | null
          status: string | null
          transportation_type: string | null
          type: string
        }
        Insert: {
          capacity?: number | null
          chaperone?: string | null
          created_at?: string | null
          date: string
          departure_time?: string | null
          destination?: string | null
          driver?: string | null
          event_length?: string | null
          event_type?: string | null
          id?: string
          meal?: string | null
          name: string
          return_time?: string | null
          season?: string | null
          sports_event_id?: string | null
          status?: string | null
          transportation_type?: string | null
          type: string
        }
        Update: {
          capacity?: number | null
          chaperone?: string | null
          created_at?: string | null
          date?: string
          departure_time?: string | null
          destination?: string | null
          driver?: string | null
          event_length?: string | null
          event_type?: string | null
          id?: string
          meal?: string | null
          name?: string
          return_time?: string | null
          season?: string | null
          sports_event_id?: string | null
          status?: string | null
          transportation_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_sports_event_id_fkey"
            columns: ["sports_event_id"]
            isOneToOne: false
            referencedRelation: "sports_calendar"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_therapy: {
        Row: {
          child_id: string
          created_at: string | null
          end_date: string | null
          id: string
          instructor: string | null
          notes: string | null
          schedule_periods: string[] | null
          season: string | null
          service_type: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          child_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          instructor?: string | null
          notes?: string | null
          schedule_periods?: string[] | null
          season?: string | null
          service_type: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          instructor?: string | null
          notes?: string | null
          schedule_periods?: string[] | null
          season?: string | null
          service_type?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_therapy_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
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
      user_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          tag: Database["public"]["Enums"]["tag_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          tag: Database["public"]["Enums"]["tag_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          tag?: Database["public"]["Enums"]["tag_type"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_page: {
        Args: { _page_name: string; _user_id: string }
        Returns: boolean
      }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      get_user_divisions: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_division_leader: {
        Args: { _division_id: string; _user_id: string }
        Returns: boolean
      }
      is_specialist: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      set_current_company: { Args: { company_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "staff"
        | "viewer"
        | "division_leader"
        | "specialist"
        | "super_admin"
      tag_type:
        | "nurse"
        | "transportation"
        | "food_service"
        | "specialist"
        | "division_leader"
        | "director"
        | "general_staff"
        | "admin_staff"
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
      app_role: [
        "admin",
        "staff",
        "viewer",
        "division_leader",
        "specialist",
        "super_admin",
      ],
      tag_type: [
        "nurse",
        "transportation",
        "food_service",
        "specialist",
        "division_leader",
        "director",
        "general_staff",
        "admin_staff",
      ],
    },
  },
} as const
