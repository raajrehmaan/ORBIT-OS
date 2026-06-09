export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = "super_admin" | "organisation_owner" | "admin" | "staff" | "client";
export type ClinicAuthRole = "admin" | "staff" | "receptionist";
export type StaffRole = "organisation_owner" | "admin" | "therapist" | "receptionist" | "staff";
export type AppointmentStatus = "scheduled" | "confirmed" | "arrived" | "in_progress" | "completed" | "cancelled" | "rescheduled" | "no_show" | "archived";
export type PaymentStatus = "paid" | "partial" | "deposit" | "due" | "refunded";

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: { id: string; name: string; slug: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; slug: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          organisation_id: string | null;
          email: string;
          full_name: string;
          role: Role;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organisation_id?: string | null;
          email: string;
          full_name: string;
          role?: Role;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organisation_id?: string | null;
          email?: string;
          full_name?: string;
          role?: Role;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      auth_users: {
        Row: { id: string; organisation_id: string; username: string; password_hash: string; role: ClinicAuthRole; active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; username: string; password_hash: string; role?: ClinicAuthRole; active?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; username?: string; password_hash?: string; role?: ClinicAuthRole; active?: boolean; created_at?: string; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: "auth_users_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auth_users_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      staff: {
        Row: { id: string; organisation_id: string; user_id: string | null; full_name: string; email: string | null; phone: string | null; notes: string | null; role: StaffRole; active: boolean; deleted_at: string | null; deleted_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; user_id?: string | null; full_name: string; email?: string | null; phone?: string | null; notes?: string | null; role?: StaffRole; active?: boolean; deleted_at?: string | null; deleted_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; user_id?: string | null; full_name?: string; email?: string | null; phone?: string | null; notes?: string | null; role?: StaffRole; active?: boolean; deleted_at?: string | null; deleted_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: "staff_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      clients: {
        Row: { id: string; organisation_id: string; full_name: string; email: string | null; phone: string | null; notes: string | null; color_tag: string | null; archived_at: string | null; archived_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; full_name: string; email?: string | null; phone?: string | null; notes?: string | null; color_tag?: string | null; archived_at?: string | null; archived_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; full_name?: string; email?: string | null; phone?: string | null; notes?: string | null; color_tag?: string | null; archived_at?: string | null; archived_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: "clients_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      services: {
        Row: { id: string; organisation_id: string; name: string; description: string | null; duration_minutes: number; price: number; category: string; category_id: string | null; color: string; archived_at: string | null; archived_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; name: string; description?: string | null; duration_minutes: number; price?: number; category?: string; category_id?: string | null; color?: string; archived_at?: string | null; archived_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; name?: string; description?: string | null; duration_minutes?: number; price?: number; category?: string; category_id?: string | null; color?: string; archived_at?: string | null; archived_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: "services_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      service_categories: {
        Row: { id: string; organisation_id: string; name: string; color: string; description: string | null; archived_at: string | null; archived_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; name: string; color?: string; description?: string | null; archived_at?: string | null; archived_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; name?: string; color?: string; description?: string | null; archived_at?: string | null; archived_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      appointments: {
        Row: { id: string; organisation_id: string; client_id: string; staff_id: string | null; secondary_staff_id: string | null; service_id: string | null; service_snapshot_name: string | null; service_snapshot_price: number | null; service_snapshot_category: string | null; starts_at: string; ends_at: string; original_starts_at: string | null; original_ends_at: string | null; status: AppointmentStatus; appointment_status: AppointmentStatus; notes: string | null; treatment_notes: string | null; cancelled_at: string | null; cancelled_by: string | null; cancellation_reason: string | null; rescheduled_from_id: string | null; completed_at: string | null; no_show: boolean; color_code: string | null; deleted_at: string | null; deleted_by: string | null; delete_reason: string | null; session_number: number | null; total_sessions: number | null; treatment_price: number; deposit_amount: number; amount_paid: number; balance_due: number; payment_status: PaymentStatus; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; client_id: string; staff_id?: string | null; secondary_staff_id?: string | null; service_id?: string | null; service_snapshot_name?: string | null; service_snapshot_price?: number | null; service_snapshot_category?: string | null; starts_at: string; ends_at: string; original_starts_at?: string | null; original_ends_at?: string | null; status?: AppointmentStatus; appointment_status?: AppointmentStatus; notes?: string | null; treatment_notes?: string | null; cancelled_at?: string | null; cancelled_by?: string | null; cancellation_reason?: string | null; rescheduled_from_id?: string | null; completed_at?: string | null; no_show?: boolean; color_code?: string | null; deleted_at?: string | null; deleted_by?: string | null; delete_reason?: string | null; session_number?: number | null; total_sessions?: number | null; treatment_price?: number; deposit_amount?: number; amount_paid?: number; balance_due?: number; payment_status?: PaymentStatus; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; client_id?: string; staff_id?: string | null; secondary_staff_id?: string | null; service_id?: string | null; service_snapshot_name?: string | null; service_snapshot_price?: number | null; service_snapshot_category?: string | null; starts_at?: string; ends_at?: string; original_starts_at?: string | null; original_ends_at?: string | null; status?: AppointmentStatus; appointment_status?: AppointmentStatus; notes?: string | null; treatment_notes?: string | null; cancelled_at?: string | null; cancelled_by?: string | null; cancellation_reason?: string | null; rescheduled_from_id?: string | null; completed_at?: string | null; no_show?: boolean; color_code?: string | null; deleted_at?: string | null; deleted_by?: string | null; delete_reason?: string | null; session_number?: number | null; total_sessions?: number | null; treatment_price?: number; deposit_amount?: number; amount_paid?: number; balance_due?: number; payment_status?: PaymentStatus; created_at?: string; updated_at?: string };
        Relationships: [
          {
            foreignKeyName: "appointments_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          }
        ];
      };
      appointment_staff: {
        Row: { id: string; organisation_id: string; appointment_id: string; staff_id: string; staff_order: number; created_at: string };
        Insert: { id?: string; organisation_id: string; appointment_id: string; staff_id: string; staff_order: number; created_at?: string };
        Update: { id?: string; organisation_id?: string; appointment_id?: string; staff_id?: string; staff_order?: number; created_at?: string };
        Relationships: [];
      };
      treatment_records: {
        Row: { id: string; organisation_id: string; client_id: string; appointment_id: string | null; service_id: string | null; treatment_name: string; treatment_category: string | null; treatment_date: string; session_number: number | null; total_sessions: number | null; staff_summary: string | null; notes: string | null; outcome: string | null; before_after_notes: string | null; payment_status: PaymentStatus; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; client_id: string; appointment_id?: string | null; service_id?: string | null; treatment_name: string; treatment_category?: string | null; treatment_date?: string; session_number?: number | null; total_sessions?: number | null; staff_summary?: string | null; notes?: string | null; outcome?: string | null; before_after_notes?: string | null; payment_status?: PaymentStatus; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; client_id?: string; appointment_id?: string | null; service_id?: string | null; treatment_name?: string; treatment_category?: string | null; treatment_date?: string; session_number?: number | null; total_sessions?: number | null; staff_summary?: string | null; notes?: string | null; outcome?: string | null; before_after_notes?: string | null; payment_status?: PaymentStatus; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      payments: {
        Row: { id: string; organisation_id: string; client_id: string; appointment_id: string | null; treatment_record_id: string | null; treatment_price: number; deposit_amount: number; amount_paid: number; balance_due: number; payment_status: PaymentStatus; paid_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; client_id: string; appointment_id?: string | null; treatment_record_id?: string | null; treatment_price?: number; deposit_amount?: number; amount_paid?: number; balance_due?: number; payment_status?: PaymentStatus; paid_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; client_id?: string; appointment_id?: string | null; treatment_record_id?: string | null; treatment_price?: number; deposit_amount?: number; amount_paid?: number; balance_due?: number; payment_status?: PaymentStatus; paid_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      audit_logs: {
        Row: { id: string; organisation_id: string | null; user_id: string | null; entity_type: string; entity_id: string | null; action: string; metadata: Json; created_at: string };
        Insert: { id?: string; organisation_id?: string | null; user_id?: string | null; entity_type: string; entity_id?: string | null; action: string; metadata?: Json; created_at?: string };
        Update: { id?: string; organisation_id?: string | null; user_id?: string | null; entity_type?: string; entity_id?: string | null; action?: string; metadata?: Json; created_at?: string };
        Relationships: [];
      };
      status_colours: {
        Row: { id: string; organisation_id: string | null; colour_type: "appointment" | "payment"; status_key: string; colour: string; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id?: string | null; colour_type: "appointment" | "payment"; status_key: string; colour: string; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string | null; colour_type?: "appointment" | "payment"; status_key?: string; colour?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      appointment_status_colours: {
        Row: { id: string; organisation_id: string; status: string; background_color: string; text_color: string; created_at: string };
        Insert: { id?: string; organisation_id: string; status: string; background_color: string; text_color: string; created_at?: string };
        Update: { id?: string; organisation_id?: string; status?: string; background_color?: string; text_color?: string; created_at?: string };
        Relationships: [];
      };
      appointment_history: {
        Row: { id: string; organisation_id: string; appointment_id: string | null; client_id: string | null; action: string; appointment_status: AppointmentStatus | null; payment_status: PaymentStatus | null; service_snapshot_name: string | null; service_snapshot_price: number | null; service_snapshot_category: string | null; metadata: Json; created_by: string | null; created_at: string };
        Insert: { id?: string; organisation_id: string; appointment_id?: string | null; client_id?: string | null; action: string; appointment_status?: AppointmentStatus | null; payment_status?: PaymentStatus | null; service_snapshot_name?: string | null; service_snapshot_price?: number | null; service_snapshot_category?: string | null; metadata?: Json; created_by?: string | null; created_at?: string };
        Update: { id?: string; organisation_id?: string; appointment_id?: string | null; client_id?: string | null; action?: string; appointment_status?: AppointmentStatus | null; payment_status?: PaymentStatus | null; service_snapshot_name?: string | null; service_snapshot_price?: number | null; service_snapshot_category?: string | null; metadata?: Json; created_by?: string | null; created_at?: string };
        Relationships: [];
      };
      organisation_security_settings: {
        Row: { id: string; organisation_id: string; admin_pin_hash: string | null; recovery_code_hashes: Json; recovery_email: string | null; two_step_enabled: boolean; owner_password_verification_enabled: boolean; protect_client_archive: boolean; protect_staff_changes: boolean; protect_appointments: boolean; protect_services: boolean; protect_financials: boolean; protect_settings: boolean; pin_updated_at: string | null; pin_reset_requested_at: string | null; pin_reset_token_hash: string | null; pin_reset_token_expires_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; admin_pin_hash?: string | null; recovery_code_hashes?: Json; recovery_email?: string | null; two_step_enabled?: boolean; owner_password_verification_enabled?: boolean; protect_client_archive?: boolean; protect_staff_changes?: boolean; protect_appointments?: boolean; protect_services?: boolean; protect_financials?: boolean; protect_settings?: boolean; pin_updated_at?: string | null; pin_reset_requested_at?: string | null; pin_reset_token_hash?: string | null; pin_reset_token_expires_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; admin_pin_hash?: string | null; recovery_code_hashes?: Json; recovery_email?: string | null; two_step_enabled?: boolean; owner_password_verification_enabled?: boolean; protect_client_archive?: boolean; protect_staff_changes?: boolean; protect_appointments?: boolean; protect_services?: boolean; protect_financials?: boolean; protect_settings?: boolean; pin_updated_at?: string | null; pin_reset_requested_at?: string | null; pin_reset_token_hash?: string | null; pin_reset_token_expires_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      treatment_plans: {
        Row: { id: string; organisation_id: string; client_id: string; service_id: string | null; plan_name: string; total_sessions: number; completed_sessions: number; cancelled_sessions: number; no_show_sessions: number; plan_status: string; notes: string | null; created_at: string; updated_at: string; archived_at: string | null };
        Insert: { id?: string; organisation_id: string; client_id: string; service_id?: string | null; plan_name: string; total_sessions?: number; completed_sessions?: number; cancelled_sessions?: number; no_show_sessions?: number; plan_status?: string; notes?: string | null; created_at?: string; updated_at?: string; archived_at?: string | null };
        Update: { id?: string; organisation_id?: string; client_id?: string; service_id?: string | null; plan_name?: string; total_sessions?: number; completed_sessions?: number; cancelled_sessions?: number; no_show_sessions?: number; plan_status?: string; notes?: string | null; created_at?: string; updated_at?: string; archived_at?: string | null };
        Relationships: [];
      };
      treatment_sessions: {
        Row: { id: string; organisation_id: string; treatment_plan_id: string | null; client_id: string; appointment_id: string | null; session_number: number | null; treatment_name: string; session_status: string; scheduled_at: string | null; completed_at: string | null; cancelled_at: string | null; no_show_at: string | null; staff_summary: string | null; notes: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organisation_id: string; treatment_plan_id?: string | null; client_id: string; appointment_id?: string | null; session_number?: number | null; treatment_name: string; session_status?: string; scheduled_at?: string | null; completed_at?: string | null; cancelled_at?: string | null; no_show_at?: string | null; staff_summary?: string | null; notes?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; organisation_id?: string; treatment_plan_id?: string | null; client_id?: string; appointment_id?: string | null; session_number?: number | null; treatment_name?: string; session_status?: string; scheduled_at?: string | null; completed_at?: string | null; cancelled_at?: string | null; no_show_at?: string | null; staff_summary?: string | null; notes?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_user_organisation: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["users"]["Row"];
      };
      seed_default_services: {
        Args: { target_organisation_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: Role;
      appointment_status: AppointmentStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
