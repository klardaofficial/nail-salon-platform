export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage_events: {
        Row: {
          cached_input_tokens: number | null
          channel: string
          completed_at: string | null
          conversation_id: string | null
          estimated_cost_usd: number | null
          failure_code: string | null
          id: string
          image_count: number
          input_image_tokens: number | null
          input_text_tokens: number | null
          input_tokens: number | null
          kind: string
          model: string
          output_image_tokens: number | null
          output_text_tokens: number | null
          output_tokens: number | null
          preview_request_id: string | null
          pricing: Json | null
          provider_request_id: string | null
          reasoning_tokens: number | null
          response_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          cached_input_tokens?: number | null
          channel: string
          completed_at?: string | null
          conversation_id?: string | null
          estimated_cost_usd?: number | null
          failure_code?: string | null
          id?: string
          image_count?: number
          input_image_tokens?: number | null
          input_text_tokens?: number | null
          input_tokens?: number | null
          kind: string
          model: string
          output_image_tokens?: number | null
          output_text_tokens?: number | null
          output_tokens?: number | null
          preview_request_id?: string | null
          pricing?: Json | null
          provider_request_id?: string | null
          reasoning_tokens?: number | null
          response_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          cached_input_tokens?: number | null
          channel?: string
          completed_at?: string | null
          conversation_id?: string | null
          estimated_cost_usd?: number | null
          failure_code?: string | null
          id?: string
          image_count?: number
          input_image_tokens?: number | null
          input_text_tokens?: number | null
          input_tokens?: number | null
          kind?: string
          model?: string
          output_image_tokens?: number | null
          output_text_tokens?: number | null
          output_tokens?: number | null
          preview_request_id?: string | null
          pricing?: Json | null
          provider_request_id?: string | null
          reasoning_tokens?: number | null
          response_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_preview_request_id_fkey"
            columns: ["preview_request_id"]
            isOneToOne: false
            referencedRelation: "preview_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      booking_drafts: {
        Row: {
          additional_request: string | null
          conversation_id: string
          created_at: string
          id: string
          revision: number
          salon_id: string | null
          service_selections: Json
          starts_at: string | null
          state: string
          technician_ref: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          additional_request?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          revision?: number
          salon_id?: string | null
          service_selections?: Json
          starts_at?: string | null
          state?: string
          technician_ref?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          additional_request?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          revision?: number
          salon_id?: string | null
          service_selections?: Json
          starts_at?: string | null
          state?: string
          technician_ref?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_drafts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          actor_contact_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          id: number
          metadata: Json
        }
        Insert: {
          actor_contact_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          actor_contact_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_actor_contact_id_fkey"
            columns: ["actor_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          position: number
          service_id: string | null
          service_name_snapshot: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          position?: number
          service_id?: string | null
          service_name_snapshot: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          position?: number
          service_id?: string | null
          service_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          additional_request: string | null
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          contact_id: string
          created_at: string
          id: string
          idempotency_key: string
          local_time_label: string
          salon_id: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          technician_name_snapshot: string | null
          technician_ref: string | null
          timezone_snapshot: string
          updated_at: string
        }
        Insert: {
          additional_request?: string | null
          business_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          local_time_label: string
          salon_id: string
          source?: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          technician_name_snapshot?: string | null
          technician_ref?: string | null
          timezone_snapshot: string
          updated_at?: string
        }
        Update: {
          additional_request?: string | null
          business_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          local_time_label?: string
          salon_id?: string
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          technician_name_snapshot?: string | null
          technician_ref?: string | null
          timezone_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      business_customers: {
        Row: {
          business_id: string
          contact_id: string
          created_at: string
          first_booking_at: string | null
          last_booking_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          contact_id: string
          created_at?: string
          first_booking_at?: string | null
          last_booking_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          contact_id?: string
          created_at?: string
          first_booking_at?: string | null
          last_booking_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_customers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_owners: {
        Row: {
          business_id: string
          contact_id: string
          created_at: string
        }
        Insert: {
          business_id: string
          contact_id: string
          created_at?: string
        }
        Update: {
          business_id?: string
          contact_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_owners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_owners_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          reporting_timezone: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          reporting_timezone?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          reporting_timezone?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          display_name: string | null
          first_contact_at: string
          id: string
          last_contact_at: string
          normalized_phone: string | null
          profile_avatar_url: string | null
          updated_at: string
          wa_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_contact_at?: string
          id?: string
          last_contact_at?: string
          normalized_phone?: string | null
          profile_avatar_url?: string | null
          updated_at?: string
          wa_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_contact_at?: string
          id?: string
          last_contact_at?: string
          normalized_phone?: string | null
          profile_avatar_url?: string | null
          updated_at?: string
          wa_id?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          expires_at: string | null
          id: string
          media_id: string | null
          message_type: string
          provider_message_id: string | null
          structured_content: Json
          text_content: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          expires_at?: string | null
          id?: string
          media_id?: string | null
          message_type: string
          provider_message_id?: string | null
          structured_content?: Json
          text_content?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          expires_at?: string | null
          id?: string
          media_id?: string | null
          message_type?: string
          provider_message_id?: string | null
          structured_content?: Json
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          business_context_id: string | null
          channel: string
          contact_id: string
          created_at: string
          greeted_at: string | null
          id: string
          last_activity_at: string
          role_context: string
          salon_context_id: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          business_context_id?: string | null
          channel?: string
          contact_id: string
          created_at?: string
          greeted_at?: string | null
          id?: string
          last_activity_at?: string
          role_context?: string
          salon_context_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          business_context_id?: string | null
          channel?: string
          contact_id?: string
          created_at?: string
          greeted_at?: string | null
          id?: string
          last_activity_at?: string
          role_context?: string
          salon_context_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_context_id_fkey"
            columns: ["business_context_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_salon_context_id_fkey"
            columns: ["salon_context_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      interactive_prompts: {
        Row: {
          consumed_at: string | null
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          options: Json
          prompt_token: string
          prompt_type: string
        }
        Insert: {
          consumed_at?: string | null
          conversation_id: string
          created_at?: string
          expires_at: string
          id?: string
          options: Json
          prompt_token: string
          prompt_type: string
        }
        Update: {
          consumed_at?: string | null
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          options?: Json
          prompt_token?: string
          prompt_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactive_prompts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          created_at: string
          id: string
          inbox_event_id: string | null
          job_name: string
          last_error_code: string | null
          payload: Json
          state: Database["public"]["Enums"]["job_state"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          created_at?: string
          id?: string
          inbox_event_id?: string | null
          job_name: string
          last_error_code?: string | null
          payload: Json
          state?: Database["public"]["Enums"]["job_state"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          created_at?: string
          id?: string
          inbox_event_id?: string | null
          job_name?: string
          last_error_code?: string | null
          payload?: Json
          state?: Database["public"]["Enums"]["job_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_outbox_inbox_event_id_fkey"
            columns: ["inbox_event_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inbox_events"
            referencedColumns: ["id"]
          },
        ]
      }
      message_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          conversation_id: string | null
          created_at: string
          deduplication_key: string
          failure_code: string | null
          id: string
          message_kind: string
          payload: Json
          provider_message_id: string | null
          recipient_wa_id: string
          sent_at: string | null
          state: Database["public"]["Enums"]["delivery_state"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          conversation_id?: string | null
          created_at?: string
          deduplication_key: string
          failure_code?: string | null
          id?: string
          message_kind: string
          payload: Json
          provider_message_id?: string | null
          recipient_wa_id: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["delivery_state"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          conversation_id?: string | null
          created_at?: string
          deduplication_key?: string
          failure_code?: string | null
          id?: string
          message_kind?: string
          payload?: Json
          provider_message_id?: string | null
          recipient_wa_id?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["delivery_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          must_change_password: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          must_change_password?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          default_booking_interval_minutes: number
          default_close_time: string
          default_open_time: string
          greeting_de: string
          greeting_en: string
          platform_timezone: string
          preview_requests_per_day: number
          previews_per_request: number
          singleton: boolean
          technician_booking_cancelled_template: string | null
          technician_booking_confirmed_template: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_booking_interval_minutes?: number
          default_close_time?: string
          default_open_time?: string
          greeting_de?: string
          greeting_en?: string
          platform_timezone?: string
          preview_requests_per_day?: number
          previews_per_request?: number
          singleton?: boolean
          technician_booking_cancelled_template?: string | null
          technician_booking_confirmed_template?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_booking_interval_minutes?: number
          default_close_time?: string
          default_open_time?: string
          greeting_de?: string
          greeting_en?: string
          platform_timezone?: string
          preview_requests_per_day?: number
          previews_per_request?: number
          singleton?: boolean
          technician_booking_cancelled_template?: string | null
          technician_booking_confirmed_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      preview_requests: {
        Row: {
          contact_id: string
          conversation_id: string | null
          created_at: string
          failure_code: string | null
          generated_count: number
          id: string
          output_media_ids: Json
          request_key: string
          requested_count: number
          source_media_id: string
          state: Database["public"]["Enums"]["preview_state"]
          style_request: string | null
          updated_at: string
          usage_date: string
        }
        Insert: {
          contact_id: string
          conversation_id?: string | null
          created_at?: string
          failure_code?: string | null
          generated_count?: number
          id?: string
          output_media_ids?: Json
          request_key: string
          requested_count?: number
          source_media_id: string
          state?: Database["public"]["Enums"]["preview_state"]
          style_request?: string | null
          updated_at?: string
          usage_date: string
        }
        Update: {
          contact_id?: string
          conversation_id?: string | null
          created_at?: string
          failure_code?: string | null
          generated_count?: number
          id?: string
          output_media_ids?: Json
          request_key?: string
          requested_count?: number
          source_media_id?: string
          state?: Database["public"]["Enums"]["preview_state"]
          style_request?: string | null
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "preview_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preview_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      preview_usage: {
        Row: {
          consumed_count: number
          contact_id: string
          reserved_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          consumed_count?: number
          contact_id: string
          reserved_count?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          consumed_count?: number
          contact_id?: string
          reserved_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "preview_usage_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          active: boolean
          booking_interval_minutes: number
          business_id: string
          created_at: string
          customer_can_choose_technician: boolean
          default_close_time: string
          default_open_time: string
          deleted_at: string | null
          id: string
          location_label: string
          name: string
          timezone: string
          updated_at: string
          weekly_hours: Json
        }
        Insert: {
          active?: boolean
          booking_interval_minutes?: number
          business_id: string
          created_at?: string
          customer_can_choose_technician?: boolean
          default_close_time?: string
          default_open_time?: string
          deleted_at?: string | null
          id?: string
          location_label: string
          name: string
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Update: {
          active?: boolean
          booking_interval_minutes?: number
          business_id?: string
          created_at?: string
          customer_can_choose_technician?: boolean
          default_close_time?: string
          default_open_time?: string
          deleted_at?: string | null
          id?: string
          location_label?: string
          name?: string
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "salons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          note: string | null
          starts_at: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          note?: string | null
          starts_at: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          note?: string | null
          starts_at?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_time_off_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          salon_id: string
          updated_at: string
          wa_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          salon_id: string
          updated_at?: string
          wa_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          salon_id?: string
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_executions: {
        Row: {
          arguments: Json
          completed_at: string | null
          conversation_id: string
          created_at: string
          id: string
          result: Json | null
          state: string
          tool_call_id: string
          tool_name: string
        }
        Insert: {
          arguments: Json
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          result?: Json | null
          state?: string
          tool_call_id: string
          tool_name: string
        }
        Update: {
          arguments?: Json
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          result?: Json | null
          state?: string
          tool_call_id?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbox_events: {
        Row: {
          contact_wa_id: string | null
          event_kind: string
          failure_code: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider_event_id: string
          received_at: string
        }
        Insert: {
          contact_wa_id?: string | null
          event_kind: string
          failure_code?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider_event_id: string
          received_at?: string
        }
        Update: {
          contact_wa_id?: string | null
          event_kind?: string
          failure_code?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider_event_id?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_whatsapp_messages: {
        Row: {
          channel: string | null
          created_at: string | null
          direction: string | null
          id: string | null
          media_id: string | null
          message_type: string | null
          payload: Json | null
          profile_name: string | null
          sent_at: string | null
          state: string | null
          text_content: string | null
          wa_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_platform_activity: {
        Args: {
          p_channel: string
          p_from: string
          p_timezone: string
          p_to: string
        }
        Returns: Json
      }
      admin_whatsapp_threads: {
        Args: {
          p_channel: string
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_search?: string
        }
        Returns: Json
      }
      cancel_customer_booking: {
        Args: { p_booking_id: string; p_contact_id: string; p_reason: string }
        Returns: boolean
      }
      complete_preview_request: {
        Args: { p_output_media_ids: Json; p_request_id: string }
        Returns: undefined
      }
      create_booking_from_conversation: {
        Args: {
          p_additional_request: string
          p_business_id: string
          p_contact_id: string
          p_idempotency_key: string
          p_local_time_label: string
          p_salon_id: string
          p_services: Json
          p_starts_at: string
          p_technician_name_snapshot: string
          p_technician_ref: string
          p_timezone_snapshot: string
        }
        Returns: string
      }
      is_platform_admin: { Args: never; Returns: boolean }
      register_whatsapp_event: {
        Args: {
          p_contact_wa_id: string
          p_event_kind: string
          p_payload: Json
          p_provider_event_id: string
        }
        Returns: {
          accepted: boolean
          inbox_event_id: string
          job_outbox_id: string
        }[]
      }
      reserve_preview_request: {
        Args: {
          p_contact_id: string
          p_conversation_id: string
          p_daily_limit: number
          p_request_key: string
          p_requested_count: number
          p_source_media_id: string
          p_style_request: string
          p_usage_date: string
        }
        Returns: string
      }
    }
    Enums: {
      booking_status: "confirmed" | "cancelled"
      delivery_state: "pending" | "sending" | "sent" | "failed"
      job_state:
        | "pending"
        | "dispatched"
        | "processing"
        | "completed"
        | "failed"
      message_direction: "inbound" | "outbound"
      preview_state:
        | "reserved"
        | "processing"
        | "ready"
        | "partially_ready"
        | "delivered"
        | "failed"
        | "released"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: ["confirmed", "cancelled"],
      delivery_state: ["pending", "sending", "sent", "failed"],
      job_state: ["pending", "dispatched", "processing", "completed", "failed"],
      message_direction: ["inbound", "outbound"],
      preview_state: [
        "reserved",
        "processing",
        "ready",
        "partially_ready",
        "delivered",
        "failed",
        "released",
      ],
    },
  },
} as const

