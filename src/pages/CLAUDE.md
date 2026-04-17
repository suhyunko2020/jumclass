# pages

## 라우팅
| 경로 | 파일 | 설명 |
|------|------|------|
| / | HomePage | 히어로(3D캔버스)+강의+특징+후기+CTA+문의 |
| /courses | CoursesPage | 강의 목록, 레벨+자격증 필터, getPublicCourses() |
| /course/:id | CourseDetailPage | 커리큘럼, 강사 그리드(자격증), 강사 선택 셀렉트(자격증), 리뷰 |
| /lesson | LessonPage | Vimeo 플레이어, 사이드바, 첨부파일(동의모달+자동완료) |
| /checkout | CheckoutPage | 결제 — 약관 4개 동의 + 자격증 수강 동의서 서명 |
| /payment-success | PaymentSuccessPage | 자격증 분기: 강사 프로필 카드 + "곧 연락드립니다" |
| /classroom | ClassroomPage | 자격증은 "진도 확인"/"약관 보기", 일반은 "계속 수강하기"/"휴강신청" |
| /my | MyPage | 결제내역(약관동의 표시), 환불요청(정책별 금액계산), 1:1문의 |
| /instructors | InstructorsPage | 강사 목록 |
| /instructor/:id | InstructorDetailPage | 담당 강의(자격증 제외) + 연락처 + 서비스 |
| /policy/:type | PolicyPage | 정책 (privacy/terms/refund/copyright) |
| **/i/:token** | **InstructorProgressPage** | **자격증 강사 진도 관리 페이지 (모바일 최적화)** |
| /admin2026 | AdminPage | 관리자 전용 |

App.tsx에서 `/admin2026`와 `/lesson`, `/i/*`는 Navbar/Footer 숨김. ScrollToTop 적용.

## AdminPage 섹션
overview, courses(드래그정렬/복사/레벨컬러), instructors(드래그정렬), students(검색/수강정보수정), payments(담당강사/약관동의), inquiries(검색/펼치기/환불진도), reviews(수동작성), settings(SEO/정책/푸터)

## 강의 레벨 — 자격증 분기 (핵심)
`course.level === '자격증'`일 때 UI/UX 크게 달라짐. 루트 CLAUDE.md 참조.
분기 지점 정리: 상세페이지, 결제, 결제완료, 수강실, 관리자 강의/수강생 모달

## 환불 처리 흐름
수강생 MyPage → 진도/정책 기반 금액 계산 모달(`calcRefund`) → 문의 접수
→ 관리자 문의에서 답변+환불처리 (enrollment 삭제 안 함)

## 자격증 진도 관리 흐름
1. 자격증 결제 시 강사 선택 → CheckoutPage에서 `instructor_progress_pages` row 자동 생성 (토큰 포함)
2. `/api/send-alimtalk` 호출로 강사에게 알림톡 발송 (심사/환경변수 완료 후 실제 동작)
3. 강사가 `/i/:token` 접속 → 체크리스트 업데이트 + 메모 작성
4. 모든 항목 체크 → `completed_at` + `expires_at = completed_at + 7일` 자동 세팅
5. 수강생이 Classroom에서 "진도 확인" 클릭 → 읽기 전용 체크리스트 (메모 숨김) + "약관 보기"로 서명본 확인
6. 관리자가 수강 정보 모달에서 서명 + 진도 + 강사 메모 + 알림톡 재발송 가능

## 첨부파일 다운로드 흐름 (교재 환불 방지)
Lesson 첨부 항목 클릭 → 동의 모달 (저작권 안내 + 자동 완료 처리 안내)
→ 동의 시 `logAttachmentDownload()` → Supabase Storage 다운 + completedLessons에 추가 + progress 재계산
→ 재다운로드 시 모달 스킵, "✓ 동의함" 뱃지 표시

## 결제 시 약관 동의
약관 4개(privacy/terms/refund/copyright) 모두 체크 + 자격증이면 서명까지 완료해야 결제 버튼 활성화
동의 시각과 동의한 정책 키 배열이 `enrollments.policy_agreed_at/keys`에 저장됨
