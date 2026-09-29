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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string
          delegate_ids: string[]
          description: string
          id: string
          mcp_tool_ids: string[]
          model: string
          name: string
          skill_ids: string[]
          sort_order: number
          system_prompt: string
          tool_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delegate_ids?: string[]
          description?: string
          id?: string
          mcp_tool_ids?: string[]
          model?: string
          name: string
          skill_ids?: string[]
          sort_order?: number
          system_prompt?: string
          tool_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          delegate_ids?: string[]
          description?: string
          id?: string
          mcp_tool_ids?: string[]
          model?: string
          name?: string
          skill_ids?: string[]
          sort_order?: number
          system_prompt?: string
          tool_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          label: string
          model_id: string
          provider: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          model_id: string
          provider: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          model_id?: string
          provider?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      delegate_sessions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          messages: Json
          pending: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          messages?: Json
          pending?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          messages?: Json
          pending?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mcp_connections: {
        Row: {
          approval_tools: string[]
          auth_type: string
          created_at: string
          disabled_tools: string[]
          header_name: string
          id: string
          last_error: string | null
          name: string
          proxy_url: string | null
          secret_enc: string | null
          state: string
          tools: Json
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          approval_tools?: string[]
          auth_type?: string
          created_at?: string
          disabled_tools?: string[]
          header_name?: string
          id?: string
          last_error?: string | null
          name: string
          proxy_url?: string | null
          secret_enc?: string | null
          state?: string
          tools?: Json
          updated_at?: string
          url: string
          user_id?: string
        }
        Update: {
          approval_tools?: string[]
          auth_type?: string
          created_at?: string
          disabled_tools?: string[]
          header_name?: string
          id?: string
          last_error?: string | null
          name?: string
          proxy_url?: string | null
          secret_enc?: string | null
          state?: string
          tools?: Json
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      message_feedback: {
        Row: {
          comment: string
          created_at: string
          message_id: string
          model: string | null
          rating: number
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          message_id: string
          model?: string | null
          rating: number
          thread_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          comment?: string
          created_at?: string
          message_id?: string
          model?: string | null
          rating?: number
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_feedback_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          parent_id: string | null
          parts: Json
          role: string
          selected_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          metadata?: Json
          parent_id?: string | null
          parts?: Json
          role: string
          selected_at?: string | null
          thread_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          parent_id?: string | null
          parts?: Json
          role?: string
          selected_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          content: string
          created_at: string
          description: string
          enabled: boolean
          files: Json
          id: string
          name: string
          path: string | null
          ref: string | null
          source_type: string
          source_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          description?: string
          enabled?: boolean
          files?: Json
          id?: string
          name: string
          path?: string | null
          ref?: string | null
          source_type?: string
          source_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string
          enabled?: boolean
          files?: Json
          id?: string
          name?: string
          path?: string | null
          ref?: string | null
          source_type?: string
          source_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          agent_id: string | null
          created_at: string
          goal: string | null
          group_name: string
          id: string
          model: string
          permission: string
          plan_mode: boolean
          summary: string | null
          summary_upto: string | null
          title: string
          total_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          goal?: string | null
          group_name?: string
          id?: string
          model?: string
          permission?: string
          plan_mode?: boolean
          summary?: string | null
          summary_upto?: string | null
          title?: string
          total_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          goal?: string | null
          group_name?: string
          id?: string
          model?: string
          permission?: string
          plan_mode?: boolean
          summary?: string | null
          summary_upto?: string | null
          title?: string
          total_tokens?: number
          updated_at?: string
          user_id?: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
