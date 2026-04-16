import type { Course } from './types';

// ── 기본 강의 데이터 ──────────────────────────────────────────
export const COURSES: Course[] = [
  {
    id: 'tarot-foundations',
    title: '타로 기초 완성',
    subtitle: '78장 카드를 완전히 내 것으로',
    description: '타로 덱의 구조, 상징, 기초 리딩 기법을 단계별로 배우는 완전 입문 과정입니다.',
    level: '입문',
    duration: '12시간',
    lessons: 24,
    price: 89000,
    originalPrice: 149000,
    pricingTiers: [
      { days: 30, price: 89000, originalPrice: 149000 },
      { days: 90, price: 129000, originalPrice: 209000 },
      { days: 9999, price: 199000, originalPrice: 299000 },
    ],
    emoji: '🌙',
    instructor: '아리아 첸',
    instructorAvatar: '🔮',
    instructorBio: '10년 경력의 전문 타로 리더. 개인 세션 4,000건 이상.',
    rating: 4.9,
    ratingCount: 342,
    students: 1240,
    badge: '베스트셀러',
    whatYouLearn: [
      '메이저 아르카나 22장 완벽 해석',
      '마이너 아르카나 4수트 심층 이해',
      '타로 카드의 역방향 의미',
      '기초 스프레드 3가지 실습',
      '직관과 상징의 결합 방법',
      '나만의 리딩 스타일 구축',
    ],
    curriculum: [
      {
        section: '타로의 세계로',
        items: [
          { id: 'tf-1', title: '타로란 무엇인가?', duration: '12:30', vimeo: '76979871', status: 'free' },
          { id: 'tf-2', title: '덱 구조와 역사', duration: '18:45', vimeo: '76979871', status: 'free' },
          { id: 'tf-3', title: '직관 개발의 시작', duration: '22:10', vimeo: '76979871', status: 'locked' },
        ],
      },
      {
        section: '메이저 아르카나',
        items: [
          { id: 'tf-4', title: '광대 - 바보의 여정', duration: '25:00', vimeo: '76979871', status: 'locked' },
          { id: 'tf-5', title: '마법사와 여사제', duration: '28:15', vimeo: '76979871', status: 'locked' },
          { id: 'tf-6', title: '여왕과 황제', duration: '24:30', vimeo: '76979871', status: 'locked' },
        ],
      },
    ],
    attachments: [
      { name: '타로 카드 의미 정리 시트', ext: 'pdf' },
      { name: '연습용 스프레드 템플릿', ext: 'pdf' },
    ],
    pauseConfig: { maxPauses: 2, maxDays: 30 },
  },
  {
    id: 'celtic-cross',
    title: '셀틱 크로스 마스터',
    subtitle: '가장 강력한 스프레드를 완성하다',
    description: '프로 리더들이 가장 많이 사용하는 셀틱 크로스 스프레드를 완벽하게 마스터합니다.',
    level: '중급',
    duration: '8시간',
    lessons: 16,
    price: 129000,
    originalPrice: 199000,
    pricingTiers: [
      { days: 30, price: 129000, originalPrice: 199000 },
      { days: 90, price: 179000, originalPrice: 269000 },
      { days: 9999, price: 249000, originalPrice: 349000 },
    ],
    emoji: '✨',
    instructor: '이은서',
    instructorAvatar: '⭐',
    instructorBio: '국제 타로 협회 인증 마스터 리더.',
    rating: 4.8,
    ratingCount: 218,
    students: 890,
    badge: '인기',
    whatYouLearn: [
      '셀틱 크로스 10장 배치법',
      '각 위치의 상세 의미',
      '카드 간 상호작용 읽기',
      '실전 리딩 케이스 10건',
    ],
    curriculum: [
      {
        section: '셀틱 크로스 기초',
        items: [
          { id: 'cc-1', title: '스프레드의 역사', duration: '15:00', vimeo: '76979871', status: 'free' },
          { id: 'cc-2', title: '10장 배치 실습', duration: '20:00', vimeo: '76979871', status: 'locked' },
        ],
      },
    ],
    pauseConfig: { maxPauses: 1, maxDays: 14 },
  },
  {
    id: 'tarot-business',
    title: '타로 비즈니스 과정',
    subtitle: '타로 리딩을 직업으로',
    description: '프로 타로 리더로서 독립하기 위한 비즈니스 전략과 실전 노하우를 배웁니다.',
    level: '고급',
    duration: '10시간',
    lessons: 20,
    price: 199000,
    originalPrice: 299000,
    pricingTiers: [
      { days: 60, price: 199000, originalPrice: 299000 },
      { days: 180, price: 279000, originalPrice: 399000 },
      { days: 9999, price: 349000, originalPrice: 499000 },
    ],
    emoji: '💎',
    instructor: '박민지',
    instructorAvatar: '💫',
    instructorBio: '타로 비즈니스 컨설턴트, 월 수입 1000만원 달성 코치.',
    rating: 4.7,
    ratingCount: 156,
    students: 560,
    badge: '자격증',
    whatYouLearn: [
      '프로 리더 포지셔닝',
      '온라인 세션 운영 노하우',
      '고객 관리 및 마케팅',
      '수료증 발급',
    ],
    curriculum: [
      {
        section: '프로 리더의 길',
        items: [
          { id: 'tb-1', title: '프로 리더란', duration: '18:00', vimeo: '76979871', status: 'free' },
          { id: 'tb-2', title: '첫 고객 만들기', duration: '24:00', vimeo: '76979871', status: 'locked' },
        ],
      },
    ],
    pauseConfig: { maxPauses: 3, maxDays: 30 },
  },
];

export const TESTIMONIALS = [
  { quote: '타로를 배우면서 제 직관이 이렇게 성장할 줄 몰랐어요.', name: '이하은', role: '타로 입문 수강생', avatar: '🔮' },
  { quote: '강의 퀄리티가 정말 높고, 실습이 많아서 좋았습니다.', name: '박서준', role: '셀틱 크로스 수강생', avatar: '🌟' },
  { quote: '타로 힐링 과정은 제가 받은 강의 중 가장 특별했어요.', name: '최유리', role: '타로 힐링 수료생', avatar: '🦋' },
];
