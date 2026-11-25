export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          created_at: string;
          diff: Json | null;
          id: number;
          person_id: string | null;
          target: string | null;
          trip_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string;
          diff?: Json | null;
          id?: never;
          person_id?: string | null;
          target?: string | null;
          trip_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          diff?: Json | null;
          id?: never;
          person_id?: string | null;
          target?: string | null;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_line: {
        Row: {
          amount_home: number;
          category: Database["public"]["Enums"]["expense_category"];
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_home: number;
          category: Database["public"]["Enums"]["expense_category"];
          trip_id: string;
        };
        Update: {
          amount_home?: number;
          category?: Database["public"]["Enums"]["expense_category"];
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_line_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      comment: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          person_id: string | null;
          target_id: string;
          target_table: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          person_id?: string | null;
          target_id: string;
          target_table: string;
          trip_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          person_id?: string | null;
          target_id?: string;
          target_table?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comment_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      country_info: {
        Row: {
          aa_content_id: string | null;
          aa_last_modified: string | null;
          aa_partial_warning: boolean | null;
          aa_situation_warning: boolean | null;
          aa_title: string | null;
          aa_warning: boolean | null;
          ai_summary: Json | null;
          ai_summary_at: string | null;
          country_code: string;
          name_de: string | null;
          notes: string | null;
          toll_note: string | null;
          trailer_speed: Json | null;
        };
        ComputedFields: never;
        Insert: {
          aa_content_id?: string | null;
          aa_last_modified?: string | null;
          aa_partial_warning?: boolean | null;
          aa_situation_warning?: boolean | null;
          aa_title?: string | null;
          aa_warning?: boolean | null;
          ai_summary?: Json | null;
          ai_summary_at?: string | null;
          country_code: string;
          name_de?: string | null;
          notes?: string | null;
          toll_note?: string | null;
          trailer_speed?: Json | null;
        };
        Update: {
          aa_content_id?: string | null;
          aa_last_modified?: string | null;
          aa_partial_warning?: boolean | null;
          aa_situation_warning?: boolean | null;
          aa_title?: string | null;
          aa_warning?: boolean | null;
          ai_summary?: Json | null;
          ai_summary_at?: string | null;
          country_code?: string;
          name_de?: string | null;
          notes?: string | null;
          toll_note?: string | null;
          trailer_speed?: Json | null;
        };
        Relationships: [];
      };
      day_item: {
        Row: {
          booking_ref: string | null;
          created_by: string | null;
          day: string | null;
          details: NonNullable<Json>;
          end_at: string | null;
          end_place_id: string | null;
          end_tz: string | null;
          id: string;
          kind: Database["public"]["Enums"]["item_kind"];
          place_id: string | null;
          position: number;
          span_days: number;
          start_at: string | null;
          title: string;
          trip_id: string;
          tz: string | null;
          updated_at: string;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          booking_ref?: string | null;
          created_by?: string | null;
          day?: string | null;
          details?: NonNullable<Json>;
          end_at?: string | null;
          end_place_id?: string | null;
          end_tz?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["item_kind"];
          place_id?: string | null;
          position?: number;
          span_days?: number;
          start_at?: string | null;
          title: string;
          trip_id: string;
          tz?: string | null;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          booking_ref?: string | null;
          created_by?: string | null;
          day?: string | null;
          details?: NonNullable<Json>;
          end_at?: string | null;
          end_place_id?: string | null;
          end_tz?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["item_kind"];
          place_id?: string | null;
          position?: number;
          span_days?: number;
          start_at?: string | null;
          title?: string;
          trip_id?: string;
          tz?: string | null;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "day_item_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "day_item_end_place_id_fkey";
            columns: ["end_place_id"];
            isOneToOne: false;
            referencedRelation: "place";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "day_item_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "place";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "day_item_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      document_link: {
        Row: {
          created_at: string;
          day_item_id: string | null;
          household_id: string;
          id: string;
          kdrive_file_id: string;
          kdrive_url: string | null;
          mime_type: string | null;
          person_id: string | null;
          title: string;
          trip_id: string | null;
          type: Database["public"]["Enums"]["doc_type"];
          valid_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day_item_id?: string | null;
          household_id: string;
          id?: string;
          kdrive_file_id: string;
          kdrive_url?: string | null;
          mime_type?: string | null;
          person_id?: string | null;
          title: string;
          trip_id?: string | null;
          type: Database["public"]["Enums"]["doc_type"];
          valid_until?: string | null;
        };
        Update: {
          created_at?: string;
          day_item_id?: string | null;
          household_id?: string;
          id?: string;
          kdrive_file_id?: string;
          kdrive_url?: string | null;
          mime_type?: string | null;
          person_id?: string | null;
          title?: string;
          trip_id?: string | null;
          type?: Database["public"]["Enums"]["doc_type"];
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_link_day_item_id_fkey";
            columns: ["day_item_id"];
            isOneToOne: false;
            referencedRelation: "day_item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_link_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_link_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_link_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      event: {
        Row: {
          calendar_uid: string | null;
          created_at: string;
          end_date: string;
          household_id: string;
          id: string;
          kind: Database["public"]["Enums"]["event_kind"];
          notes: string | null;
          place_id: string | null;
          start_date: string;
          title: string;
          trip_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          calendar_uid?: string | null;
          created_at?: string;
          end_date: string;
          household_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["event_kind"];
          notes?: string | null;
          place_id?: string | null;
          start_date: string;
          title: string;
          trip_id?: string | null;
        };
        Update: {
          calendar_uid?: string | null;
          created_at?: string;
          end_date?: string;
          household_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["event_kind"];
          notes?: string | null;
          place_id?: string | null;
          start_date?: string;
          title?: string;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "place";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      event_person: {
        Row: {
          event_id: string;
          person_id: string;
          school_days: number;
          school_request_deadline: string | null;
          school_status: Database["public"]["Enums"]["school_status"];
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          person_id: string;
          school_days?: number;
          school_request_deadline?: string | null;
          school_status?: Database["public"]["Enums"]["school_status"];
        };
        Update: {
          event_id?: string;
          person_id?: string;
          school_days?: number;
          school_request_deadline?: string | null;
          school_status?: Database["public"]["Enums"]["school_status"];
        };
        Relationships: [
          {
            foreignKeyName: "event_person_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "event";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_person_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
        ];
      };
      event_person_leave: {
        Row: {
          event_id: string;
          leave_days: number;
          leave_status: Database["public"]["Enums"]["leave_status"];
          person_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          leave_days?: number;
          leave_status?: Database["public"]["Enums"]["leave_status"];
          person_id: string;
        };
        Update: {
          event_id?: string;
          leave_days?: number;
          leave_status?: Database["public"]["Enums"]["leave_status"];
          person_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_person_leave_event_id_person_id_fkey";
            columns: ["event_id", "person_id"];
            isOneToOne: true;
            referencedRelation: "event_person";
            referencedColumns: ["event_id", "person_id"];
          },
        ];
      };
      expense: {
        Row: {
          amount: number;
          amount_home: number | null;
          category: Database["public"]["Enums"]["expense_category"];
          created_at: string;
          currency: string;
          day_item_id: string | null;
          fx_overridden: boolean;
          fx_rate: number;
          id: string;
          kdrive_file_id: string | null;
          note: string | null;
          paid_by: string | null;
          spent_on: string;
          status: Database["public"]["Enums"]["expense_status"];
          title: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          amount_home?: never;
          category: Database["public"]["Enums"]["expense_category"];
          created_at?: string;
          currency: string;
          day_item_id?: string | null;
          fx_overridden?: boolean;
          fx_rate?: number;
          id?: string;
          kdrive_file_id?: string | null;
          note?: string | null;
          paid_by?: string | null;
          spent_on: string;
          status?: Database["public"]["Enums"]["expense_status"];
          title: string;
          trip_id: string;
        };
        Update: {
          amount?: number;
          amount_home?: never;
          category?: Database["public"]["Enums"]["expense_category"];
          created_at?: string;
          currency?: string;
          day_item_id?: string | null;
          fx_overridden?: boolean;
          fx_rate?: number;
          id?: string;
          kdrive_file_id?: string | null;
          note?: string | null;
          paid_by?: string | null;
          spent_on?: string;
          status?: Database["public"]["Enums"]["expense_status"];
          title?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_day_item_id_fkey";
            columns: ["day_item_id"];
            isOneToOne: false;
            referencedRelation: "day_item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_paid_by_fkey";
            columns: ["paid_by"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      fx_rate: {
        Row: {
          base: string;
          quote: string;
          rate: number;
          rate_date: string;
        };
        ComputedFields: never;
        Insert: {
          base: string;
          quote: string;
          rate: number;
          rate_date: string;
        };
        Update: {
          base?: string;
          quote?: string;
          rate?: number;
          rate_date?: string;
        };
        Relationships: [];
      };
      holiday_period: {
        Row: {
          end_date: string;
          external_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["holiday_kind"];
          name: string;
          school_id: string | null;
          source: string;
          start_date: string;
          state_code: string | null;
        };
        ComputedFields: never;
        Insert: {
          end_date: string;
          external_id?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["holiday_kind"];
          name: string;
          school_id?: string | null;
          source?: string;
          start_date: string;
          state_code?: string | null;
        };
        Update: {
          end_date?: string;
          external_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["holiday_kind"];
          name?: string;
          school_id?: string | null;
          source?: string;
          start_date?: string;
          state_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "holiday_period_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "school";
            referencedColumns: ["id"];
          },
        ];
      };
      household: {
        Row: {
          created_at: string;
          home_currency: string;
          ics_token: string;
          id: string;
          kdrive_drive_id: string | null;
          kdrive_root_folder_id: string | null;
          name: string;
          state_code: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          home_currency?: string;
          ics_token?: string;
          id?: string;
          kdrive_drive_id?: string | null;
          kdrive_root_folder_id?: string | null;
          name: string;
          state_code?: string;
        };
        Update: {
          created_at?: string;
          home_currency?: string;
          ics_token?: string;
          id?: string;
          kdrive_drive_id?: string | null;
          kdrive_root_folder_id?: string | null;
          name?: string;
          state_code?: string;
        };
        Relationships: [];
      };
      inbound_email: {
        Row: {
          body_text: string | null;
          error: string | null;
          from_address: string | null;
          household_id: string;
          id: string;
          parsed: Json | null;
          received_at: string;
          status: Database["public"]["Enums"]["inbound_status"];
          subject: string | null;
          trip_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          body_text?: string | null;
          error?: string | null;
          from_address?: string | null;
          household_id: string;
          id?: string;
          parsed?: Json | null;
          received_at?: string;
          status?: Database["public"]["Enums"]["inbound_status"];
          subject?: string | null;
          trip_id?: string | null;
        };
        Update: {
          body_text?: string | null;
          error?: string | null;
          from_address?: string | null;
          household_id?: string;
          id?: string;
          parsed?: Json | null;
          received_at?: string;
          status?: Database["public"]["Enums"]["inbound_status"];
          subject?: string | null;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inbound_email_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inbound_email_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_balance: {
        Row: {
          entitlement_days: number;
          id: string;
          period_end: string;
          period_start: string;
          person_id: string;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          entitlement_days: number;
          id?: string;
          period_end: string;
          period_start: string;
          person_id: string;
          year: number;
        };
        Update: {
          entitlement_days?: number;
          id?: string;
          period_end?: string;
          period_start?: string;
          person_id?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "leave_balance_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
        ];
      };
      packing_item: {
        Row: {
          category: string;
          checked: boolean;
          id: string;
          name: string;
          person_id: string | null;
          qty: number;
          sort: number;
          template_item_id: string | null;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          checked?: boolean;
          id?: string;
          name: string;
          person_id?: string | null;
          qty?: number;
          sort?: number;
          template_item_id?: string | null;
          trip_id: string;
        };
        Update: {
          category?: string;
          checked?: boolean;
          id?: string;
          name?: string;
          person_id?: string | null;
          qty?: number;
          sort?: number;
          template_item_id?: string | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packing_item_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "packing_item_template_item_id_fkey";
            columns: ["template_item_id"];
            isOneToOne: false;
            referencedRelation: "packing_template_item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "packing_item_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      packing_template_item: {
        Row: {
          category: string;
          household_id: string;
          id: string;
          name: string;
          per_person: boolean;
          qty_rule: Json | null;
          rules: NonNullable<Json>;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          household_id: string;
          id?: string;
          name: string;
          per_person?: boolean;
          qty_rule?: Json | null;
          rules?: NonNullable<Json>;
          sort?: number;
        };
        Update: {
          category?: string;
          household_id?: string;
          id?: string;
          name?: string;
          per_person?: boolean;
          qty_rule?: Json | null;
          rules?: NonNullable<Json>;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: "packing_template_item_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
        ];
      };
      person: {
        Row: {
          birth_year: number | null;
          color: string;
          display_name: string;
          email: string | null;
          household_id: string;
          id: string;
          kind: Database["public"]["Enums"]["person_kind"];
          school_id: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          birth_year?: number | null;
          color?: string;
          display_name: string;
          email?: string | null;
          household_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["person_kind"];
          school_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          birth_year?: number | null;
          color?: string;
          display_name?: string;
          email?: string | null;
          household_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["person_kind"];
          school_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "person_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "school";
            referencedColumns: ["id"];
          },
        ];
      };
      place: {
        Row: {
          address: string | null;
          country_code: string | null;
          external_id: string | null;
          household_id: string;
          id: string;
          lat: number | null;
          lon: number | null;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          country_code?: string | null;
          external_id?: string | null;
          household_id: string;
          id?: string;
          lat?: number | null;
          lon?: number | null;
          name: string;
        };
        Update: {
          address?: string | null;
          country_code?: string | null;
          external_id?: string | null;
          household_id?: string;
          id?: string;
          lat?: number | null;
          lon?: number | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
        ];
      };
      poll: {
        Row: {
          created_at: string;
          created_by: string | null;
          deadline: string | null;
          decided_option_id: string | null;
          id: string;
          question: string;
          status: Database["public"]["Enums"]["poll_status"];
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deadline?: string | null;
          decided_option_id?: string | null;
          id?: string;
          question: string;
          status?: Database["public"]["Enums"]["poll_status"];
          trip_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deadline?: string | null;
          decided_option_id?: string | null;
          id?: string;
          question?: string;
          status?: Database["public"]["Enums"]["poll_status"];
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "poll_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_decided_fk";
            columns: ["decided_option_id"];
            isOneToOne: false;
            referencedRelation: "poll_option";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_option: {
        Row: {
          id: string;
          label: string;
          payload: NonNullable<Json>;
          poll_id: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          label: string;
          payload?: NonNullable<Json>;
          poll_id: string;
          position?: number;
        };
        Update: {
          id?: string;
          label?: string;
          payload?: NonNullable<Json>;
          poll_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "poll_option_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "poll";
            referencedColumns: ["id"];
          },
        ];
      };
      route_cache: {
        Row: {
          created_at: string;
          distance_m: number;
          duration_s: number;
          geometry: NonNullable<Json>;
          hash: string;
          profile: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          distance_m: number;
          duration_s: number;
          geometry: NonNullable<Json>;
          hash: string;
          profile: string;
        };
        Update: {
          created_at?: string;
          distance_m?: number;
          duration_s?: number;
          geometry?: NonNullable<Json>;
          hash?: string;
          profile?: string;
        };
        Relationships: [];
      };
      school: {
        Row: {
          household_id: string;
          id: string;
          name: string;
          state_code: string;
        };
        ComputedFields: never;
        Insert: {
          household_id: string;
          id?: string;
          name: string;
          state_code?: string;
        };
        Update: {
          household_id?: string;
          id?: string;
          name?: string;
          state_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
        ];
      };
      trip: {
        Row: {
          activities: string[];
          caravan_id: string | null;
          climate: string[];
          created_at: string;
          created_by: string | null;
          end_date: string;
          household_id: string;
          id: string;
          international: boolean;
          kdrive_folder_id: string | null;
          mode: Database["public"]["Enums"]["trip_mode"];
          notes: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["trip_status"];
          title: string;
          tow_vehicle_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activities?: string[];
          caravan_id?: string | null;
          climate?: string[];
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          household_id: string;
          id?: string;
          international?: boolean;
          kdrive_folder_id?: string | null;
          mode?: Database["public"]["Enums"]["trip_mode"];
          notes?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["trip_status"];
          title: string;
          tow_vehicle_id?: string | null;
          updated_at?: string;
        };
        Update: {
          activities?: string[];
          caravan_id?: string | null;
          climate?: string[];
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          household_id?: string;
          id?: string;
          international?: boolean;
          kdrive_folder_id?: string | null;
          mode?: Database["public"]["Enums"]["trip_mode"];
          notes?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["trip_status"];
          title?: string;
          tow_vehicle_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_caravan_id_fkey";
            columns: ["caravan_id"];
            isOneToOne: false;
            referencedRelation: "vehicle";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_tow_vehicle_id_fkey";
            columns: ["tow_vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicle";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_member: {
        Row: {
          person_id: string;
          role: Database["public"]["Enums"]["trip_role"];
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          person_id: string;
          role?: Database["public"]["Enums"]["trip_role"];
          trip_id: string;
        };
        Update: {
          person_id?: string;
          role?: Database["public"]["Enums"]["trip_role"];
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_member_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_member_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trip";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle: {
        Row: {
          height_m: number | null;
          household_id: string;
          id: string;
          kind: Database["public"]["Enums"]["vehicle_kind"];
          length_m: number | null;
          name: string;
          weight_kg: number | null;
          width_m: number | null;
        };
        ComputedFields: never;
        Insert: {
          height_m?: number | null;
          household_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["vehicle_kind"];
          length_m?: number | null;
          name: string;
          weight_kg?: number | null;
          width_m?: number | null;
        };
        Update: {
          height_m?: number | null;
          household_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["vehicle_kind"];
          length_m?: number | null;
          name?: string;
          weight_kg?: number | null;
          width_m?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "household";
            referencedColumns: ["id"];
          },
        ];
      };
      vote: {
        Row: {
          person_id: string;
          poll_option_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          person_id: string;
          poll_option_id: string;
          value: number;
        };
        Update: {
          person_id?: string;
          poll_option_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "vote_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "person";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vote_poll_option_id_fkey";
            columns: ["poll_option_id"];
            isOneToOne: false;
            referencedRelation: "poll_option";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_member: { Args: { hh: string }; Returns: boolean };
      is_parent: { Args: { hh: string }; Returns: boolean };
      my_person_id: { Args: Record<PropertyKey, never>; Returns: string };
      option_household: { Args: { o: string }; Returns: string };
      poll_household: { Args: { p: string }; Returns: string };
      trip_household: { Args: { t: string }; Returns: string };
    };
    Enums: {
      doc_type:
        | "ticket"
        | "booking"
        | "insurance"
        | "passport"
        | "visa"
        | "receipt"
        | "other";
      event_kind:
        | "tournament"
        | "camp"
        | "tryout"
        | "vacation"
        | "business_trip"
        | "other";
      expense_category:
        "transport" | "lodging" | "food" | "activities" | "fees" | "other";
      expense_status: "planned" | "booked" | "paid" | "refunded";
      holiday_kind: "school_holiday" | "public_holiday" | "school_day_off";
      inbound_status: "received" | "parsed" | "applied" | "rejected" | "failed";
      item_kind:
        | "transport"
        | "flight"
        | "lodging"
        | "campsite"
        | "activity"
        | "game"
        | "note";
      leave_status: "not_needed" | "planned" | "requested" | "approved";
      person_kind: "parent" | "child";
      poll_status: "open" | "closed";
      school_status:
        "not_needed" | "to_request" | "requested" | "approved" | "rejected";
      trip_mode: "car" | "flight" | "caravan" | "mixed";
      trip_role: "planner" | "traveler";
      trip_status: "idea" | "planned" | "booked" | "ongoing" | "done";
      vehicle_kind: "car" | "tow_vehicle" | "caravan";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      doc_type: [
        "ticket",
        "booking",
        "insurance",
        "passport",
        "visa",
        "receipt",
        "other",
      ],
      event_kind: [
        "tournament",
        "camp",
        "tryout",
        "vacation",
        "business_trip",
        "other",
      ],
      expense_category: [
        "transport",
        "lodging",
        "food",
        "activities",
        "fees",
        "other",
      ],
      expense_status: ["planned", "booked", "paid", "refunded"],
      holiday_kind: ["school_holiday", "public_holiday", "school_day_off"],
      inbound_status: ["received", "parsed", "applied", "rejected", "failed"],
      item_kind: [
        "transport",
        "flight",
        "lodging",
        "campsite",
        "activity",
        "game",
        "note",
      ],
      leave_status: ["not_needed", "planned", "requested", "approved"],
      person_kind: ["parent", "child"],
      poll_status: ["open", "closed"],
      school_status: [
        "not_needed",
        "to_request",
        "requested",
        "approved",
        "rejected",
      ],
      trip_mode: ["car", "flight", "caravan", "mixed"],
      trip_role: ["planner", "traveler"],
      trip_status: ["idea", "planned", "booked", "ongoing", "done"],
      vehicle_kind: ["car", "tow_vehicle", "caravan"],
    },
  },
} as const;
