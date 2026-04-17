# utils

## storage.ts — Supabase 비동기 CRUD
모든 반환값은 camelCase 매핑됨.

### 문의
- getMyInquiries(userId) / getInquiries() / addInquiry() / editInquiry() / answerInquiry()

### 사용자/수강 (관리자용)
- getAllUsers(): profiles + enrollments JOIN (약관동의/다운로드/담당강사 포함)
- getAllEnrollmentsAdmin(): enrollments + profiles JOIN
- cancelEnrollment(userId, courseId)
- updateEnrollmentAdmin(userId, courseId, { expiryDate, paused, pauseCount, remainingDays })

### 강사 (Supabase 동기화)
- getInstructorsRemote() / saveInstructorRemote(inst) / deleteInstructorRemote(id)

### 자격증 강사 진도 페이지
- createProgressPage({userId, courseId, instructorId, checklist}) → 토큰 포함 행 생성
- getProgressPage(id) / getProgressPageByEnrollment(userId, courseId)
- updateProgressPage(id, { checklist?, notes?, completedAt?, expiresAt? })

### 자격증 수강 동의서
- uploadSignatureImage(userId, courseId, dataUrl) → PNG 업로드 + public URL 반환
- saveCertificateAgreement({ userId, courseId, signerName/Birthdate/Phone, signatureUrl, agreementVersion, agreementSnapshot })
- getCertificateAgreementByEnrollment(userId, courseId) → CertificateAgreementRecord

## alimtalk.ts — 서버리스 함수 프록시 헬퍼
- sendInstructorAlimtalk({phone, instructorName, studentName, courseName, coursePeriod, token})
- `/api/send-alimtalk` POST 호출. 실패해도 throw 하지 않음 (결제 플로우 보호)
- 반환: `{ ok: boolean, reason?, message? }`

## format.ts
- formatPrice(n): ₩ 포맷
- discountRate(orig, price): 할인율%
- formatDays/formatDaysShort: 9999일 이상 = 무제한
- maskName(name): 한글 1자+**, 영문 2자+**
- calcTotalDuration(curriculum): MM:SS 합산 → "N시간 M분"
- **getLevelColor(level)**: 레벨별 컬러 매핑 — 입문(청록)/중급(하늘)/고급(오렌지)/자격증(자주)
- calcRefund(course, enrollment, totalLessons): 환불 정책 계산
  - 인터넷강의: 시작전 전액 / 7일내2강이하 90% / 기간1/2이하 수강분공제 / 1/2초과 불가
  - 자격증: 시작전 전액 / 1/3전 2/3 / 1/2전 1/2 / 1/2후 불가
  - **위약금 10% 별도** (refundAmount는 위약금 이미 차감된 최종 환불액)
  - UI 표시: 결제금액 → 환불 기준 금액 → 위약금 → 환불 예상 (MyPage)
