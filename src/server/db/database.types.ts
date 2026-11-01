// Generated from the Supabase schema (project Greco). Do not edit by hand.
// Regenerate after every migration (see ENVIRONMENT_SETUP.md).

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
          profile_completeness: number
          provider_type: Database["public"]["Enums"]["provider_type"]
          published_at: string | null
          rate_currency: string | null
          source_locale: string
          status: Database["public"]["Enums"]["provider_status"]
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
          profile_completeness?: number
          provider_type?: Database["public"]["Enums"]["provider_type"]
          published_at?: string | null
          rate_currency?: string | null
          source_locale?: string
          status?: Database["public"]["Enums"]["provider_status"]
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
          profile_completeness?: number
          provider_type?: Database["public"]["Enums"]["provider_type"]
          published_at?: string | null
          rate_currency?: string | null
          source_locale?: string
          status?: Database["public"]["Enums"]["provider_status"]
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
      enable_marketplace_role: {
        Args: { p_role: Database["public"]["Enums"]["marketplace_role"] }
        Returns: undefined
      }
      has_accepted_current_legal: { Args: never; Returns: boolean }
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
      switch_active_role: {
        Args: { p_role: Database["public"]["Enums"]["marketplace_role"] }
        Returns: Database["public"]["Enums"]["marketplace_role"]
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
      marketplace_role: "client" | "expert"
      provider_status:
        | "draft"
        | "pending_review"
        | "active"
        | "suspended"
        | "deactivated"
      provider_type: "individual" | "agency"
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
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
