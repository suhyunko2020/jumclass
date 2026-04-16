# data

## types.ts — 전체 인터페이스
Course, PricingTier, LessonItem(+attachments), LessonAttachment(url기반), CurriculumSection, Attachment,
Review(+source:'user'|'admin'), Enrollment(+completedLessons,paused,pauseCount),
User, Inquiry(+metadata.courseId),
Instructor(+phone,consultOnline/Offline,offlineAddress), InstructorService(+mode:'online'|'offline'|'both')

## courses.ts — 정적 데이터
COURSES 배열 (비어있음 — 관리자에서 등록), TESTIMONIALS 배열 (비어있음)
직접 참조 금지 → useCourses().getCourse() 사용 (override/custom 병합)
강의 레벨: 입문, 중급, 고급, 자격증
