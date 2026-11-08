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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          depth: number | null
          icon_key: string | null
          id: string
          is_active: boolean
          is_visible: boolean
          parent_id: string | null
          path: unknown
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          depth?: number | null
          icon_key?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          parent_id?: string | null
          path: unknown
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          depth?: number | null
          icon_key?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          parent_id?: string | null
          path?: unknown
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_relations: {
        Row: {
          category_id: string
          related_category_id: string
          relation_kind: string
          sort_order: number
        }
        Insert: {
          category_id: string
          related_category_id: string
          relation_kind?: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          related_category_id?: string
          relation_kind?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_relations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_relations_related_category_id_fkey"
            columns: ["related_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_terms: {
        Row: {
          category_id: string
          term_id: string
          weight: number
        }
        Insert: {
          category_id: string
          term_id: string
          weight?: number
        }
        Update: {
          category_id?: string
          term_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_terms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      category_translations: {
        Row: {
          category_id: string
          description: string | null
          locale: string
          name: string
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
        }
        Insert: {
          category_id: string
          description?: string | null
          locale: string
          name: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
        }
        Update: {
          category_id?: string
          description?: string | null
          locale?: string
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          account_type:
            | Database["public"]["Enums"]["client_account_type"]
            | null
          business_name: string | null
          challenges: string | null
          company_size: Database["public"]["Enums"]["company_size"] | null
          created_at: string
          industry_term_id: string | null
          onboarding_completed_at: string | null
          purpose: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          account_type?:
            | Database["public"]["Enums"]["client_account_type"]
            | null
          business_name?: string | null
          challenges?: string | null
          company_size?: Database["public"]["Enums"]["company_size"] | null
          created_at?: string
          industry_term_id?: string | null
          onboarding_completed_at?: string | null
          purpose?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          account_type?:
            | Database["public"]["Enums"]["client_account_type"]
            | null
          business_name?: string | null
          challenges?: string | null
          company_size?: Database["public"]["Enums"]["company_size"] | null
          created_at?: string
          industry_term_id?: string | null
          onboarding_completed_at?: string | null
          purpose?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_industry_term_id_fkey"
            columns: ["industry_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_user_id: string | null
          resolution_note: string | null
          signals: string[]
          source: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_user_id?: string | null
          resolution_note?: string | null
          signals?: string[]
          source?: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_user_id?: string | null
          resolution_note?: string | null
          signals?: string[]
          source?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          archived_at: string | null
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          muted: boolean
          participant_kind: string
          provider_id: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          participant_kind: string
          provider_id?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          participant_kind?: string
          provider_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_user_id: string | null
          context_listing_id: string | null
          context_project_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_message_at: string | null
          provider_id: string | null
          status: string
        }
        Insert: {
          client_user_id?: string | null
          context_listing_id?: string | null
          context_project_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          provider_id?: string | null
          status?: string
        }
        Update: {
          client_user_id?: string | null
          context_listing_id?: string | null
          context_project_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          provider_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_context_listing_id_fkey"
            columns: ["context_listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_context_project_id_fkey"
            columns: ["context_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          can_buy: boolean
          can_register: boolean
          can_sell: boolean
          code: string
          default_currency: string | null
          restriction_note: string | null
          updated_at: string
        }
        Insert: {
          can_buy?: boolean
          can_register?: boolean
          can_sell?: boolean
          code: string
          default_currency?: string | null
          restriction_note?: string | null
          updated_at?: string
        }
        Update: {
          can_buy?: boolean
          can_register?: boolean
          can_sell?: boolean
          code?: string
          default_currency?: string | null
          restriction_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string
          enabled: boolean
          is_public: boolean
          key: string
          rules: Json
          updated_at: string
        }
        Insert: {
          description: string
          enabled?: boolean
          is_public?: boolean
          key: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          description?: string
          enabled?: boolean
          is_public?: boolean
          key?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: []
      }
      file_objects: {
        Row: {
          bucket: string
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          mime_type: string
          owner_user_id: string
          path: string
          purpose: Database["public"]["Enums"]["file_purpose"]
          scan_status: Database["public"]["Enums"]["scan_status"]
          sha256: string | null
          size_bytes: number
        }
        Insert: {
          bucket: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          mime_type: string
          owner_user_id: string
          path: string
          purpose: Database["public"]["Enums"]["file_purpose"]
          scan_status?: Database["public"]["Enums"]["scan_status"]
          sha256?: string | null
          size_bytes: number
        }
        Update: {
          bucket?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          mime_type?: string
          owner_user_id?: string
          path?: string
          purpose?: Database["public"]["Enums"]["file_purpose"]
          scan_status?: Database["public"]["Enums"]["scan_status"]
          sha256?: string | null
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_objects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          context: string
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          context: string
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          context?: string
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content_sha256: string | null
          created_at: string
          id: string
          is_draft: boolean
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          locale: string
          published_at: string | null
          requires_acceptance: boolean
          url_path: string
          version: string
        }
        Insert: {
          content_sha256?: string | null
          created_at?: string
          id?: string
          is_draft?: boolean
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          locale?: string
          published_at?: string | null
          requires_acceptance?: boolean
          url_path: string
          version: string
        }
        Update: {
          content_sha256?: string | null
          created_at?: string
          id?: string
          is_draft?: boolean
          kind?: Database["public"]["Enums"]["legal_doc_kind"]
          locale?: string
          published_at?: string | null
          requires_acceptance?: boolean
          url_path?: string
          version?: string
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          file_id: string
          message_id: string
        }
        Insert: {
          file_id: string
          message_id: string
        }
        Update: {
          file_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          contact_flags: string[]
          context_listing_id: string | null
          context_project_id: string | null
          conversation_id: string
          created_at: string
          id: string
          kind: string
          moderation_state: string
          sender_user_id: string | null
        }
        Insert: {
          body?: string | null
          contact_flags?: string[]
          context_listing_id?: string | null
          context_project_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          kind?: string
          moderation_state?: string
          sender_user_id?: string | null
        }
        Update: {
          body?: string | null
          contact_flags?: string[]
          context_listing_id?: string | null
          context_project_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          moderation_state?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_context_listing_id_fkey"
            columns: ["context_listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_context_project_id_fkey"
            columns: ["context_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          actor_staff_id: string | null
          affected_user_id: string | null
          created_at: string
          id: string
          provider_id: string | null
          reason: string | null
          report_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_staff_id?: string | null
          affected_user_id?: string | null
          created_at?: string
          id?: string
          provider_id?: string | null
          reason?: string | null
          report_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_staff_id?: string | null
          affected_user_id?: string | null
          created_at?: string
          id?: string
          provider_id?: string | null
          reason?: string | null
          report_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_affected_user_id_fkey"
            columns: ["affected_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          enabled: boolean
          type_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          enabled: boolean
          type_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          enabled?: boolean
          type_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_type_key_fkey"
            columns: ["type_key"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_types: {
        Row: {
          category: string
          default_channels: string[]
          key: string
          user_configurable: boolean
        }
        Insert: {
          category: string
          default_channels?: string[]
          key: string
          user_configurable?: boolean
        }
        Update: {
          category?: string
          default_channels?: string[]
          key?: string
          user_configurable?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          count: number
          created_at: string
          entity_id: string | null
          entity_type: string
          group_key: string | null
          id: string
          params: Json
          read_at: string | null
          type_key: string
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          count?: number
          created_at?: string
          entity_id?: string | null
          entity_type: string
          group_key?: string | null
          id?: string
          params?: Json
          read_at?: string | null
          type_key: string
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          count?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          group_key?: string | null
          id?: string
          params?: Json
          read_at?: string | null
          type_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_type_key_fkey"
            columns: ["type_key"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description: string
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_item_media: {
        Row: {
          caption: string | null
          file_id: string
          id: string
          item_id: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          file_id: string
          id?: string
          item_id: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          file_id?: string
          id?: string
          item_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_item_media_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_item_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "portfolio_items"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_item_terms: {
        Row: {
          item_id: string
          term_id: string
        }
        Insert: {
          item_id: string
          term_id: string
        }
        Update: {
          item_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_item_terms_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "portfolio_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_item_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          client_display_name: string | null
          created_at: string
          external_url: string | null
          id: string
          industry_term_id: string | null
          problem: string | null
          project_date: string | null
          provenance: Database["public"]["Enums"]["portfolio_provenance"]
          provider_id: string
          results: string | null
          role: string | null
          solution: string | null
          sort_order: number
          status: Database["public"]["Enums"]["portfolio_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_display_name?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          industry_term_id?: string | null
          problem?: string | null
          project_date?: string | null
          provenance?: Database["public"]["Enums"]["portfolio_provenance"]
          provider_id: string
          results?: string | null
          role?: string | null
          solution?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["portfolio_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_display_name?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          industry_term_id?: string | null
          problem?: string | null
          project_date?: string | null
          provenance?: Database["public"]["Enums"]["portfolio_provenance"]
          provider_id?: string
          results?: string | null
          role?: string | null
          solution?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["portfolio_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_industry_term_id_fkey"
            columns: ["industry_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          active_role: Database["public"]["Enums"]["marketplace_role"]
          avatar_file_id: string | null
          country_code: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          full_name: string
          id: string
          locale: string
          timezone: string
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          active_role: Database["public"]["Enums"]["marketplace_role"]
          avatar_file_id?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          full_name: string
          id: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          active_role?: Database["public"]["Enums"]["marketplace_role"]
          avatar_file_id?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          full_name?: string
          id?: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_file_fk"
            columns: ["avatar_file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      project_attachments: {
        Row: {
          created_at: string
          file_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          message: string | null
          project_id: string
          provider_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          message?: string | null
          project_id: string
          provider_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          message?: string | null
          project_id?: string
          provider_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_terms: {
        Row: {
          project_id: string
          term_id: string
        }
        Insert: {
          project_id: string
          term_id: string
        }
        Update: {
          project_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_terms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_kind: Database["public"]["Enums"]["budget_kind"]
          budget_max_minor: number | null
          budget_min_minor: number | null
          business_problem: string | null
          category_id: string | null
          client_user_id: string
          closed_at: string | null
          created_at: string
          currency: string
          deadline: string | null
          description: string | null
          desired_outcome: string | null
          expires_at: string | null
          id: string
          proposals_count: number
          published_at: string | null
          source: string
          status: Database["public"]["Enums"]["project_status"]
          timeline_kind: Database["public"]["Enums"]["timeline_kind"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["project_visibility"]
        }
        Insert: {
          budget_kind?: Database["public"]["Enums"]["budget_kind"]
          budget_max_minor?: number | null
          budget_min_minor?: number | null
          business_problem?: string | null
          category_id?: string | null
          client_user_id: string
          closed_at?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          desired_outcome?: string | null
          expires_at?: string | null
          id?: string
          proposals_count?: number
          published_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["project_status"]
          timeline_kind?: Database["public"]["Enums"]["timeline_kind"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Update: {
          budget_kind?: Database["public"]["Enums"]["budget_kind"]
          budget_max_minor?: number | null
          budget_min_minor?: number | null
          business_problem?: string | null
          category_id?: string | null
          client_user_id?: string
          closed_at?: string | null
          created_at?: string
          currency?: string
          deadline?: string | null
          description?: string | null
          desired_outcome?: string | null
          expires_at?: string | null
          id?: string
          proposals_count?: number
          published_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["project_status"]
          timeline_kind?: Database["public"]["Enums"]["timeline_kind"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_deliverables: {
        Row: {
          id: string
          proposal_id: string
          sort_order: number
          title: string
        }
        Insert: {
          id?: string
          proposal_id: string
          sort_order?: number
          title: string
        }
        Update: {
          id?: string
          proposal_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_deliverables_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_milestones: {
        Row: {
          amount_minor: number
          description: string | null
          due_offset_days: number
          id: string
          proposal_id: string
          seq: number
          title: string
        }
        Insert: {
          amount_minor: number
          description?: string | null
          due_offset_days: number
          id?: string
          proposal_id: string
          seq: number
          title: string
        }
        Update: {
          amount_minor?: number
          description?: string | null
          due_offset_days?: number
          id?: string
          proposal_id?: string
          seq?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_milestones_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          balance_trigger: Database["public"]["Enums"]["balance_trigger"] | null
          conditions: string | null
          created_at: string
          currency: string
          decided_at: string | null
          decline_reason: string | null
          deposit_bps: number | null
          estimated_days: number | null
          hours: number | null
          id: string
          payment_model: Database["public"]["Enums"]["payment_model"]
          price_minor: number | null
          pricing_model: Database["public"]["Enums"]["proposal_pricing"]
          project_id: string
          proposed_solution: string | null
          provider_id: string
          questions: string | null
          relevant_experience: string | null
          revisions_included: number | null
          status: Database["public"]["Enums"]["proposal_status"]
          submitted_at: string | null
          submitted_by_user_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          balance_trigger?:
            | Database["public"]["Enums"]["balance_trigger"]
            | null
          conditions?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decline_reason?: string | null
          deposit_bps?: number | null
          estimated_days?: number | null
          hours?: number | null
          id?: string
          payment_model?: Database["public"]["Enums"]["payment_model"]
          price_minor?: number | null
          pricing_model?: Database["public"]["Enums"]["proposal_pricing"]
          project_id: string
          proposed_solution?: string | null
          provider_id: string
          questions?: string | null
          relevant_experience?: string | null
          revisions_included?: number | null
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          submitted_by_user_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          balance_trigger?:
            | Database["public"]["Enums"]["balance_trigger"]
            | null
          conditions?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decline_reason?: string | null
          deposit_bps?: number | null
          estimated_days?: number | null
          hours?: number | null
          id?: string
          payment_model?: Database["public"]["Enums"]["payment_model"]
          price_minor?: number | null
          pricing_model?: Database["public"]["Enums"]["proposal_pricing"]
          project_id?: string
          proposed_solution?: string | null
          provider_id?: string
          questions?: string | null
          relevant_experience?: string | null
          revisions_included?: number | null
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_agency_details: {
        Row: {
          founded_year: number | null
          legal_name: string | null
          office_locations: string[] | null
          provider_id: string
          registration_number: string | null
          team_size_range: Database["public"]["Enums"]["team_size"] | null
          updated_at: string
        }
        Insert: {
          founded_year?: number | null
          legal_name?: string | null
          office_locations?: string[] | null
          provider_id: string
          registration_number?: string | null
          team_size_range?: Database["public"]["Enums"]["team_size"] | null
          updated_at?: string
        }
        Update: {
          founded_year?: number | null
          legal_name?: string | null
          office_locations?: string[] | null
          provider_id?: string
          registration_number?: string | null
          team_size_range?: Database["public"]["Enums"]["team_size"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_agency_details_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_languages: {
        Row: {
          language_code: string
          proficiency: Database["public"]["Enums"]["language_proficiency"]
          provider_id: string
        }
        Insert: {
          language_code: string
          proficiency: Database["public"]["Enums"]["language_proficiency"]
          provider_id: string
        }
        Update: {
          language_code?: string
          proficiency?: Database["public"]["Enums"]["language_proficiency"]
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_languages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_links: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["link_kind"]
          provider_id: string
          url: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["link_kind"]
          provider_id: string
          url: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["link_kind"]
          provider_id?: string
          url?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_links_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_terms: {
        Row: {
          is_featured: boolean
          provider_id: string
          term_id: string
          years: number | null
        }
        Insert: {
          is_featured?: boolean
          provider_id: string
          term_id: string
          years?: number | null
        }
        Update: {
          is_featured?: boolean
          provider_id?: string
          term_id?: string
          years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_terms_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"]
          availability_note: string | null
          avatar_file_id: string | null
          bio: string | null
          city: string | null
          country_code: string | null
          cover_file_id: string | null
          created_at: string
          display_name: string
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          handle: string
          headline: string | null
          id: string
          indicative_hourly_rate_minor: number | null
          owner_user_id: string
          provider_type: Database["public"]["Enums"]["provider_type"]
          published_at: string | null
          rate_currency: string | null
          source_locale: string
          status: Database["public"]["Enums"]["provider_status"]
          submitted_at: string | null
          timezone: string
          updated_at: string
          website_url: string | null
          years_experience: number | null
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"]
          availability_note?: string | null
          avatar_file_id?: string | null
          bio?: string | null
          city?: string | null
          country_code?: string | null
          cover_file_id?: string | null
          created_at?: string
          display_name: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          handle: string
          headline?: string | null
          id?: string
          indicative_hourly_rate_minor?: number | null
          owner_user_id: string
          provider_type?: Database["public"]["Enums"]["provider_type"]
          published_at?: string | null
          rate_currency?: string | null
          source_locale?: string
          status?: Database["public"]["Enums"]["provider_status"]
          submitted_at?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
          years_experience?: number | null
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"]
          availability_note?: string | null
          avatar_file_id?: string | null
          bio?: string | null
          city?: string | null
          country_code?: string | null
          cover_file_id?: string | null
          created_at?: string
          display_name?: string
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          handle?: string
          headline?: string | null
          id?: string
          indicative_hourly_rate_minor?: number | null
          owner_user_id?: string
          provider_type?: Database["public"]["Enums"]["provider_type"]
          published_at?: string | null
          rate_currency?: string | null
          source_locale?: string
          status?: Database["public"]["Enums"]["provider_status"]
          submitted_at?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_avatar_file_id_fkey"
            columns: ["avatar_file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "providers_cover_file_id_fkey"
            columns: ["cover_file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          flags: string[]
          id: string
          kind: string
          provider_id: string
          reason: string | null
          status: string
          submitted_at: string
          target_id: string
          target_type: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          flags?: string[]
          id?: string
          kind?: string
          provider_id: string
          reason?: string | null
          status?: string
          submitted_at?: string
          target_id: string
          target_type: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          flags?: string[]
          id?: string
          kind?: string
          provider_id?: string
          reason?: string | null
          status?: string
          submitted_at?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_categories: {
        Row: {
          category_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_providers: {
        Row: {
          created_at: string
          provider_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          provider_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          provider_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_providers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          id: string
          kind: string
          last_alerted_at: string | null
          name: string
          query: Json
          user_id: string
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          id?: string
          kind: string
          last_alerted_at?: string | null
          name: string
          query?: Json
          user_id: string
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          id?: string
          kind?: string
          last_alerted_at?: string | null
          name?: string
          query?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_services: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_services_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_documents: {
        Row: {
          category_ids: string[]
          category_paths: unknown[]
          completed_orders: number
          country_code: string | null
          currency: string | null
          delivery_days_min: number | null
          document: unknown
          entity_id: string
          entity_type: string
          is_visible: boolean
          language_codes: string[]
          price_from_minor: number | null
          pricing_model: Database["public"]["Enums"]["pricing_model"] | null
          provider_id: string
          provider_type: Database["public"]["Enums"]["provider_type"] | null
          published_at: string | null
          rating_bayes: number | null
          refreshed_at: string
          summary: string | null
          term_ids: string[]
          title: string
        }
        Insert: {
          category_ids?: string[]
          category_paths?: unknown[]
          completed_orders?: number
          country_code?: string | null
          currency?: string | null
          delivery_days_min?: number | null
          document: unknown
          entity_id: string
          entity_type: string
          is_visible?: boolean
          language_codes?: string[]
          price_from_minor?: number | null
          pricing_model?: Database["public"]["Enums"]["pricing_model"] | null
          provider_id: string
          provider_type?: Database["public"]["Enums"]["provider_type"] | null
          published_at?: string | null
          rating_bayes?: number | null
          refreshed_at?: string
          summary?: string | null
          term_ids?: string[]
          title: string
        }
        Update: {
          category_ids?: string[]
          category_paths?: unknown[]
          completed_orders?: number
          country_code?: string | null
          currency?: string | null
          delivery_days_min?: number | null
          document?: unknown
          entity_id?: string
          entity_type?: string
          is_visible?: boolean
          language_codes?: string[]
          price_from_minor?: number | null
          pricing_model?: Database["public"]["Enums"]["pricing_model"] | null
          provider_id?: string
          provider_type?: Database["public"]["Enums"]["provider_type"] | null
          published_at?: string | null
          rating_bayes?: number | null
          refreshed_at?: string
          summary?: string | null
          term_ids?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_addons: {
        Row: {
          description: string | null
          extra_delivery_days: number
          id: string
          is_active: boolean
          listing_id: string
          price_minor: number
          sort_order: number
          title: string
        }
        Insert: {
          description?: string | null
          extra_delivery_days?: number
          id?: string
          is_active?: boolean
          listing_id: string
          price_minor: number
          sort_order?: number
          title: string
        }
        Update: {
          description?: string | null
          extra_delivery_days?: number
          id?: string
          is_active?: boolean
          listing_id?: string
          price_minor?: number
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_deliverables: {
        Row: {
          id: string
          listing_id: string
          package_id: string | null
          sort_order: number
          title: string
        }
        Insert: {
          id?: string
          listing_id: string
          package_id?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          id?: string
          listing_id?: string
          package_id?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_deliverables_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_deliverables_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      service_faqs: {
        Row: {
          answer: string
          id: string
          listing_id: string
          question: string
          sort_order: number
        }
        Insert: {
          answer: string
          id?: string
          listing_id: string
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string
          id?: string
          listing_id?: string
          question?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_faqs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_listing_categories: {
        Row: {
          category_id: string
          listing_id: string
        }
        Insert: {
          category_id: string
          listing_id: string
        }
        Update: {
          category_id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_listing_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_listing_categories_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_listing_terms: {
        Row: {
          listing_id: string
          term_id: string
        }
        Insert: {
          listing_id: string
          term_id: string
        }
        Update: {
          listing_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_listing_terms_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_listing_terms_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_listings: {
        Row: {
          balance_trigger: Database["public"]["Enums"]["balance_trigger"] | null
          base_delivery_days: number | null
          created_at: string
          currency: string
          deposit_bps: number | null
          description: string | null
          fixed_price_minor: number | null
          hourly_rate_minor: number | null
          id: string
          min_hours: number | null
          payment_model: Database["public"]["Enums"]["payment_model"]
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          primary_category_id: string | null
          provider_id: string
          published_at: string | null
          quote_from_minor: number | null
          requirements_intro: string | null
          revision_policy: string | null
          revisions_included: number | null
          slug: string
          source_locale: string
          status: Database["public"]["Enums"]["listing_status"]
          submitted_at: string | null
          summary: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          balance_trigger?:
            | Database["public"]["Enums"]["balance_trigger"]
            | null
          base_delivery_days?: number | null
          created_at?: string
          currency?: string
          deposit_bps?: number | null
          description?: string | null
          fixed_price_minor?: number | null
          hourly_rate_minor?: number | null
          id?: string
          min_hours?: number | null
          payment_model?: Database["public"]["Enums"]["payment_model"]
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          primary_category_id?: string | null
          provider_id: string
          published_at?: string | null
          quote_from_minor?: number | null
          requirements_intro?: string | null
          revision_policy?: string | null
          revisions_included?: number | null
          slug: string
          source_locale?: string
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          balance_trigger?:
            | Database["public"]["Enums"]["balance_trigger"]
            | null
          base_delivery_days?: number | null
          created_at?: string
          currency?: string
          deposit_bps?: number | null
          description?: string | null
          fixed_price_minor?: number | null
          hourly_rate_minor?: number | null
          id?: string
          min_hours?: number | null
          payment_model?: Database["public"]["Enums"]["payment_model"]
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          primary_category_id?: string | null
          provider_id?: string
          published_at?: string | null
          quote_from_minor?: number | null
          requirements_intro?: string | null
          revision_policy?: string | null
          revisions_included?: number | null
          slug?: string
          source_locale?: string
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_listings_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_listings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_media: {
        Row: {
          alt_text: string
          file_id: string
          id: string
          listing_id: string
          sort_order: number
        }
        Insert: {
          alt_text: string
          file_id: string
          id?: string
          listing_id: string
          sort_order?: number
        }
        Update: {
          alt_text?: string
          file_id?: string
          id?: string
          listing_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_media_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          delivery_days: number
          description: string | null
          id: string
          is_active: boolean
          listing_id: string
          name: string
          price_minor: number
          revisions_included: number
          tier: number
        }
        Insert: {
          delivery_days: number
          description?: string | null
          id?: string
          is_active?: boolean
          listing_id: string
          name: string
          price_minor: number
          revisions_included?: number
          tier: number
        }
        Update: {
          delivery_days?: number
          description?: string | null
          id?: string
          is_active?: boolean
          listing_id?: string
          name?: string
          price_minor?: number
          revisions_included?: number
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requirements: {
        Row: {
          id: string
          input_type: Database["public"]["Enums"]["requirement_input"]
          is_required: boolean
          listing_id: string
          options: string[] | null
          prompt: string
          sort_order: number
        }
        Insert: {
          id?: string
          input_type?: Database["public"]["Enums"]["requirement_input"]
          is_required?: boolean
          listing_id: string
          options?: string[] | null
          prompt: string
          sort_order?: number
        }
        Update: {
          id?: string
          input_type?: Database["public"]["Enums"]["requirement_input"]
          is_required?: boolean
          listing_id?: string
          options?: string[] | null
          prompt?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_requirements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_term_aliases: {
        Row: {
          alias: string
          locale: string
          term_id: string
        }
        Insert: {
          alias: string
          locale?: string
          term_id: string
        }
        Update: {
          alias?: string
          locale?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_term_aliases_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_term_translations: {
        Row: {
          description: string | null
          locale: string
          name: string
          term_id: string
        }
        Insert: {
          description?: string | null
          locale: string
          name: string
          term_id: string
        }
        Update: {
          description?: string | null
          locale?: string
          name?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_term_translations_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_terms: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["term_kind"]
          merged_into_id: string | null
          slug: string
          status: Database["public"]["Enums"]["term_status"]
          suggested_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["term_kind"]
          merged_into_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["term_status"]
          suggested_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["term_kind"]
          merged_into_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["term_status"]
          suggested_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_terms_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_terms_suggested_by_fk"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          enabled_at: string
          role: Database["public"]["Enums"]["marketplace_role"]
          status: Database["public"]["Enums"]["role_status"]
          suspended_at: string | null
          suspension_reason: string | null
          user_id: string
        }
        Insert: {
          enabled_at?: string
          role: Database["public"]["Enums"]["marketplace_role"]
          status?: Database["public"]["Enums"]["role_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
          user_id: string
        }
        Update: {
          enabled_at?: string
          role?: Database["public"]["Enums"]["marketplace_role"]
          status?: Database["public"]["Enums"]["role_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_current_legal_documents: { Args: never; Returns: number }
      admin_merge_term: {
        Args: { p_from: string; p_into: string }
        Returns: undefined
      }
      admin_moderate_message: {
        Args: {
          p_action: string
          p_message_id: string
          p_reason?: string
          p_report_id?: string
        }
        Returns: undefined
      }
      admin_reassign_category_listings: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      admin_reported_message: {
        Args: { p_report_id: string }
        Returns: {
          body: string
          created_at: string
          is_reported: boolean
          message_id: string
          moderation_state: string
          sender_name: string
          sender_user_id: string
        }[]
      }
      admin_resolve_report: {
        Args: { p_note?: string; p_outcome: string; p_report_id: string }
        Returns: undefined
      }
      admin_review: {
        Args: { p_decision: string; p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      admin_save_category: {
        Args: {
          p_description?: string
          p_icon_key?: string
          p_id: string
          p_is_visible?: boolean
          p_name: string
          p_parent_id: string
          p_short_description?: string
          p_slug: string
          p_sort_order?: number
        }
        Returns: string
      }
      admin_save_term: {
        Args: {
          p_aliases?: string[]
          p_description?: string
          p_id: string
          p_kind: Database["public"]["Enums"]["term_kind"]
          p_name: string
          p_slug: string
        }
        Returns: string
      }
      admin_set_category_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      admin_set_project_status: {
        Args: {
          p_action: string
          p_project_id: string
          p_reason?: string
          p_report_id?: string
        }
        Returns: undefined
      }
      admin_set_status: {
        Args: {
          p_action: string
          p_reason?: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      admin_set_term_status: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["term_status"]
        }
        Returns: undefined
      }
      category_listing_counts: {
        Args: never
        Returns: {
          category_id: string
          listing_count: number
        }[]
      }
      client_complete_onboarding: { Args: never; Returns: undefined }
      conversations_mark_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      conversations_open: {
        Args: {
          p_client_user_id?: string
          p_context_listing_id?: string
          p_context_project_id?: string
          p_provider_id?: string
        }
        Returns: string
      }
      current_legal_documents: {
        Args: never
        Returns: {
          content_sha256: string | null
          created_at: string
          id: string
          is_draft: boolean
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          locale: string
          published_at: string | null
          requires_acceptance: boolean
          url_path: string
          version: string
        }[]
        SetofOptions: {
          from: "*"
          to: "legal_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      discard_uploaded_file: { Args: { p_file_id: string }; Returns: string }
      enable_marketplace_role: {
        Args: { p_role: Database["public"]["Enums"]["marketplace_role"] }
        Returns: undefined
      }
      file_record_scan: {
        Args: {
          p_detail?: string
          p_file_id: string
          p_status: Database["public"]["Enums"]["scan_status"]
        }
        Returns: undefined
      }
      file_scan_target: {
        Args: { p_file_id: string }
        Returns: {
          bucket: string
          mime_type: string
          path: string
          scan_status: Database["public"]["Enums"]["scan_status"]
          size_bytes: number
        }[]
      }
      has_accepted_current_legal: { Args: never; Returns: boolean }
      invitations_decline: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      listing_checklist: { Args: { p_listing_id: string }; Returns: string[] }
      listings_change_status: {
        Args: { p_action: string; p_listing_id: string }
        Returns: Database["public"]["Enums"]["listing_status"]
      }
      listings_submit_for_review: {
        Args: { p_listing_id: string }
        Returns: string[]
      }
      messages_send: {
        Args: {
          p_body: string
          p_context_listing_id?: string
          p_context_project_id?: string
          p_conversation_id: string
          p_file_ids?: string[]
        }
        Returns: Json
      }
      my_conversations: {
        Args: { p_archived?: boolean; p_conversation_id?: string }
        Returns: {
          archived: boolean
          blocked_by_me: boolean
          can_reply: boolean
          context_listing_id: string
          context_listing_title: string
          context_project_id: string
          context_project_title: string
          counterpart_avatar_path: string
          counterpart_handle: string
          counterpart_name: string
          counterpart_provider_id: string
          counterpart_user_id: string
          created_at: string
          id: string
          kind: string
          last_body: string
          last_message_at: string
          last_moderation_state: string
          last_sender_is_me: boolean
          muted: boolean
          my_role: string
          status: string
          unread_count: number
        }[]
      }
      my_counts: { Args: never; Returns: Json }
      notification_email_payload: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      notification_record_delivery: {
        Args: {
          p_error?: string
          p_notification_id: string
          p_provider_ref?: string
          p_status: string
        }
        Returns: undefined
      }
      outbox_claim: {
        Args: { p_limit?: number }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempts: number
          created_at: string
          id: string
          payload: Json
          topic: string
        }[]
      }
      outbox_complete: { Args: { p_ids: string[] }; Returns: number }
      outbox_fail: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      project_checklist: { Args: { p_project_id: string }; Returns: string[] }
      projects_change_status: {
        Args: { p_action: string; p_project_id: string }
        Returns: Database["public"]["Enums"]["project_status"]
      }
      projects_invite: {
        Args: {
          p_message?: string
          p_project_id: string
          p_provider_id: string
        }
        Returns: string
      }
      projects_publish: { Args: { p_project_id: string }; Returns: string[] }
      proposal_checklist: { Args: { p_proposal_id: string }; Returns: string[] }
      proposals_decide: {
        Args: { p_action: string; p_proposal_id: string; p_reason?: string }
        Returns: Database["public"]["Enums"]["proposal_status"]
      }
      proposals_submit: { Args: { p_proposal_id: string }; Returns: string[] }
      proposals_withdraw: {
        Args: { p_proposal_id: string }
        Returns: undefined
      }
      provider_profile_checklist: {
        Args: { p_provider_id: string }
        Returns: string[]
      }
      providers_set_avatar: { Args: { p_file_id: string }; Returns: undefined }
      providers_set_handle: { Args: { p_handle: string }; Returns: undefined }
      providers_submit_for_review: { Args: never; Returns: string[] }
      register_private_file: {
        Args: {
          p_display_name: string
          p_mime: string
          p_path: string
          p_purpose: Database["public"]["Enums"]["file_purpose"]
          p_sha256: string
          p_size: number
        }
        Returns: string
      }
      register_uploaded_file: {
        Args: {
          p_mime: string
          p_path: string
          p_purpose: Database["public"]["Enums"]["file_purpose"]
          p_sha256: string
          p_size: number
        }
        Returns: string
      }
      reports_create: {
        Args: {
          p_details?: string
          p_reason: Database["public"]["Enums"]["report_reason"]
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      saved_search_alert_candidates: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          kind: string
          name: string
          query: Json
          since: string
          user_id: string
        }[]
      }
      saved_search_record_alert: {
        Args: { p_id: string; p_matches: number }
        Returns: undefined
      }
      search_listings: {
        Args: {
          p_category_id?: string
          p_country?: string
          p_currency?: string
          p_language?: string
          p_limit?: number
          p_max_delivery_days?: number
          p_max_price_minor?: number
          p_min_price_minor?: number
          p_offset?: number
          p_pricing_model?: Database["public"]["Enums"]["pricing_model"]
          p_provider_id?: string
          p_provider_type?: Database["public"]["Enums"]["provider_type"]
          p_query?: string
          p_sort?: string
          p_term_ids?: string[]
        }
        Returns: {
          avatar_path: string
          country_code: string
          cover_path: string
          currency: string
          delivery_days_min: number
          listing_id: string
          price_from_minor: number
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          provider_handle: string
          provider_id: string
          provider_name: string
          provider_type: Database["public"]["Enums"]["provider_type"]
          rank: number
          slug: string
          summary: string
          title: string
          total_count: number
        }[]
      }
      search_providers: {
        Args: {
          p_category_id?: string
          p_country?: string
          p_language?: string
          p_limit?: number
          p_offset?: number
          p_provider_type?: Database["public"]["Enums"]["provider_type"]
          p_query?: string
          p_sort?: string
          p_term_ids?: string[]
        }
        Returns: {
          availability: Database["public"]["Enums"]["availability_status"]
          avatar_path: string
          country_code: string
          currency: string
          display_name: string
          experience_level: Database["public"]["Enums"]["experience_level"]
          handle: string
          headline: string
          language_codes: string[]
          listing_count: number
          price_from_minor: number
          provider_id: string
          provider_type: Database["public"]["Enums"]["provider_type"]
          rank: number
          total_count: number
        }[]
      }
      suggest_taxonomy_term: {
        Args: {
          p_kind: Database["public"]["Enums"]["term_kind"]
          p_name: string
        }
        Returns: string
      }
      switch_active_role: {
        Args: { p_role: Database["public"]["Enums"]["marketplace_role"] }
        Returns: Database["public"]["Enums"]["marketplace_role"]
      }
      unread_digest_candidates: {
        Args: { p_limit?: number; p_min_age_minutes?: number }
        Returns: {
          email: string
          locale: string
          name: string
          unread_conversations: number
          user_id: string
        }[]
      }
      unread_digest_mark_sent: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status:
        | "active"
        | "suspended"
        | "deactivated"
        | "pending_deletion"
        | "deleted"
      availability_status: "available" | "limited" | "unavailable"
      balance_trigger: "on_milestone_acceptance" | "before_final_delivery"
      budget_kind: "fixed" | "range" | "hourly" | "not_sure"
      client_account_type: "individual" | "business"
      company_size: "1" | "2-10" | "11-50" | "51-200" | "201-1000" | "1000+"
      experience_level: "emerging" | "established" | "expert"
      file_purpose:
        | "avatar"
        | "listing_media"
        | "portfolio_media"
        | "message_attachment"
        | "project_attachment"
        | "delivery"
        | "verification_evidence"
        | "export"
      invitation_status: "sent" | "declined" | "proposal_submitted"
      language_proficiency: "basic" | "conversational" | "fluent" | "native"
      legal_doc_kind:
        | "terms"
        | "privacy"
        | "provider_agreement"
        | "refund_policy"
        | "cookie_policy"
        | "acceptable_use"
      link_kind:
        | "github"
        | "linkedin"
        | "huggingface"
        | "kaggle"
        | "website"
        | "x"
        | "youtube"
        | "scholar"
        | "other"
      listing_status:
        | "draft"
        | "pending_review"
        | "published"
        | "paused"
        | "archived"
        | "rejected"
        | "suspended"
      marketplace_role: "client" | "expert"
      payment_model: "full" | "deposit"
      portfolio_provenance: "self_reported" | "greco_order" | "greco_verified"
      portfolio_status: "draft" | "published" | "hidden"
      pricing_model: "fixed" | "packages" | "hourly" | "quote"
      project_status:
        | "draft"
        | "open"
        | "closed"
        | "hired"
        | "cancelled"
        | "expired"
        | "removed"
      project_visibility: "public" | "invite_only"
      proposal_pricing: "fixed" | "hourly_block"
      proposal_status:
        | "draft"
        | "submitted"
        | "shortlisted"
        | "declined"
        | "withdrawn"
        | "accepted"
        | "expired"
      provider_status:
        | "draft"
        | "pending_review"
        | "active"
        | "suspended"
        | "deactivated"
      provider_type: "individual" | "agency"
      report_reason:
        | "spam"
        | "scam_or_fraud"
        | "off_platform"
        | "harassment"
        | "inappropriate"
        | "intellectual_property"
        | "misleading"
        | "prohibited_service"
        | "other"
      requirement_input:
        | "text"
        | "long_text"
        | "url"
        | "choice"
        | "multi_choice"
      role_status: "active" | "suspended"
      scan_status: "pending" | "clean" | "infected" | "error" | "skipped"
      staff_role: "super_admin" | "admin" | "moderator" | "support" | "finance"
      team_size: "2-5" | "6-10" | "11-25" | "26-50" | "51-200" | "200+"
      term_kind:
        | "skill"
        | "technology"
        | "tool"
        | "framework"
        | "model"
        | "platform"
        | "industry"
        | "use_case"
      term_status: "active" | "pending" | "merged" | "retired"
      timeline_kind: "asap" | "weeks" | "months" | "flexible"
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
    Enums: {
      account_status: [
        "active",
        "suspended",
        "deactivated",
        "pending_deletion",
        "deleted",
      ],
      availability_status: ["available", "limited", "unavailable"],
      balance_trigger: ["on_milestone_acceptance", "before_final_delivery"],
      budget_kind: ["fixed", "range", "hourly", "not_sure"],
      client_account_type: ["individual", "business"],
      company_size: ["1", "2-10", "11-50", "51-200", "201-1000", "1000+"],
      experience_level: ["emerging", "established", "expert"],
      file_purpose: [
        "avatar",
        "listing_media",
        "portfolio_media",
        "message_attachment",
        "project_attachment",
        "delivery",
        "verification_evidence",
        "export",
      ],
      invitation_status: ["sent", "declined", "proposal_submitted"],
      language_proficiency: ["basic", "conversational", "fluent", "native"],
      legal_doc_kind: [
        "terms",
        "privacy",
        "provider_agreement",
        "refund_policy",
        "cookie_policy",
        "acceptable_use",
      ],
      link_kind: [
        "github",
        "linkedin",
        "huggingface",
        "kaggle",
        "website",
        "x",
        "youtube",
        "scholar",
        "other",
      ],
      listing_status: [
        "draft",
        "pending_review",
        "published",
        "paused",
        "archived",
        "rejected",
        "suspended",
      ],
      marketplace_role: ["client", "expert"],
      payment_model: ["full", "deposit"],
      portfolio_provenance: ["self_reported", "greco_order", "greco_verified"],
      portfolio_status: ["draft", "published", "hidden"],
      pricing_model: ["fixed", "packages", "hourly", "quote"],
      project_status: [
        "draft",
        "open",
        "closed",
        "hired",
        "cancelled",
        "expired",
        "removed",
      ],
      project_visibility: ["public", "invite_only"],
      proposal_pricing: ["fixed", "hourly_block"],
      proposal_status: [
        "draft",
        "submitted",
        "shortlisted",
        "declined",
        "withdrawn",
        "accepted",
        "expired",
      ],
      provider_status: [
        "draft",
        "pending_review",
        "active",
        "suspended",
        "deactivated",
      ],
      provider_type: ["individual", "agency"],
      report_reason: [
        "spam",
        "scam_or_fraud",
        "off_platform",
        "harassment",
        "inappropriate",
        "intellectual_property",
        "misleading",
        "prohibited_service",
        "other",
      ],
      requirement_input: ["text", "long_text", "url", "choice", "multi_choice"],
      role_status: ["active", "suspended"],
      scan_status: ["pending", "clean", "infected", "error", "skipped"],
      staff_role: ["super_admin", "admin", "moderator", "support", "finance"],
      team_size: ["2-5", "6-10", "11-25", "26-50", "51-200", "200+"],
      term_kind: [
        "skill",
        "technology",
        "tool",
        "framework",
        "model",
        "platform",
        "industry",
        "use_case",
      ],
      term_status: ["active", "pending", "merged", "retired"],
      timeline_kind: ["asap", "weeks", "months", "flexible"],
    },
  },
} as const

