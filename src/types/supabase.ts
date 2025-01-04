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
      tracked_software: {
        Row: {
          id: string
          user_id: string
          software_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          software_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          software_id?: string
          created_at?: string
        }
      }
    }
  }
}