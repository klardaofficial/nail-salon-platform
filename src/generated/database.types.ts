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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "ai_usage_events_organization_conversation_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "ai_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_organization_preview_fkey"
            columns: ["organization_id", "preview_request_id"]
            isOneToOne: false
            referencedRelation: "preview_requests"
            referencedColumns: ["organization_id", "id"]
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
          organization_id: string | null
          scope_type: string
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
          organization_id?: string | null
          scope_type?: string
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
          organization_id?: string | null
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_drafts: {
        Row: {
          additional_request: string | null
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          origin: string | null
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
          organization_id: string
          origin?: string | null
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
          organization_id?: string
          origin?: string | null
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
            foreignKeyName: "booking_drafts_organization_conversation_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "booking_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
        }
        Insert: {
          actor_contact_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json
          organization_id: string
        }
        Update: {
          actor_contact_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json
          organization_id?: string
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
            foreignKeyName: "booking_events_organization_booking_fkey"
            columns: ["organization_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "booking_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_intents: {
        Row: {
          additional_request: string | null
          code: string
          consumed_at: string | null
          consumed_conversation_id: string | null
          created_at: string
          expires_at: string
          id: string
          locale: string
          message_source: string
          message_text: string | null
          organization_id: string
          params_fingerprint: string
          salon_id: string | null
          service_selections: Json
          starts_at: string
          technician_ref: string | null
          updated_at: string
        }
        Insert: {
          additional_request?: string | null
          code: string
          consumed_at?: string | null
          consumed_conversation_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          locale: string
          message_source: string
          message_text?: string | null
          organization_id: string
          params_fingerprint: string
          salon_id?: string | null
          service_selections?: Json
          starts_at: string
          technician_ref?: string | null
          updated_at?: string
        }
        Update: {
          additional_request?: string | null
          code?: string
          consumed_at?: string | null
          consumed_conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          locale?: string
          message_source?: string
          message_text?: string | null
          organization_id?: string
          params_fingerprint?: string
          salon_id?: string | null
          service_selections?: Json
          starts_at?: string
          technician_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_intents_organization_conversation_fkey"
            columns: ["organization_id", "consumed_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "booking_intents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intents_organization_salon_fkey"
            columns: ["organization_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      booking_services: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          organization_id: string
          position: number
          service_id: string | null
          service_name_snapshot: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          organization_id: string
          position?: number
          service_id?: string | null
          service_name_snapshot: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          position?: number
          service_id?: string | null
          service_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_organization_booking_fkey"
            columns: ["organization_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "booking_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_organization_service_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
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
          organization_id: string
          refer_duration: number
          refer_price: number
          salon_id: string | null
          simulated: boolean
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
          organization_id: string
          refer_duration?: number
          refer_price?: number
          salon_id?: string | null
          simulated?: boolean
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
          organization_id?: string
          refer_duration?: number
          refer_price?: number
          salon_id?: string | null
          simulated?: boolean
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
            foreignKeyName: "bookings_organization_business_fkey"
            columns: ["organization_id", "business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "bookings_organization_contact_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_salon_fkey"
            columns: ["organization_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["organization_id", "id"]
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
          organization_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          contact_id: string
          created_at?: string
          first_booking_at?: string | null
          last_booking_at?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          contact_id?: string
          created_at?: string
          first_booking_at?: string | null
          last_booking_at?: string | null
          organization_id?: string
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
          {
            foreignKeyName: "business_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_owners: {
        Row: {
          business_id: string
          contact_id: string
          created_at: string
          organization_id: string
        }
        Insert: {
          business_id: string
          contact_id: string
          created_at?: string
          organization_id: string
        }
        Update: {
          business_id?: string
          contact_id?: string
          created_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_owners_organization_business_fkey"
            columns: ["organization_id", "business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "business_owners_organization_contact_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "business_owners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          reporting_timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          reporting_timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          reporting_timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          display_name: string | null
          first_contact_at: string
          id: string
          last_contact_at: string
          normalized_phone: string | null
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          profile_avatar_url?: string | null
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          provider_message_id?: string | null
          structured_content?: Json
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_organization_conversation_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversation_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          reply_locale: string | null
          reply_unavailable_text: string | null
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
          organization_id: string
          reply_locale?: string | null
          reply_unavailable_text?: string | null
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
          organization_id?: string
          reply_locale?: string | null
          reply_unavailable_text?: string | null
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
            foreignKeyName: "conversations_organization_contact_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          prompt_token?: string
          prompt_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactive_prompts_organization_conversation_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "interactive_prompts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          payload?: Json
          state?: Database["public"]["Enums"]["job_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_outbox_organization_inbox_fkey"
            columns: ["organization_id", "inbox_event_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inbox_events"
            referencedColumns: ["organization_id", "id"]
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          payload?: Json
          provider_message_id?: string | null
          recipient_wa_id?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["delivery_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_organization_conversation_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "message_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_admin_memberships: {
        Row: {
          active: boolean
          created_at: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_admin_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_admin_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_provider_settings: {
        Row: {
          access_token: string | null
          app_secret: string | null
          configuration_version: number
          created_at: string
          display_phone_number: string | null
          e164_digits: string | null
          openai_api_key: string | null
          openai_chat_model: string | null
          openai_configuration_version: number
          openai_image_model: string | null
          openai_pricing: Json
          organization_id: string
          phone_number_id: string | null
          real_whatsapp_enabled: boolean
          technician_booking_cancelled_template: string | null
          technician_booking_confirmed_template: string | null
          updated_at: string
          waba_id: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          app_secret?: string | null
          configuration_version?: number
          created_at?: string
          display_phone_number?: string | null
          e164_digits?: string | null
          openai_api_key?: string | null
          openai_chat_model?: string | null
          openai_configuration_version?: number
          openai_image_model?: string | null
          openai_pricing?: Json
          organization_id: string
          phone_number_id?: string | null
          real_whatsapp_enabled?: boolean
          technician_booking_cancelled_template?: string | null
          technician_booking_confirmed_template?: string | null
          updated_at?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          app_secret?: string | null
          configuration_version?: number
          created_at?: string
          display_phone_number?: string | null
          e164_digits?: string | null
          openai_api_key?: string | null
          openai_chat_model?: string | null
          openai_configuration_version?: number
          openai_image_model?: string | null
          openai_pricing?: Json
          organization_id?: string
          phone_number_id?: string | null
          real_whatsapp_enabled?: boolean
          technician_booking_cancelled_template?: string | null
          technician_booking_confirmed_template?: string | null
          updated_at?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_provider_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          bot_locale: string
          created_at: string
          currency: string
          default_booking_interval_minutes: number
          default_close_time: string
          default_open_time: string
          legacy_environment_imported_at: string | null
          organization_id: string
          platform_timezone: string
          preview_requests_per_day: number
          previews_per_request: number
          simulator_enabled: boolean
          updated_at: string
        }
        Insert: {
          bot_locale?: string
          created_at?: string
          currency?: string
          default_booking_interval_minutes?: number
          default_close_time?: string
          default_open_time?: string
          legacy_environment_imported_at?: string | null
          organization_id: string
          platform_timezone?: string
          preview_requests_per_day?: number
          previews_per_request?: number
          simulator_enabled?: boolean
          updated_at?: string
        }
        Update: {
          bot_locale?: string
          created_at?: string
          currency?: string
          default_booking_interval_minutes?: number
          default_close_time?: string
          default_open_time?: string
          legacy_environment_imported_at?: string | null
          organization_id?: string
          platform_timezone?: string
          preview_requests_per_day?: number
          previews_per_request?: number
          simulator_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          is_system_admin: boolean
          must_change_password: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          is_system_admin?: boolean
          must_change_password?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          is_system_admin?: boolean
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
            foreignKeyName: "preview_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preview_requests_organization_contact_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "preview_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      preview_usage: {
        Row: {
          consumed_count: number
          contact_id: string
          organization_id: string
          reserved_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          consumed_count?: number
          contact_id: string
          organization_id: string
          reserved_count?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          consumed_count?: number
          contact_id?: string
          organization_id?: string
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
          {
            foreignKeyName: "preview_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_configuration_validations: {
        Row: {
          configuration_version: number
          failure_code: string | null
          organization_id: string
          status: string
          validated_at: string
        }
        Insert: {
          configuration_version: number
          failure_code?: string | null
          organization_id: string
          status: string
          validated_at?: string
        }
        Update: {
          configuration_version?: number
          failure_code?: string | null
          organization_id?: string
          status?: string
          validated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_configuration_validations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      root_settings: {
        Row: {
          access_token: string | null
          app_secret: string | null
          configuration_version: number
          created_at: string
          openai_api_key: string | null
          openai_chat_model: string
          openai_configuration_version: number
          openai_image_model: string
          openai_pricing: Json
          singleton: boolean
          technician_booking_cancelled_template: string | null
          technician_booking_confirmed_template: string | null
          updated_at: string
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          app_secret?: string | null
          configuration_version?: number
          created_at?: string
          openai_api_key?: string | null
          openai_chat_model?: string
          openai_configuration_version?: number
          openai_image_model?: string
          openai_pricing?: Json
          singleton?: boolean
          technician_booking_cancelled_template?: string | null
          technician_booking_confirmed_template?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          app_secret?: string | null
          configuration_version?: number
          created_at?: string
          openai_api_key?: string | null
          openai_chat_model?: string
          openai_configuration_version?: number
          openai_image_model?: string
          openai_pricing?: Json
          singleton?: boolean
          technician_booking_cancelled_template?: string | null
          technician_booking_confirmed_template?: string | null
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Relationships: []
      }
      salons: {
        Row: {
          active: boolean
          booking_interval_minutes: number
          business_id: string
          created_at: string
          default_close_time: string
          default_open_time: string
          deleted_at: string | null
          id: string
          location_label: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
          weekly_hours: Json
        }
        Insert: {
          active?: boolean
          booking_interval_minutes?: number
          business_id: string
          created_at?: string
          default_close_time?: string
          default_open_time?: string
          deleted_at?: string | null
          id?: string
          location_label: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Update: {
          active?: boolean
          booking_interval_minutes?: number
          business_id?: string
          created_at?: string
          default_close_time?: string
          default_open_time?: string
          deleted_at?: string | null
          id?: string
          location_label?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "salons_organization_business_fkey"
            columns: ["organization_id", "business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "salons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_salons: {
        Row: {
          organization_id: string
          salon_id: string
          service_id: string
        }
        Insert: {
          organization_id: string
          salon_id: string
          service_id: string
        }
        Update: {
          organization_id?: string
          salon_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_salons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_salons_organization_salon_fkey"
            columns: ["organization_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "service_salons_organization_service_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          name: string
          organization_id: string
          price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name: string
          organization_id: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          name?: string
          organization_id?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          starts_at: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          note?: string | null
          organization_id: string
          starts_at: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          starts_at?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_time_off_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          salon_id?: string
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technicians_organization_salon_fkey"
            columns: ["organization_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["organization_id", "id"]
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          result?: Json | null
          state?: string
          tool_call_id?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_executions_organization_conversation_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tool_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          provider_event_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbox_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_organization_whatsapp_messages: {
        Row: {
          channel: string | null
          created_at: string | null
          direction: string | null
          id: string | null
          media_id: string | null
          message_type: string | null
          organization_id: string | null
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
          p_organization_id: string
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
          p_organization_id: string
          p_role?: string
          p_search?: string
        }
        Returns: Json
      }
      cancel_organization_booking: {
        Args: {
          p_booking_id: string
          p_contact_id: string
          p_organization_id: string
          p_reason: string
        }
        Returns: boolean
      }
      complete_preview_request: {
        Args: {
          p_organization_id: string
          p_output_media_ids: Json
          p_request_id: string
        }
        Returns: undefined
      }
      create_organization: { Args: { p_name: string }; Returns: string }
      create_organization_booking: {
        Args: {
          p_additional_request: string
          p_business_id: string
          p_channel: string
          p_contact_id: string
          p_idempotency_key: string
          p_local_time_label: string
          p_organization_id: string
          p_salon_id: string
          p_services: Json
          p_starts_at: string
          p_technician_name_snapshot: string
          p_technician_ref: string
          p_timezone_snapshot: string
        }
        Returns: string
      }
      deactivate_platform_admin: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_staff_booking_summary: {
        Args: {
          p_contact_id: string
          p_date_basis: string
          p_from: string
          p_organization_id: string
          p_role: string
          p_to: string
        }
        Returns: Json
      }
      is_organization_admin: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_system_admin: { Args: never; Returns: boolean }
      register_whatsapp_event: {
        Args: {
          p_contact_wa_id: string
          p_event_kind: string
          p_organization_id: string
          p_payload: Json
          p_provider_event_id: string
        }
        Returns: {
          accepted: boolean
          inbox_event_id: string
          job_outbox_id: string
        }[]
      }
      reschedule_organization_booking: {
        Args: {
          p_additional_request: string
          p_booking_id: string
          p_contact_id: string
          p_idempotency_key: string
          p_local_time_label: string
          p_organization_id: string
          p_salon_id: string
          p_services: Json
          p_starts_at: string
          p_technician_name_snapshot: string
          p_technician_ref: string
          p_timezone_snapshot: string
        }
        Returns: boolean
      }
      reserve_organization_preview: {
        Args: {
          p_contact_id: string
          p_conversation_id: string
          p_daily_limit: number
          p_organization_id: string
          p_request_key: string
          p_requested_count: number
          p_source_media_id: string
          p_style_request: string
          p_usage_date: string
        }
        Returns: string
      }
      set_system_admin_role: {
        Args: { p_is_system_admin: boolean; p_user_id: string }
        Returns: undefined
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

