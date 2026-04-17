# data

## types.ts — 전체 인터페이스
- **Course** (+ `includedCourseIds` 자격증 기본 제공 강의)
- PricingTier, LessonItem(+attachments), LessonAttachment(url 기반), CurriculumSection, Attachment
- Review(+source:'user'|'admin')
- **Enrollment** — completedLessons, paused, pauseCount, **policyAgreedAt, policyAgreedKeys, attachmentDownloads[], assignedInstructorId**
- AttachmentDownloadLog: `{ lessonId, attachmentName, downloadedAt }`
- User, Inquiry(+metadata.courseId)
- Instructor(phone, consultOnline/Offline, offlineAddress, services, courseIds)
- InstructorService(+mode:'online'|'offline'|'both')
- **ProgressChecklistItem / InstructorProgressPage** — 자격증 강사 진도 페이지

## courses.ts — 정적 데이터
COURSES 배열 (비어있음 — 관리자에서 등록), TESTIMONIALS 배열 (비어있음)
직접 참조 금지 → useCourses().getCourse() 사용 (override/custom 병합)
강의 레벨: 입문, 중급, 고급, **자격증** — 자격증은 분기 많음 (루트 CLAUDE.md 참조)

## certificateAgreement.ts — 자격증 수강 동의서 약관
구조화된 TS 상수. version + chapters(articles(paragraphs[])) + closing
서명 시 `agreement_snapshot` JSONB로 DB에 박제됨 → 향후 약관 변경되어도 당시 본문 증명 가능
현재 버전: `2026-04-01`
