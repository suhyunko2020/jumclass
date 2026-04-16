# hooks

## useAuth.tsx (AuthContext + AuthProvider)
Supabase Auth 기반. `AppUser: { uid, name, email, avatar, createdAt, enrollments }`
- login/signup → `Promise<string|null>` (null=성공)
- enroll, completeLesson, pauseCourse, resumeCourse, enrollManual
- isEnrolled: 만료일 체크, paused도 true 반환
- syncFromSupabase() → 앱 시작 시 localStorage 캐시 갱신

## useCourses.ts
캐시 우선 패턴. localStorage 키: `arcana_course_overrides`, `arcana_custom_courses`, `arcana_reviews`, `arcana_course_order`, `arcana_lesson_attachments`
- getCourse(id): base COURSES + overrides + custom 병합
- getPublicCourses(): status!='private' 필터링 — 사용자 화면용
- getAllCourses(): 관리자용 (비공개 포함), 순서 반영
- saveCourseOrder(ids): 강의 순서 저장 (드래그 앤 드롭)
- addReview(courseId, userId, ..., source): source='user'|'admin'
- uploadLessonAttachment(lessonId, file): Supabase Storage 업로드 → URL 반환
- getLessonAttachments(lessonId): 첨부파일 메타 조회
- saveAllLessonAttachments(items): 일괄 메타 저장
- syncFromSupabase(): Supabase → localStorage 동기화

## useInstructors.ts
localStorage 키: `arcana_instructors`
- getPublicInstructors(): status!='private' 필터링
- saveInstructor/deleteInstructor: CRUD
- Instructor 타입: phone, instagram, kakao(오픈채팅URL), consultOnline/Offline, offlineAddress, services

## useSiteSettings.ts
localStorage 키: `arcana_site_settings`
- 기본 정보: copyright, businessInfo, brandDescription
- SEO: seoTitle, seoDescription, seoKeywords, ogImage
- 정책: privacy, terms, refund, copyright (마크다운, 전문 포함)
