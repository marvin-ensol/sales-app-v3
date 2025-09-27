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
          ensol_source_group: string | null
          firstname: string | null
          hs_lead_status: string | null
          hs_object_id: string
          lastmodifieddate: string | null
          lastname: string | null
          lifecyclestage: string | null
          mobilephone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          createdate?: string | null
          ensol_source_group?: string | null
          firstname?: string | null
          hs_lead_status?: string | null
          hs_object_id: string
          lastmodifieddate?: string | null
          lastname?: string | null
          lifecyclestage?: string | null
          mobilephone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          createdate?: string | null
          ensol_source_group?: string | null
          firstname?: string | null
          hs_lead_status?: string | null
          hs_object_id?: string
          lastmodifieddate?: string | null
          lastname?: string | null
          lifecyclestage?: string | null
          mobilephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hs_list_memberships: {
        Row: {
          automation_id: string | null
          created_at: string
          hs_list_entry_date: string | null
          hs_list_id: string | null
          hs_list_object: string | null
          hs_object_id: string | null
          hs_queue_id: string | null
          id: string
          last_api_call: string | null
          list_exit_date: string | null
          updated_at: string
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          hs_list_entry_date?: string | null
          hs_list_id?: string | null
          hs_list_object?: string | null
          hs_object_id?: string | null
          hs_queue_id?: string | null
          id?: string
          last_api_call?: string | null
          list_exit_date?: string | null
          updated_at?: string
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          hs_list_entry_date?: string | null
          hs_list_id?: string | null
          hs_list_object?: string | null
          hs_object_id?: string | null
          hs_queue_id?: string | null
          id?: string
          last_api_call?: string | null
          list_exit_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hs_list_memberships_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "task_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      hs_tasks: {
        Row: {
          archived: boolean | null
          associated_company_id: string | null
          associated_contact_id: string | null
          associated_deal_id: string | null
          created_at: string
          created_by_automation: boolean | null
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
          associated_company_id?: string | null
          associated_contact_id?: string | null
          associated_deal_id?: string | null
          created_at?: string
          created_by_automation?: boolean | null
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
          associated_company_id?: string | null
          associated_contact_id?: string | null
          associated_deal_id?: string | null
          created_at?: string
          created_by_automation?: boolean | null
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
      lists: {
        Row: {
          created_at: string
          data: Json
          id: string
          last_updated_at: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          last_updated_at?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          last_updated_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          execution_id: string
          execution_log: Json | null
          hubspot_api_calls: number | null
          started_at: string
          status: string
          sync_type: string
          task_details: Json | null
          tasks_created: number
          tasks_failed: number | null
          tasks_fetched: number | null
          tasks_updated: number | null
          trigger_source: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_id: string
          execution_log?: Json | null
          hubspot_api_calls?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          task_details?: Json | null
          tasks_created?: number
          tasks_failed?: number | null
          tasks_fetched?: number | null
          tasks_updated?: number | null
          trigger_source?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_id?: string
          execution_log?: Json | null
          hubspot_api_calls?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          task_details?: Json | null
          tasks_created?: number
          tasks_failed?: number | null
          tasks_fetched?: number | null
          tasks_updated?: number | null
          trigger_source?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_automations: {
        Row: {
          auto_complete_on_exit_enabled: boolean | null
          automation_enabled: boolean
          created_at: string
          first_task_creation: boolean | null
          hide_automation_card: boolean | null
          hs_list_id: string | null
          hs_list_object: string | null
          id: string
          name: string
          schedule_configuration: Json | null
          schedule_enabled: boolean | null
          sequence_enabled: boolean | null
          sequence_exit_enabled: boolean | null
          task_category_id: number
          tasks_configuration: Json | null
          updated_at: string
        }
        Insert: {
          auto_complete_on_exit_enabled?: boolean | null
          automation_enabled?: boolean
          created_at?: string
          first_task_creation?: boolean | null
          hide_automation_card?: boolean | null
          hs_list_id?: string | null
          hs_list_object?: string | null
          id?: string
          name: string
          schedule_configuration?: Json | null
          schedule_enabled?: boolean | null
          sequence_enabled?: boolean | null
          sequence_exit_enabled?: boolean | null
          task_category_id: number
          tasks_configuration?: Json | null
          updated_at?: string
        }
        Update: {
          auto_complete_on_exit_enabled?: boolean | null
          automation_enabled?: boolean
          created_at?: string
          first_task_creation?: boolean | null
          hide_automation_card?: boolean | null
          hs_list_id?: string | null
          hs_list_object?: string | null
          id?: string
          name?: string
          schedule_configuration?: Json | null
          schedule_enabled?: boolean | null
          sequence_enabled?: boolean | null
          sequence_exit_enabled?: boolean | null
          task_category_id?: number
          tasks_configuration?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_task_automations_category"
            columns: ["task_category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_task_category"
            columns: ["task_category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          color: string | null
          created_at: string
          hs_queue_id: string | null
          id: number
          label: string | null
          locks_lower_categories: boolean | null
          order_column: number
          system_default: boolean | null
          task_display_order: string | null
          visible_team_ids: Json | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          hs_queue_id?: string | null
          id?: number
          label?: string | null
          locks_lower_categories?: boolean | null
          order_column: number
          system_default?: boolean | null
          task_display_order?: string | null
          visible_team_ids?: Json | null
        }
        Update: {
          color?: string | null
          created_at?: string
          hs_queue_id?: string | null
          id?: number
          label?: string | null
          locks_lower_categories?: boolean | null
          order_column?: number
          system_default?: boolean | null
          task_display_order?: string | null
          visible_team_ids?: Json | null
        }
        Relationships: []
      }
      task_sync_attempts: {
        Row: {
          action_type: string
          attempt_number: number
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          execution_id: string | null
          hubspot_response: Json | null
          id: string
          started_at: string
          status: string
          task_hubspot_id: string
        }
        Insert: {
          action_type?: string
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_id?: string | null
          hubspot_response?: Json | null
          id?: string
          started_at?: string
          status?: string
          task_hubspot_id: string
        }
        Update: {
          action_type?: string
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_id?: string | null
          hubspot_response?: Json | null
          id?: string
          started_at?: string
          status?: string
          task_hubspot_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      enriched_tasks: {
        Row: {
          associated_deal_id: string | null
          completion_date: string | null
          contact: string | null
          contact_id: string | null
          contact_phone: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          hs_task_completion_date: string | null
          hubspot_id: string | null
          hubspot_owner_id: string | null
          id: string | null
          is_unassigned: boolean | null
          owner: string | null
          priority: string | null
          queue: string | null
          queue_ids: string[] | null
          raw_due_date: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hs_tasks_associated_contact"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hs_contacts"
            referencedColumns: ["hs_object_id"]
          },
        ]
      }
      hs_tasks_readable: {
        Row: {
          archived: boolean | null
          associated_contact_id: string | null
          associated_deal_id: string | null
          category_color: string | null
          category_label: string | null
          created_at: string | null
          hs_body_preview: string | null
          hs_created_by_user_id: string | null
          hs_createdate: string | null
          hs_duration: string | null
          hs_lastmodifieddate: string | null
          hs_object_id: string | null
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
          owner_email: string | null
          owner_first_name: string | null
          owner_full_name: string | null
          owner_last_name: string | null
          updated_at: string | null
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
    }
    Functions: {
      add_execution_log: {
        Args: {
          details?: Json
          execution_id_param: string
          log_level: string
          message: string
        }
        Returns: undefined
      }
      cleanup_old_sync_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_all_tasks: {
        Args: Record<PropertyKey, never>
        Returns: {
          completion_date: string
          contact: string
          contact_id: string
          contact_phone: string
          description: string
          due_date: string
          hs_timestamp: string
          hubspot_id: string
          id: string
          is_unassigned: boolean
          owner: string
          priority: string
          queue: string
          queue_ids: string[]
          status: string
          title: string
        }[]
      }
      get_owner_tasks: {
        Args: { owner_id_param: string }
        Returns: {
          completion_date: string
          contact: string
          contact_id: string
          contact_phone: string
          description: string
          due_date: string
          hs_timestamp: string
          hubspot_id: string
          id: string
          is_unassigned: boolean
          owner: string
          priority: string
          queue: string
          queue_ids: string[]
          status: string
          title: string
        }[]
      }
      get_task_categories: {
        Args: Record<PropertyKey, never> | { team_id_param?: string }
        Returns: {
          color: string
          hs_queue_id: string
          id: number
          label: string
          locks_lower_categories: boolean
          order_column: number
          task_display_order: string
        }[]
      }
      get_valid_owner_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
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
