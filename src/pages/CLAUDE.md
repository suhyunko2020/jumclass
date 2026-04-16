# pages

## 라우팅
| 경로 | 파일 | 설명 |
|------|------|------|
| / | HomePage | 히어로+강의+특징+후기+CTA+문의+푸터 |
| /courses | CoursesPage | 강의 목록, 레벨 필터, getPublicCourses() |
| /course/:id | CourseDetailPage | 커리큘럼, 구매카드, 리뷰(maskName) |
| /lesson | LessonPage | Vimeo 플레이어, 사이드바, 완료시 리뷰 팝업 |
| /checkout | CheckoutPage | 결제 — 강의 또는 강사 서비스 (?instructor=&service=) |
| /payment-success | PaymentSuccessPage | 결제확인+수강등록 |
| /classroom | ClassroomPage | 내 강의실, 진도, 휴강, 리뷰작성 |
| /my | MyPage | 결제내역, 환불요청(정책별 금액계산), 1:1문의 |
| /instructors | InstructorsPage | 강사 목록 (프로필, 전문분야, 상담 방식) |
| /instructor/:id | InstructorDetailPage | 강사 상세+서비스+결제+연락처+지도 |
| /policy/:type | PolicyPage | 정책 (privacy/terms/refund/copyright) |
| /admin2026 | AdminPage | 관리자 전용 |

## AdminPage 섹션
overview, courses, instructors, students, payments, inquiries, reviews, settings

## 환불 처리 흐름
수강생 MyPage → 진도/정책 기반 금액 계산 모달 → 문의 접수
→ 관리자 문의에서 답변+환불처리 (enrollment 삭제 안 함)
