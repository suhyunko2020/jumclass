// Supabase 테이블 타입 정의
// 실제 테이블 생성 후 `npx supabase gen types typescript` 로 자동 생성 가능

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          avatar: string | null
        }
        Insert: {
          id: string
          name?: string | null
          avatar?: string | null
        }
        Update: {
          name?: string | null
          avatar?: string | null
        }
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          enrolled_at: string
          expiry_date: string
          progress: number
          completed_lessons: string[]
          type: string
          paused: boolean
          paused_at: string | null
          remaining_days: number | null
          pause_count: number
        }
        Insert: {
          user_id: string
          course_id: string
          expiry_date: string
          progress?: number
          completed_lessons?: string[]
          type?: string
          paused?: boolean
          paused_at?: string | null
          remaining_days?: number | null
          pause_count?: number
        }
        Update: {
          expiry_date?: string
          progress?: number
          completed_lessons?: string[]
          type?: string
          paused?: boolean
          paused_at?: string | null
          remaining_days?: number | null
          pause_count?: number
        }
      }
      inquiries: {
        Row: {
          id: string
          user_id: string
          user_name: string
          user_email: string
          type: string
          subject: string
          message: string
          status: string
          answer: string
          answered_at: string | null
          created_at: string
          course_id: string | null
          order_date: string | null
        }
        Insert: {
          user_id: string
          user_name: string
          user_email: string
          type?: string
          subject: string
          message: string
          course_id?: string | null
          order_date?: string | null
        }
        Update: {
          subject?: string
          message?: string
          status?: string
          answer?: string
          answered_at?: string | null
        }
      }
      reviews: {
        Row: {
          id: string
          course_id: string
          user_id: string
          user_name: string
          user_avatar: string | null
          rating: number
          text: string
          created_at: string
        }
        Insert: {
          course_id: string
          user_id: string
          user_name: string
          user_avatar?: string | null
          rating: number
          text: string
        }
        Update: {
          rating?: number
          text?: string
        }
      }
      course_overrides: {
        Row: {
          course_id: string
          data: Record<string, unknown>
          updated_at: string
        }
        Insert: {
          course_id: string
          data: Record<string, unknown>
        }
        Update: {
          data?: Record<string, unknown>
          updated_at?: string
        }
      }
      custom_courses: {
        Row: {
          id: string
          data: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id: string
          data: Record<string, unknown>
        }
        Update: {
          data?: Record<string, unknown>
        }
      }
    }
  }
}
