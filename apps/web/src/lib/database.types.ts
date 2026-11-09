
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "acknowledgments": {
                  Row: {
                    "at": string,"family_id": string,"id": string,"member_id": string,"subject_id": string,"subject_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"family_id": string,"id"?: string,"member_id": string,"subject_id": string,"subject_type": string
                  }
                  Update: {
                    "at"?: string,"family_id"?: string,"id"?: string,"member_id"?: string,"subject_id"?: string,"subject_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "acknowledgments_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acknowledgments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "bytes": number,"created_at": string,"created_by": string,"duration_ms": number | null,"family_id": string,"height": number | null,"id": string,"kind": string,"mime": string,"owner_id": string,"owner_type": string,"storage_path": string,"thumb_path": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes": number,"created_at"?: string,"created_by": string,"duration_ms"?: number | null,"family_id": string,"height"?: number | null,"id"?: string,"kind": string,"mime": string,"owner_id": string,"owner_type": string,"storage_path": string,"thumb_path"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number,"created_at"?: string,"created_by"?: string,"duration_ms"?: number | null,"family_id"?: string,"height"?: number | null,"id"?: string,"kind"?: string,"mime"?: string,"owner_id"?: string,"owner_type"?: string,"storage_path"?: string,"thumb_path"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"at": string,"family_id": string,"id": string,"new": Json | null,"old": Json | null,"row_id": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"at"?: string,"family_id": string,"id"?: string,"new"?: Json | null,"old"?: Json | null,"row_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"at"?: string,"family_id"?: string,"id"?: string,"new"?: Json | null,"old"?: Json | null,"row_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"checkins": {
                  Row: {
                    "accuracy_m": number | null,"actor_member_id": string,"at": string,"created_at": string,"family_id": string,"handover_id": string,"id": string,"kind": string,"lat": number | null,"lng": number | null,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"actor_member_id": string,"at"?: string,"created_at"?: string,"family_id": string,"handover_id": string,"id"?: string,"kind": string,"lat"?: number | null,"lng"?: number | null,"note"?: string | null
                  }
                  Update: {
                    "accuracy_m"?: number | null,"actor_member_id"?: string,"at"?: string,"created_at"?: string,"family_id"?: string,"handover_id"?: string,"id"?: string,"kind"?: string,"lat"?: number | null,"lng"?: number | null,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkins_actor_member_id_fkey"
      columns: ["actor_member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_handover_id_family_id_fkey"
      columns: ["handover_id","family_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "checkins_handover_id_fkey"
      columns: ["handover_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["id"]
    }
                  ]
                },"custody_exceptions": {
                  Row: {
                    "created_at": string,"ends_at": string,"family_id": string,"id": string,"parent_member_id": string,"proposal_id": string | null,"reason": string | null,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at": string,"family_id": string,"id"?: string,"parent_member_id": string,"proposal_id"?: string | null,"reason"?: string | null,"starts_at": string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"family_id"?: string,"id"?: string,"parent_member_id"?: string,"proposal_id"?: string | null,"reason"?: string | null,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "custody_exceptions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "custody_exceptions_parent_member_id_fkey"
      columns: ["parent_member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    }
                  ]
                },"custody_patterns": {
                  Row: {
                    "created_at": string,"created_by": string,"cycle_length_days": number,"family_id": string,"handover_location": string | null,"handover_time": string,"id": string,"is_active": boolean,"name": string,"segments": NonNullable<Json>,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"cycle_length_days": number,"family_id": string,"handover_location"?: string | null,"handover_time"?: string,"id"?: string,"is_active"?: boolean,"name": string,"segments": NonNullable<Json>,"starts_on": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"cycle_length_days"?: number,"family_id"?: string,"handover_location"?: string | null,"handover_time"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"segments"?: NonNullable<Json>,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "custody_patterns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "custody_patterns_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"event_children": {
                  Row: {
                    "child_member_id": string,"event_id": string,"family_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_member_id": string,"event_id": string,"family_id": string
                  }
                  Update: {
                    "child_member_id"?: string,"event_id"?: string,"family_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_children_child_member_id_family_id_fkey"
      columns: ["child_member_id","family_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "event_children_event_id_family_id_fkey"
      columns: ["event_id","family_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"events": {
                  Row: {
                    "all_day": boolean,"created_at": string,"created_by": string,"ends_at": string,"family_id": string,"id": string,"kind": string,"location": string | null,"notes": string | null,"rrule": string | null,"starts_at": string,"status": string,"superseded_by": string | null,"supersedes_id": string | null,"title": string,"version": number,"visibility": string,"void_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"created_at"?: string,"created_by": string,"ends_at": string,"family_id": string,"id"?: string,"kind": string,"location"?: string | null,"notes"?: string | null,"rrule"?: string | null,"starts_at": string,"status"?: string,"superseded_by"?: string | null,"supersedes_id"?: string | null,"title": string,"version"?: number,"visibility"?: string,"void_reason"?: string | null
                  }
                  Update: {
                    "all_day"?: boolean,"created_at"?: string,"created_by"?: string,"ends_at"?: string,"family_id"?: string,"id"?: string,"kind"?: string,"location"?: string | null,"notes"?: string | null,"rrule"?: string | null,"starts_at"?: string,"status"?: string,"superseded_by"?: string | null,"supersedes_id"?: string | null,"title"?: string,"version"?: number,"visibility"?: string,"void_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_children": {
                  Row: {
                    "child_member_id": string,"expense_id": string,"family_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_member_id": string,"expense_id": string,"family_id": string
                  }
                  Update: {
                    "child_member_id"?: string,"expense_id"?: string,"family_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_children_child_member_id_family_id_fkey"
      columns: ["child_member_id","family_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "expense_children_expense_id_family_id_fkey"
      columns: ["expense_id","family_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount_minor": number,"category": string,"created_at": string,"created_by": string,"currency": string,"decision_proposal_id": string | null,"family_id": string,"id": string,"merchant": string | null,"note": string | null,"original_amount_minor": number | null,"original_currency": string | null,"paid_by_member_id": string | null,"spent_on": string,"status": string,"superseded_by": string | null,"supersedes_id": string | null,"title": string,"version": number,"void_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"category": string,"created_at"?: string,"created_by": string,"currency": string,"decision_proposal_id"?: string | null,"family_id": string,"id"?: string,"merchant"?: string | null,"note"?: string | null,"original_amount_minor"?: number | null,"original_currency"?: string | null,"paid_by_member_id"?: string | null,"spent_on": string,"status"?: string,"superseded_by"?: string | null,"supersedes_id"?: string | null,"title": string,"version"?: number,"void_reason"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"category"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"decision_proposal_id"?: string | null,"family_id"?: string,"id"?: string,"merchant"?: string | null,"note"?: string | null,"original_amount_minor"?: number | null,"original_currency"?: string | null,"paid_by_member_id"?: string | null,"spent_on"?: string,"status"?: string,"superseded_by"?: string | null,"supersedes_id"?: string | null,"title"?: string,"version"?: number,"void_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_decision_proposal_id_fkey"
      columns: ["decision_proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_member_id_fkey"
      columns: ["paid_by_member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "children_can_post": boolean,"created_at": string,"created_by": string,"default_currency": string,"id": string,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "children_can_post"?: boolean,"created_at"?: string,"created_by": string,"default_currency"?: string,"id"?: string,"name": string,"timezone": string
                  }
                  Update: {
                    "children_can_post"?: boolean,"created_at"?: string,"created_by"?: string,"default_currency"?: string,"id"?: string,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "families_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "birthdate": string | null,"color": string,"created_at": string,"display_name": string,"family_id": string,"id": string,"role": string,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birthdate"?: string | null,"color"?: string,"created_at"?: string,"display_name": string,"family_id": string,"id"?: string,"role": string,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "birthdate"?: string | null,"color"?: string,"created_at"?: string,"display_name"?: string,"family_id"?: string,"id"?: string,"role"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"handovers": {
                  Row: {
                    "created_at": string,"created_by": string | null,"family_id": string,"from_parent_id": string,"id": string,"location": string | null,"scheduled_at": string,"source": string,"status": string,"to_parent_id": string,"void_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"family_id": string,"from_parent_id": string,"id"?: string,"location"?: string | null,"scheduled_at": string,"source": string,"status"?: string,"to_parent_id": string,"void_reason"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"family_id"?: string,"from_parent_id"?: string,"id"?: string,"location"?: string | null,"scheduled_at"?: string,"source"?: string,"status"?: string,"to_parent_id"?: string,"void_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "handovers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handovers_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handovers_from_parent_id_fkey"
      columns: ["from_parent_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handovers_to_parent_id_fkey"
      columns: ["to_parent_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_by": string,"email": string | null,"expires_at": string,"family_id": string,"id": string,"role": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by": string,"email"?: string | null,"expires_at": string,"family_id": string,"id"?: string,"role": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"role"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "inbox": boolean,"push": boolean,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "inbox"?: boolean,"push"?: boolean,"type": string,"user_id": string
                  }
                  Update: {
                    "inbox"?: boolean,"push"?: boolean,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"family_id": string,"id": string,"link": string | null,"payload": NonNullable<Json>,"pushed_at": string | null,"read_at": string | null,"recipient_user_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"id"?: string,"link"?: string | null,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_user_id": string,"type": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"id"?: string,"link"?: string | null,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"recipient_user_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_user_id_fkey"
      columns: ["recipient_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "audience": string,"author_member_id": string,"body": string | null,"created_at": string,"event_id": string | null,"family_id": string,"happened_on": string,"id": string,"status": string,"void_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audience": string,"author_member_id": string,"body"?: string | null,"created_at"?: string,"event_id"?: string | null,"family_id": string,"happened_on"?: string,"id"?: string,"status"?: string,"void_reason"?: string | null
                  }
                  Update: {
                    "audience"?: string,"author_member_id"?: string,"body"?: string | null,"created_at"?: string,"event_id"?: string | null,"family_id"?: string,"happened_on"?: string,"id"?: string,"status"?: string,"void_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_member_id_fkey"
      columns: ["author_member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"locale": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id": string,"locale"?: string,"timezone"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"proposal_responses": {
                  Row: {
                    "comment": string | null,"counter_proposal_id": string | null,"created_at": string,"family_id": string,"id": string,"member_id": string,"proposal_id": string,"response": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"counter_proposal_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"member_id": string,"proposal_id": string,"response": string
                  }
                  Update: {
                    "comment"?: string | null,"counter_proposal_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"member_id"?: string,"proposal_id"?: string,"response"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposal_responses_counter_proposal_id_fkey"
      columns: ["counter_proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_responses_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_responses_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposal_responses_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    }
                  ]
                },"proposals": {
                  Row: {
                    "amount_minor": number | null,"body": string | null,"created_at": string,"created_by": string,"currency": string | null,"expires_at": string,"family_id": string,"id": string,"kind": string,"parent_proposal_id": string | null,"payload": NonNullable<Json>,"reminded_at": string | null,"resolved_at": string | null,"status": string,"subject_id": string | null,"subject_type": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor"?: number | null,"body"?: string | null,"created_at"?: string,"created_by": string,"currency"?: string | null,"expires_at": string,"family_id": string,"id"?: string,"kind": string,"parent_proposal_id"?: string | null,"payload"?: NonNullable<Json>,"reminded_at"?: string | null,"resolved_at"?: string | null,"status"?: string,"subject_id"?: string | null,"subject_type"?: string | null,"title": string
                  }
                  Update: {
                    "amount_minor"?: number | null,"body"?: string | null,"created_at"?: string,"created_by"?: string,"currency"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"kind"?: string,"parent_proposal_id"?: string | null,"payload"?: NonNullable<Json>,"reminded_at"?: string | null,"resolved_at"?: string | null,"status"?: string,"subject_id"?: string | null,"subject_type"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proposals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proposals_parent_proposal_id_fkey"
      columns: ["parent_proposal_id"]
isOneToOne: false
      referencedRelation: "proposals"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_used_at": string | null,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_used_at"?: string | null,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_used_at"?: string | null,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string,"emoji": string,"family_id": string,"id": string,"member_id": string,"post_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"emoji": string,"family_id": string,"id"?: string,"member_id": string,"post_id": string
                  }
                  Update: {
                    "created_at"?: string,"emoji"?: string,"family_id"?: string,"id"?: string,"member_id"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactions_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"acknowledge":
{ Args: { "p_subject_id": string,"p_subject_type": string }; Returns: string
                           },
"add_child":
{ Args: { "p_birthdate": string,"p_color": string,"p_display_name": string,"p_family_id": string }; Returns: string
                           },
"apply_custody_pattern":
{ Args: { "p_actor": string,"p_family_id": string,"p_handover_location": string,"p_handover_time": string,"p_name": string,"p_preset": string,"p_segments": Json,"p_starts_on": string }; Returns: string
                           },
"apply_proposal_effect":
{ Args: { "p_id": string }; Returns: undefined
                           },
"calendar_range":
{ Args: { "p_family": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"checkin":
{ Args: { "p_handover_id": string,"p_kind": string,"p_lat": number,"p_lng": number,"p_note": string }; Returns: string
                           },
"create_attachment":
{ Args: { "p_bytes": number,"p_duration_ms": number,"p_family_id": string,"p_height": number,"p_kind": string,"p_mime": string,"p_owner_id": string,"p_owner_type": string,"p_storage_path": string,"p_thumb_path": string,"p_width": number }; Returns: string
                           },
"create_event":
{ Args: { "p_all_day": boolean,"p_child_ids": (string)[],"p_ends_at": string,"p_family_id": string,"p_kind": string,"p_location": string,"p_notes": string,"p_rrule": string,"p_starts_at": string,"p_title": string,"p_visibility": string }; Returns: string
                           },
"create_expense":
{ Args: { "p_amount_minor": number,"p_category": string,"p_child_ids": (string)[],"p_currency": string,"p_decision_proposal_id": string,"p_family_id": string,"p_merchant": string,"p_note": string,"p_original_amount_minor": number,"p_original_currency": string,"p_paid_by": string,"p_spent_on": string,"p_title": string }; Returns: string
                           },
"create_family":
{ Args: { "p_currency": string,"p_name": string,"p_timezone": string }; Returns: string
                           },
"create_invite":
{ Args: { "p_email": string,"p_family_id": string,"p_role": string }; Returns: string
                           },
"create_manual_handover":
{ Args: { "p_family_id": string,"p_from_parent": string,"p_location": string,"p_scheduled_at": string,"p_to_parent": string }; Returns: string
                           },
"create_proposal":
{ Args: { "p_amount_minor": number,"p_body": string,"p_currency": string,"p_family_id": string,"p_kind": string,"p_payload": Json,"p_title": string }; Returns: string
                           },
"current_member_id":
{ Args: { "fid": string }; Returns: string
                           },
"custody_parent_on":
{ Args: { "p_at": string,"p_family": string }; Returns: string
                           },
"custody_preset_segments":
{ Args: { "p_parent_a": string,"p_parent_b": string,"p_preset": string }; Returns: Json
                           },
"edit_expense":
{ Args: { "p_id": string,"p_patch": Json }; Returns: string
                           },
"generate_handovers":
{ Args: { "p_family": string,"p_from": string,"p_to": string }; Returns: number
                           },
"is_family_member":
{ Args: { "fid": string }; Returns: boolean
                           },
"is_family_parent":
{ Args: { "fid": string }; Returns: boolean
                           },
"leave_family":
{ Args: { "p_family_id": string }; Returns: undefined
                           },
"mark_all_notifications_read":
{ Args: { "p_family_id": string }; Returns: undefined
                           },
"mark_notification_read":
{ Args: { "p_id": string }; Returns: undefined
                           },
"notify_member":
{ Args: { "p_family": string,"p_link": string,"p_member": string,"p_payload": Json,"p_type": string }; Returns: undefined
                           },
"other_parent_member":
{ Args: { "p_family": string,"p_me": string }; Returns: string
                           },
"raise_app":
{ Args: { "code": string }; Returns: undefined
                           },
"respond_to_proposal":
{ Args: { "p_comment": string,"p_counter": Json,"p_id": string,"p_response": string }; Returns: string
                           },
"run_scheduled_jobs":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"save_custody_pattern":
{ Args: { "p_family_id": string,"p_handover_location": string,"p_handover_time": string,"p_name": string,"p_preset": string,"p_segments": Json,"p_starts_on": string }; Returns: Json
                           },
"storage_usage":
{ Args: { "p_family_id": string }; Returns: number
                           },
"subject_author":
{ Args: { "p_id": string,"p_type": string }; Returns: string
                           },
"update_event":
{ Args: { "p_id": string,"p_patch": Json }; Returns: string
                           },
"update_family":
{ Args: { "p_children_can_post": boolean,"p_currency": string,"p_family_id": string,"p_name": string,"p_timezone": string }; Returns: undefined
                           },
"update_my_member":
{ Args: { "p_color": string,"p_display_name": string,"p_family_id": string }; Returns: undefined
                           },
"update_my_profile":
{ Args: { "p_display_name": string,"p_locale": string }; Returns: undefined
                           },
"void_item":
{ Args: { "p_reason": string,"p_subject_id": string,"p_subject_type": string }; Returns: undefined
                           },
"withdraw_proposal":
{ Args: { "p_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
