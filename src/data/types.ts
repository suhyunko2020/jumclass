// ── 강의 데이터 타입 정의 ──────────────────────────────────
export interface PricingTier {
  days: number;
  price: number;
  originalPrice: number;
}

export interface PauseConfig {
  maxPauses: number;
  maxDays: number;
}

export interface LessonAttachment {
  name: string;
  ext: string;
  url: string;
}

export interface LessonItem {
  id: string;
  title: string;
  duration: string;
  vimeo: string;
  status: 'free' | 'locked';
  attachments?: LessonAttachment[];
}

export interface CurriculumSection {
  section: string;
  items: LessonItem[];
}

export interface Attachment {
  name: string;
  ext?: string;
}

export interface Review {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  date: string;
  source?: 'user' | 'admin';
}

export interface Course {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  instructor: string;
  instructorAvatar: string;
  instructorBio: string;
  level: string;
  duration: string;
  lessons: number;
  price: number;
  originalPrice: number;
  pricingTiers: PricingTier[];
  rating: number;
  ratingCount: number;
  students: number;
  badge: string;
  whatYouLearn: string[];
  curriculum: CurriculumSection[];
  attachments?: Attachment[];
  reviews?: Review[];
  pauseConfig?: PauseConfig;
  status?: 'public' | 'private';
  includedCourseIds?: string[];
}

export interface AttachmentDownloadLog {
  lessonId: string;
  attachmentName: string;
  downloadedAt: string;
}

export interface Enrollment {
  courseId: string;
  enrolledAt: string;
  expiryDate: string;
  progress: number;
  completedLessons: string[];
  type?: 'manual' | 'payment';
  paused?: boolean;
  pausedAt?: string;
  remainingDays?: number;
  pauseCount?: number;
  policyAgreedAt?: string;
  policyAgreedKeys?: string[];
  attachmentDownloads?: AttachmentDownloadLog[];
  assignedInstructorId?: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
  enrollments: Enrollment[];
  password?: string;
}

export interface InstructorService {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  duration: string;
  type: 'consultation' | 'reading' | 'lesson' | 'other';
  mode?: 'online' | 'offline' | 'both';
  // 레슨 타입 서비스를 실제 자격증 강의와 연결. 설정 시 신청 버튼은
  // 해당 자격증 CourseDetailPage로 이동하며 이 강사가 강제 지정됨.
  linkedCourseId?: string;
}

export interface Instructor {
  id: string;
  name: string;
  photo: string;
  title: string;
  bio: string;
  specialties: string[];
  experience: string;
  instagram?: string;
  kakao?: string;
  phone?: string;
  consultOnline?: boolean;
  consultOffline?: boolean;
  offlineAddress?: string;
  services: InstructorService[];
  courseIds: string[];
  status?: 'public' | 'private';
}

// 강사용 진도 관리 페이지 (자격증 과정 전용, 토큰 기반 접근)
export interface ProgressChecklistItem {
  id: string;
  title: string;
  description?: string;
  checked: boolean;
  checkedAt?: string;
}

export interface InstructorProgressPage {
  id: string;               // 토큰 (URL /i/:id)
  userId: string;           // 수강생 id
  courseId: string;         // 자격증 강의 id
  instructorId: string;     // 담당 강사 id
  checklist: ProgressChecklistItem[];
  notes: string;            // 강사 메모
  completedAt?: string;     // 전체 체크 완료 시각
  expiresAt?: string;       // 만료 시각 (completedAt + 7일)
  createdAt: string;
  updatedAt: string;
}

export interface Inquiry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  subject: string;
  message: string;
  status: 'pending' | 'answered';
  answer: string;
  answeredAt?: string;
  date: string;
  metadata?: {
    courseId?: string;
    orderDate?: string;
  };
}
