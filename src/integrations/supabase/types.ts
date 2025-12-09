export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          company_id: string
          company_name: string
          email_domain: string | null
          selected_plan: string | null
          subscription_status: string | null
          subscription_start: string | null
          subscription_end: string | null
          cv_processed_count: number | null
          cv_processing_reset_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          company_name: string
          email_domain?: string | null
          selected_plan?: string | null
          subscription_status?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          cv_processed_count?: number | null
          cv_processing_reset_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_name?: string
          email_domain?: string | null
          selected_plan?: string | null
          subscription_status?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          cv_processed_count?: number | null
          cv_processing_reset_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          user_id: string
          company_id: string | null
          first_name: string | null
          last_name: string | null
          role: string | null
          user_status: string | null
          created_at: string
        }
        Insert: {
          user_id?: string
          company_id?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: string | null
          user_status?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          company_id?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: string | null
          user_status?: string | null
          created_at?: string
        }
      }
      job_descriptions: {
        Row: {
          jd_id: string
          company_id: string | null
          user_id: string | null
          title: string | null
          description: string | null
          jd_file: string | null
          criteria_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          jd_id?: string
          company_id?: string | null
          user_id?: string | null
          title?: string | null
          description?: string | null
          jd_file?: string | null
          criteria_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          jd_id?: string
          company_id?: string | null
          user_id?: string | null
          title?: string | null
          description?: string | null
          jd_file?: string | null
          criteria_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      resumes: {
        Row: {
          resume_id: string
          company_id: string | null
          user_id: string | null
          candidate_name: string
          cv_file: string | null
          evaluation_scores: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          resume_id?: string
          company_id?: string | null
          user_id?: string | null
          candidate_name: string
          cv_file?: string | null
          evaluation_scores?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          resume_id?: string
          company_id?: string | null
          user_id?: string | null
          candidate_name?: string
          cv_file?: string | null
          evaluation_scores?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      criteria: {
        Row: {
          criteria_id: string
          criteria_name: string
          parameter: string
          weightage: number
          calc_note: string | null
          created_by: string | null
          company_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          criteria_id?: string
          criteria_name: string
          parameter: string
          weightage: number
          calc_note?: string | null
          created_by?: string | null
          company_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          criteria_id?: string
          criteria_name?: string
          parameter?: string
          weightage?: number
          calc_note?: string | null
          created_by?: string | null
          company_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      plans: {
        Row: {
          plan_id: string
          plan_name: string | null
          plan_cost: number | null
          max_token: number | null
          active_jobs: number | null
          max_cvs: number | null
          max_users: number | null
          duration: number | null
          status: string | null
        }
        Insert: {
          plan_id?: string
          plan_name?: string | null
          plan_cost?: number | null
          max_token?: number | null
          active_jobs?: number | null
          max_cvs?: number | null
          max_users?: number | null
          duration?: number | null
          status?: string | null
        }
        Update: {
          plan_id?: string
          plan_name?: string | null
          plan_cost?: number | null
          max_token?: number | null
          active_jobs?: number | null
          max_cvs?: number | null
          max_users?: number | null
          duration?: number | null
          status?: string | null
        }
      }
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id'>;
        Update: Partial<Omit<Client, 'id'>>;
      }
      contracts: {
        Row: Contract;
        Insert: Omit<Contract, 'id' | 'created_at'>;
        Update: Partial<Omit<Contract, 'id' | 'created_at'>>;
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

export type Client = {
  id: string;
  client_name: string;
};

export type Contract = {
  id: string;
  client_id: string;
  contact_person: string | null;
  contact_no: string | null;
  email: string | null;
  pricing_method: 'fixed' | 'per_weight';
  fixed_price: number | null;
  price_per_kg: number | null;
  valid_from: string;
  valid_till: string;
  created_at: string;
};
