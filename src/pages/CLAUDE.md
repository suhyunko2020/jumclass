# pages

## 라우팅
| 경로 | 파일 | 설명 |
|------|------|------|
| / | HomePage | 히어로(캔버스별자리)+강의+특징+후기+CTA+문의+푸터 |
| /courses | CoursesPage | 강의 목록, 레벨 필터, getPublicCourses() 사용 |
| /course/:id | CourseDetailPage | 커리큘럼(enrolled→▶/미리보기숨김), 구매카드, 리뷰(maskName) |
| /lesson | LessonPage | Vimeo 플레이어, 사이드바, 완료시 리뷰 팝업 |
| /checkout | CheckoutPage | 결제(테스트모드/Toss), tier 파라미터 |
| /payment-success | PaymentSuccessPage | 결제확인+수강등록 |
| /classroom | ClassroomPage | 내 강의실, 진도, 휴강, 리뷰작성(미작성시 활성/작성시 비활성) |
| /my | MyPage | 결제내역, 환불요청(정책별 금액계산 모달), 1:1문의 |
| /admin2026 | AdminPage | 관리자 전용(아래 참조) |

## AdminPage 섹션
- overview: 대시보드 통계
- courses: 강의 CRUD, 커리큘럼 편집, 수강생 등록, 비공개 처리
- students: 수강생 목록(검색), 수강등록, 수강정보 수정(기간/휴강/진도)
- payments: 결제 내역
- inquiries: 문의 답변, 환불 처리(내역 유지)
- reviews: 리뷰 관리(삭제), 수동 작성(source=admin), 수강생/관리자 라벨

## 환불 처리 흐름
수강생 MyPage에서 환불 요청 → 진도/정책 기반 금액 계산 모달 → 문의로 접수
→ 관리자 문의에서 답변+환불처리 (enrollment 삭제 안 함, 내역 유지)
