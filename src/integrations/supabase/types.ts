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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      hs_contacts: {
        Row: {
          created_at: string
          createdate: string | null
          firstname: string | null
          hs_object_id: string
          lastmodifieddate: string | null
          lastname: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          createdate?: string | null
          firstname?: string | null
          hs_object_id: string
          lastmodifieddate?: string | null
          lastname?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          createdate?: string | null
          firstname?: string | null
          hs_object_id?: string
          lastmodifieddate?: string | null
          lastname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hs_tasks: {
        Row: {
          archived: boolean | null
          associated_contact_id: string | null
          created_at: string
          hs_body_preview: string | null
          hs_created_by_user_id: string | null
          hs_createdate: string | null
          hs_duration: string | null
          hs_lastmodifieddate: string | null
          hs_object_id: string
          hs_queue_membership_ids: string | null
          hs_task_body: string | null
          hs_task_completion_count: number | null
          hs_task_completion_date: string | null
          hs_task_for_object_type: string | null
          hs_task_is_all_day: boolean | null
          hs_task_is_overdue: boolean | null
          hs_task_last_contact_outreach: string | null
          hs_task_priority: string | null
          hs_task_status: string | null
          hs_task_subject: string | null
          hs_task_type: string | null
          hs_timestamp: string | null
          hs_updated_by_user_id: string | null
          hubspot_owner_assigneddate: string | null
          hubspot_owner_id: string | null
          hubspot_team_id: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean | null
          associated_contact_id?: string | null
          created_at?: string
          hs_body_preview?: string | null
          hs_created_by_user_id?: string | null
          hs_createdate?: string | null
          hs_duration?: string | null
          hs_lastmodifieddate?: string | null
          hs_object_id: string
          hs_queue_membership_ids?: string | null
          hs_task_body?: string | null
          hs_task_completion_count?: number | null
          hs_task_completion_date?: string | null
          hs_task_for_object_type?: string | null
          hs_task_is_all_day?: boolean | null
          hs_task_is_overdue?: boolean | null
          hs_task_last_contact_outreach?: string | null
          hs_task_priority?: string | null
          hs_task_status?: string | null
          hs_task_subject?: string | null
          hs_task_type?: string | null
          hs_timestamp?: string | null
          hs_updated_by_user_id?: string | null
          hubspot_owner_assigneddate?: string | null
          hubspot_owner_id?: string | null
          hubspot_team_id?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean | null
          associated_contact_id?: string | null
          created_at?: string
          hs_body_preview?: string | null
          hs_created_by_user_id?: string | null
          hs_createdate?: string | null
          hs_duration?: string | null
          hs_lastmodifieddate?: string | null
          hs_object_id?: string
          hs_queue_membership_ids?: string | null
          hs_task_body?: string | null
          hs_task_completion_count?: number | null
          hs_task_completion_date?: string | null
          hs_task_for_object_type?: string | null
          hs_task_is_all_day?: boolean | null
          hs_task_is_overdue?: boolean | null
          hs_task_last_contact_outreach?: string | null
          hs_task_priority?: string | null
          hs_task_status?: string | null
          hs_task_subject?: string | null
          hs_task_type?: string | null
          hs_timestamp?: string | null
          hs_updated_by_user_id?: string | null
          hubspot_owner_assigneddate?: string | null
          hubspot_owner_id?: string | null
          hubspot_team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hs_tasks_associated_contact"
            columns: ["associated_contact_id"]
            isOneToOne: false
            referencedRelation: "hs_contacts"
            referencedColumns: ["hs_object_id"]
          },
        ]
      }
      hs_users: {
        Row: {
          archived: boolean | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          owner_id: string
          team_id: string | null
          team_name: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          owner_id: string
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          owner_id?: string
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_metadata: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_sync_success: boolean
          last_sync_timestamp: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_success?: boolean
          last_sync_timestamp?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_success?: boolean
          last_sync_timestamp?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completion_date: string | null
          contact: string
          contact_id: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          due_date: string
          hs_lastmodifieddate: string
          hs_task_id: string
          hs_timestamp: string | null
          is_unassigned: boolean
          owner: string
          priority: string
          queue: string
          queue_ids: string[]
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completion_date?: string | null
          contact: string
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          hs_lastmodifieddate: string
          hs_task_id: string
          hs_timestamp?: string | null
          is_unassigned?: boolean
          owner: string
          priority: string
          queue: string
          queue_ids?: string[]
          status: string
          title: string
          updated_at?: string
        }
        Update: {
          completion_date?: string | null
          contact?: string
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          hs_lastmodifieddate?: string
          hs_task_id?: string
          hs_timestamp?: string | null
          is_unassigned?: boolean
          owner?: string
          priority?: string
          queue?: string
          queue_ids?: string[]
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
