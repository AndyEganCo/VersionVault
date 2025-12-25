// Shared types for Supabase edge functions

export interface StructuredNotes {
  new_features?: string[]
  changes?: string[]
  improvements?: string[]
  bug_fixes?: string[]
  known_issues?: string[]
  notices?: string[]
  compatibility?: string[]
  upgrade_instructions?: string[]
}

export interface MergeMetadata {
  merged_at: string
  had_manual_notes: boolean
  sources_combined: string[]
  ai_model_used: string
  merge_strategy: 'full' | 'partial' | 'manual_priority'
}
