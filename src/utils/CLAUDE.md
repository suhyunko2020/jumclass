# utils

## storage.ts — Supabase 비동기 CRUD
모든 반환값은 camelCase 매핑됨.
- getMyInquiries(userId) / getInquiries() / addInquiry() / editInquiry() / answerInquiry()
- getAllUsers(): profiles + enrollments JOIN
- getAllEnrollmentsAdmin(): enrollments + profiles JOIN
- cancelEnrollment(userId, courseId): 삭제
- updateEnrollmentAdmin(userId, courseId, { expiryDate, paused, pauseCount, remainingDays })

## format.ts
- formatPrice(n): ₩ 포맷
- discountRate(orig, price): 할인율%
- formatDays/formatDaysShort: 9999일 이상 = 무제한
- maskName(name): 한글 1자+**, 영문 2자+**
- calcTotalDuration(curriculum): 커리큘럼 MM:SS 합산 → "N시간 M분" (course.duration 대신 사용)
- calcRefund(course, enrollment, totalLessons): 인터넷강의/자격증 환불 정책 계산
  - 인터넷강의: 시작전 전액 / 7일내2강이하 90% / 기간1/2이하 수강분공제 / 1/2초과 불가
  - 자격증: 시작전 전액 / 1/3전 2/3 / 1/2전 1/2 / 1/2후 불가
  - 위약금 10% 별도
