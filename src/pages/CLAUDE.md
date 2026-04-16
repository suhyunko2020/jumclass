# pages

## 라우팅
| 경로 | 파일 | 설명 |
|------|------|------|
| / | HomePage | 히어로(3D캔버스)+강의+특징+후기+CTA+문의+푸터 |
| /courses | CoursesPage | 강의 목록, 레벨+자격증 필터, getPublicCourses() |
| /course/:id | CourseDetailPage | 커리큘럼(SVG화살표), 구매카드(자격증분기), 리뷰(maskName) |
| /lesson | LessonPage | Vimeo 플레이어, 사이드바, 첨부파일 다운로드, 완료시 리뷰 |
| /checkout | CheckoutPage | 결제 — 강의 또는 강사 서비스 (?instructor=&service=) |
| /payment-success | PaymentSuccessPage | 결제확인+수강등록 |
| /classroom | ClassroomPage | 내 강의실, 진도, 휴강, 리뷰작성, 수강종료(리스트형) |
| /my | MyPage | 결제내역, 환불요청(정책별 금액계산+진도표시), 1:1문의 |
| /instructors | InstructorsPage | 강사 목록 (1:1사진, 전문분야, 상담 방식) |
| /instructor/:id | InstructorDetailPage | 강사 상세+Phone/Instagram/KakaoTalk+서비스(대면/비대면)+지도 |
| /policy/:type | PolicyPage | 정책 (privacy/terms/refund/copyright), 마크다운 렌더링 |
| /admin2026 | AdminPage | 관리자 전용 |

## AdminPage 섹션
overview, courses(드래그정렬/복사), instructors(복사/서비스순서), students(검색/수강정보수정), payments, inquiries, reviews(수동작성), settings(SEO/정책/푸터)

## 강의 레벨
입문, 중급, 고급, 자격증 — 자격증은 포함내용이 다름 (1:1맞춤/대면비대면/수료증)

## 첨부파일
Supabase Storage `lesson-attachments` 버킷. 10MB 제한. 메타정보만 localStorage 저장.

## 환불 처리 흐름
수강생 MyPage → 진도/정책 기반 금액 계산 모달 → 문의 접수
→ 관리자 문의에서 답변+환불처리 (enrollment 삭제 안 함)
