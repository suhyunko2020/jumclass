# data

## types.ts — 전체 인터페이스
Course, PricingTier, LessonItem, CurriculumSection, Attachment,
Review(+source:'user'|'admin'), Enrollment(+completedLessons,paused,pauseCount),
User, Inquiry(+metadata.courseId)

## courses.ts — 정적 데이터
COURSES 배열 (3개 기본 강의), TESTIMONIALS 배열
직접 참조 금지 → useCourses().getCourse() 사용 (override/custom 병합)
