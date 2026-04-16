import { useCallback } from 'react'

export interface SiteSettings {
  copyright: string
  businessInfo: string
  brandDescription: string
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  ogImage: string
  policies: {
    privacy: string
    terms: string
    refund: string
  }
}

const STORAGE_KEY = 'arcana_site_settings'

const DEFAULTS: SiteSettings = {
  copyright: '© 2026 JUMCLASS. All rights reserved.',
  businessInfo: '사업자등록번호: 000-00-00000',
  brandDescription: '타로를 제대로 배우고 싶은 분들을 위한 프리미엄 인터넷 강의 플랫폼. 전문 강사진과 체계적인 커리큘럼으로 진짜 실력을 키우세요.',
  seoTitle: 'JUMCLASS — 국내 1위 타로 강의 플랫폼',
  seoDescription: '전문 강사의 HD 영상 강의로 입문부터 공인 자격증까지. 체계적인 커리큘럼으로 진짜 타로 실력을 키우세요.',
  seoKeywords: '타로, 타로 강의, 타로 배우기, 타로 자격증, 타로 리딩, 온라인 강의',
  ogImage: '',
  policies: {
    privacy: '# 개인정보처리방침\n\nJUMCLASS(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」을 준수합니다.\n\n## 1. 수집하는 개인정보\n- 이름, 이메일 주소\n- 결제 정보 (결제 대행사를 통해 처리)\n\n## 2. 개인정보의 이용 목적\n- 서비스 제공 및 수강 관리\n- 고객 문의 응대\n- 결제 및 환불 처리\n\n## 3. 개인정보 보유 기간\n- 회원 탈퇴 시까지 보유\n- 법령에 따른 보존 의무가 있는 경우 해당 기간까지\n\n## 4. 문의\n- 이메일: support@primemuse.com',
    terms: '# 이용약관\n\n## 제1조 (목적)\n이 약관은 JUMCLASS(이하 "회사")가 제공하는 온라인 교육 서비스의 이용 조건 및 절차를 규정합니다.\n\n## 제2조 (서비스 내용)\n- 온라인 영상 강의 제공\n- 학습 자료 다운로드\n- 강사 상담 서비스\n\n## 제3조 (수강 기간)\n- 결제 시 선택한 수강 기간 동안 이용 가능\n- 수강 기간 만료 후 재수강 필요\n\n## 제4조 (결제 및 환불)\n- 환불 정책은 별도 환불 정책 페이지를 참고하세요.\n\n## 제5조 (금지 행위)\n- 강의 콘텐츠의 무단 복제, 배포, 공유\n- 계정의 타인 공유\n\n## 제6조 (면책)\n- 이용자의 귀책사유로 인한 손해에 대해 회사는 책임지지 않습니다.',
    refund: '# 환불 정책\n\n## 인터넷 강의\n\n| 환불 사유 발생 시점 | 환불 기준 |\n|---|---|\n| 수강 시작 전 | 전액 환불 (계약대금의 10% 위약금 별도) |\n| 수강 시작 후 7일 이내 (2강 이하 수강 시) | 결제 금액의 90% 환불 (계약대금의 10% 위약금 별도) |\n| 수강 시작 후 7일 이후 (전체 강의 기간의 1/2 이하) | 수강한 강의 공제 후 환불 (계약대금의 10% 위약금 별도) |\n| 수강 기간의 1/2 초과 | 환불 불가 |\n\n## 자격증 과정\n\n| 환불 사유 발생 시점 | 환불 기준 |\n|---|---|\n| 강습 시작 전 | 전액 환불 (계약대금의 10% 위약금 별도) |\n| 총 강습 기간의 1/3 경과 전 | 수강료의 2/3 해당액 환불 (계약대금의 10% 위약금 별도) |\n| 총 강습 기간의 1/2 경과 전 | 수강료의 1/2 해당액 환불 (계약대금의 10% 위약금 별도) |\n| 총 강습 기간의 1/2 경과 후 | 환불 불가 |\n\n## 기타\n- 환불 요청은 마이페이지 > 결제/환불 내역에서 가능합니다.\n- 환불 처리는 영업일 기준 3~5일 소요됩니다.\n- 문의: support@primemuse.com',
  },
}

function getCached(): SiteSettings {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? { ...DEFAULTS, ...JSON.parse(v) } : DEFAULTS
  } catch { return DEFAULTS }
}

export function useSiteSettings() {
  const get = useCallback((): SiteSettings => getCached(), [])

  const save = useCallback((settings: Partial<SiteSettings>) => {
    const current = getCached()
    const merged = { ...current, ...settings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  }, [])

  return { get, save }
}
