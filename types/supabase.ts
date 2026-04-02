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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_actions: {
        Row: {
          agent_type: string
          created_at: string | null
          description: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          org_id: string
          payload: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          title: string
          triggered_at: string | null
        }
        Insert: {
          agent_type: string
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          org_id: string
          payload?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title: string
          triggered_at?: string | null
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          org_id?: string
          payload?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title?: string
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_date: string | null
          bill_number: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          image_url: string | null
          org_id: string
          parsed_items: Json | null
          raw_ocr_text: string | null
          status: string | null
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number | null
        }
        Insert: {
          bill_date?: string | null
          bill_number?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_url?: string | null
          org_id: string
          parsed_items?: Json | null
          raw_ocr_text?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
        }
        Update: {
          bill_date?: string | null
          bill_number?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_url?: string | null
          org_id?: string
          parsed_items?: Json | null
          raw_ocr_text?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          cost_per_unit: number | null
          created_at: string | null
          current_stock: number | null
          earliest_expiry: string | null
          id: string
          is_archived: boolean | null
          name: string
          name_normalised: string | null
          org_id: string
          preferred_supplier_id: string | null
          reorder_point: number | null
          reorder_qty: number | null
          track_expiry: boolean | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          earliest_expiry?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          name_normalised?: string | null
          org_id: string
          preferred_supplier_id?: string | null
          reorder_point?: number | null
          reorder_qty?: number | null
          track_expiry?: boolean | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          earliest_expiry?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          name_normalised?: string | null
          org_id?: string
          preferred_supplier_id?: string | null
          reorder_point?: number | null
          reorder_qty?: number | null
          track_expiry?: boolean | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          industry: string
          name: string
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          industry?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          industry?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          org_id: string
          quantity: number
          recipe_id: string
          unit: string
          unit_multiplier: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          org_id: string
          quantity: number
          recipe_id: string
          unit: string
          unit_multiplier?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          org_id?: string
          quantity?: number
          recipe_id?: string
          unit?: string
          unit_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          name: string
          notes: string | null
          org_id: string
          updated_at: string | null
          yield_qty: number | null
          yield_unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          notes?: string | null
          org_id: string
          updated_at?: string | null
          yield_qty?: number | null
          yield_unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string
          updated_at?: string | null
          yield_qty?: number | null
          yield_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          name_normalised: string | null
          notes: string | null
          org_id: string
          phone: string | null
          total_orders: number | null
          total_spend: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_normalised?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          total_orders?: number | null
          total_spend?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_normalised?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          total_orders?: number | null
          total_spend?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agent_action_id: string | null
          bill_id: string | null
          cost_per_unit: number | null
          created_at: string | null
          id: string
          item_id: string
          note: string | null
          org_id: string
          performed_by: string | null
          quantity: number
          recipe_id: string | null
          type: string
          unit: string
          unit_multiplier: number | null
        }
        Insert: {
          agent_action_id?: string | null
          bill_id?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          id?: string
          item_id: string
          note?: string | null
          org_id: string
          performed_by?: string | null
          quantity: number
          recipe_id?: string | null
          type: string
          unit: string
          unit_multiplier?: number | null
        }
        Update: {
          agent_action_id?: string | null
          bill_id?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          id?: string
          item_id?: string
          note?: string | null
          org_id?: string
          performed_by?: string | null
          quantity?: number
          recipe_id?: string | null
          type?: string
          unit?: string
          unit_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_agent_action_id_fkey"
            columns: ["agent_action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_conversions: {
        Row: {
          from_unit: string
          id: string
          multiplier: number
          to_unit: string
        }
        Insert: {
          from_unit: string
          id?: string
          multiplier: number
          to_unit: string
        }
        Update: {
          from_unit?: string
          id?: string
          multiplier?: number
          to_unit?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          onboarding_complete: boolean | null
          org_id: string | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          onboarding_complete?: boolean | null
          org_id?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          onboarding_complete?: boolean | null
          org_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          gemini_key: string | null
          groq_key_index: number | null
          groq_keys: string | null
          id: string
          notify_email: boolean | null
          notify_push: boolean | null
          org_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          gemini_key?: string | null
          groq_key_index?: number | null
          groq_keys?: string | null
          id?: string
          notify_email?: boolean | null
          notify_push?: boolean | null
          org_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          gemini_key?: string | null
          groq_key_index?: number | null
          groq_keys?: string | null
          id?: string
          notify_email?: boolean | null
          notify_push?: boolean | null
          org_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
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
