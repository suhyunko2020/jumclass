# hooks

## useAuth.tsx (AuthContext + AuthProvider)
Supabase Auth 기반. `AppUser: { uid, name, email, avatar, createdAt, enrollments }`
- login/signup → `Promise<string|null>` (null=성공)
- `loading`: 세션 복구 중 상태. 보호 페이지에서 깜빡임 방지용 (사용 필수)
- **enroll(courseId, days?, policyAgreedKeys?, assignedInstructorId?)**: 약관 동의 키와 담당 강사 ID를 함께 저장
- completeLesson, pauseCourse, resumeCourse, enrollManual
- **logAttachmentDownload(courseId, lessonId, attachmentName)**: 교재 다운로드 로그 + 자동 수강 완료 처리
- isEnrolled: 만료일 체크, paused도 true 반환
- syncFromSupabase() → 앱 시작 시 localStorage 캐시 갱신 (강의/리뷰/강사)

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
- syncFromSupabase(): Supabase → localStorage 동기화 (강의/리뷰 + **강사**)

## useInstructors.ts
**Supabase 동기화됨** (`instructors` 테이블, id+data jsonb).
localStorage 캐시 키: `arcana_instructors`, 순서: `arcana_instructor_order`
- getPublicInstructors(): status!='private' 필터링 + 순서 적용
- saveInstructor/deleteInstructor: localStorage + Supabase 동시 쓰기
- saveInstructorOrder(ids): 드래그앤드롭 순서 (localStorage만)
- Instructor: phone, instagram, kakao(오픈채팅URL), consultOnline/Offline, offlineAddress, services, courseIds

## useSiteSettings.ts
localStorage 키: `arcana_site_settings`
- 기본 정보: copyright, businessInfo, brandDescription
- SEO: seoTitle, seoDescription, seoKeywords, ogImage
- 정책: privacy, terms, refund, copyright (마크다운, 전문 포함)
