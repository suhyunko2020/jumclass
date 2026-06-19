// 관리자 샘플 리뷰 생성용 풀과 헬퍼.
// 풀이 충분히 커야 중복 없이 N개 생성 가능.
// 닉네임은 모두 한글 실명 형태로 생성하고, 사이트에는 성만 노출(maskName)된다.
// 아바타는 실제 회원과 동일하게 이름 첫 글자(성)를 사용한다.

const koreanLastNames = [
  '김','이','박','정','최','조','강','윤','장','서',
  '오','한','임','유','황','신','권','안','송','홍',
  '전','문','손','배','백','허','노','심','구','곽',
  '하','진','우','맹','현',
]
const koreanFirstNames = [
  '수현','민지','지영','현우','진아','서연','예진','도윤','준호','하윤',
  '나경','주원','소영','예나','지호','연우','서윤','민서','하늘','시우',
  '다은','서진','채원','윤아','승민','지안','유진','태원','지수','은우',
  '지민','정원','수빈','다현','효주','성훈','지원','보경','은서','혜린',
]

// 리뷰 풀 — 길이(짧음/중간/긺)와 톤을 다양하게. 같은 텍스트가 두 번 안 나오도록 추적.
const reviewPool: { text: string; level?: '입문' | '중급' | '고급' | '자격증' }[] = [
  // ── 공통 (강사·영상·플랫폼) ──
  { text: '깔끔하고 좋아요.' },
  { text: '강추합니다 ㅎㅎ' },
  { text: '후회 없는 선택이었어요.' },
  { text: '잘 듣고 있습니다.' },
  { text: '생각보다 훨씬 좋네요.' },
  { text: '믿고 보는 강의예요.' },
  { text: '재밌게 잘 봤어요!' },
  { text: '돈이 아깝지 않아요.' },
  { text: '기대 이상이었습니다.' },
  { text: '설명에 군더더기가 없어요.' },
  { text: '강사님 목소리가 차분해서 집중이 잘 돼요.' },
  { text: '책으로 볼 땐 막막했는데 영상으로 보니 한 번에 이해됐어요.' },
  { text: '짧게 끊겨 있어서 출퇴근길에 보기 딱 좋아요.' },
  { text: '결제하고 바로 볼 수 있어서 편했습니다.' },
  { text: '복습용으로 자꾸 돌려보게 되네요.' },
  { text: '영상 퀄리티가 좋아서 살짝 놀랐어요.' },
  { text: '필기 자료가 있어서 따로 정리할 필요가 없네요.' },
  { text: '음질이 깨끗해서 이어폰으로 들어도 편해요.' },
  { text: '천천히 따라 하기 좋게 구성되어 있어요.' },
  { text: '친한 선배한테 배우는 느낌이라 부담이 없어요.' },
  { text: '몇 번 돌려보니 카드 보는 눈이 확실히 달라져요.' },
  { text: '다음 강의도 결제하려고 마음먹었습니다.' },
  { text: '큰 기대 없이 시작했는데 어느새 메모장이 가득 찼어요. 두고두고 볼 자료가 생긴 느낌입니다.' },
  { text: '여기저기 둘러보다 결제했는데, 정성 들인 게 화면 너머로 느껴져서 만족스러웠어요.' },
  { text: '직장 다니면서 학원은 시간이 안 맞아 포기했었는데, 내 페이스대로 들을 수 있어서 너무 좋네요.' },
  { text: '강사님이 본인 상담 경험을 곁들여 설명해주시는 부분이 특히 와닿았어요. 이론만 읊는 강의랑은 확실히 다릅니다.' },
  { text: '평일 저녁마다 한 강씩 듣는 게 소소한 낙이 됐어요. 부담 없이 꾸준히 갈 수 있을 것 같습니다.' },

  // ── 입문 ──
  { text: '타로 진짜 처음인데 따라갈 만했어요.', level: '입문' },
  { text: '왕초보도 이해돼요. 추천!', level: '입문' },
  { text: '카드가 이제 안 무서워요 ㅎㅎ', level: '입문' },
  { text: '용어가 어려울까 걱정했는데 풀어서 설명해주셔서 편했어요.', level: '입문' },
  { text: '뭐부터 봐야 할지 막막했는데 길잡이가 돼줬어요.', level: '입문' },
  { text: '기초부터 차근차근 짚어주셔서 감사했습니다.', level: '입문' },
  { text: '한 챕터 끝낼 때마다 뿌듯하네요.', level: '입문' },
  { text: '78장이 처음엔 막막했는데 이제 한 장씩 친근해져요.', level: '입문' },
  { text: '책만 사서 끄적이다 답답해서 결제했는데 잘한 선택이었어요.', level: '입문' },
  { text: '입문이라 가볍게 봤는데 생각보다 깊이가 있어서 좋았어요.', level: '입문' },
  { text: '메이저 카드만 봐도 한참인데 흐름을 잡아주셔서 수월했어요.', level: '입문' },
  { text: '아무것도 모르고 시작했지만 지금은 친구한테 봐줄 정도는 됐어요.', level: '입문' },

  // ── 중급 ──
  { text: '막혀 있던 부분이 뻥 뚫렸어요.', level: '중급' },
  { text: '실전 팁이 많아서 좋네요.', level: '중급' },
  { text: '셀프 리딩만 하다 처음으로 남한테 봐줬어요. 자신감이 붙네요.', level: '중급' },
  { text: '카드 조합 해석이 어려웠는데 패턴이 보이기 시작했어요.', level: '중급' },
  { text: '같은 카드도 상황에 따라 다르게 읽는 법을 배웠습니다.', level: '중급' },
  { text: '리딩 사례가 풍부해서 실전 감이 살아요.', level: '중급' },
  { text: '기초만 알고 멈춰 있던 분들께 강추해요. 한 단계 올라섭니다.', level: '중급' },
  { text: '강사님 노하우를 듣고 나서야 감을 잡았어요.', level: '중급' },
  { text: '중급 깊이가 딱 적당했어요. 만족합니다.', level: '중급' },

  // ── 고급 ──
  { text: '확실히 깊이가 다르네요.', level: '고급' },
  { text: '상담에 바로 쓰고 있어요.', level: '고급' },
  { text: '책에도 잘 안 나오는 응용법이 핵심이에요.', level: '고급' },
  { text: '오래 막혀 있던 의문들이 한 번에 풀렸습니다.', level: '고급' },
  { text: '강사님 임상 경험이 그대로 녹아 있어 신뢰가 가요.', level: '고급' },
  { text: '고급 스프레드 파트에서 시야가 확 트였어요.', level: '고급' },
  { text: '심화로 갈수록 더 재밌어지는 게 신기합니다. 구성을 정말 잘 짜셨어요.', level: '고급' },
  { text: '해석 기법이 알차서 상담 일에 큰 도움이 됩니다.', level: '고급' },
  { text: '상담사로서의 마음가짐까지 짚어주셔서 인상 깊었어요.', level: '고급' },

  // ── 자격증 ──
  { text: '진도 관리가 꼼꼼해서 든든했어요.', level: '자격증' },
  { text: '1:1로 봐주시니 마음이 놓여요.', level: '자격증' },
  { text: '체크리스트 받으며 한 회차씩 끝낼 때 성취감이 큽니다.', level: '자격증' },
  { text: '혼자였으면 중간에 포기했을 텐데 챙겨주셔서 끝까지 했어요.', level: '자격증' },
  { text: '커리어 준비로 등록했는데 실무 파트가 특히 도움 됐어요.', level: '자격증' },
  { text: '결제하니 강사님 연락이 빨리 와서 놀랐어요. 정말 친절하셨습니다.', level: '자격증' },
  { text: '수료까지 체계가 잘 잡혀 있어서 따라가기만 하면 됐어요.', level: '자격증' },
  { text: '자격증만 따려고 했는데 내용이 알차서 제 공부도 됐네요.', level: '자격증' },
  { text: '윤리 파트가 부담스러울 줄 알았는데 오히려 가장 와닿았어요.', level: '자격증' },
  { text: '상담 사례를 많이 들려주셔서 실전에 강해진 느낌이에요.', level: '자격증' },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeKoreanName(): string {
  return pick(koreanLastNames) + pick(koreanFirstNames)
}

export function makeSampleName(): { name: string; avatar: string } {
  // 모두 한글 실명 형태. 아바타는 실제 회원과 동일하게 이름 첫 글자(성).
  const name = makeKoreanName()
  return { name, avatar: name.charAt(0) }
}

// 평점 분포: 5점 80%, 4점 20% (3점 이하 제외)
export function makeSampleRating(): number {
  return Math.random() < 0.8 ? 5 : 4
}

// 최근 N일 사이의 랜덤 ISO 날짜 — 시간/분/초까지 랜덤하게
export function makeRandomDate(daysBack = 180): string {
  const now = Date.now()
  const span = daysBack * 24 * 60 * 60 * 1000
  const offset = Math.floor(Math.random() * span)
  return new Date(now - offset).toISOString()
}

// 특정 레벨용 풀 + 공통 풀에서 사용 가능한 텍스트만 추출
function poolForLevel(level: string): string[] {
  const matching = reviewPool.filter(r => r.level === level).map(r => r.text)
  const common = reviewPool.filter(r => !r.level).map(r => r.text)
  return [...matching, ...common]
}

// 중복 없이 리뷰 텍스트 N개 뽑기. 풀이 모자라면 가능한 만큼만 반환.
// usedTexts는 이미 사용된 텍스트 Set (외부에서 누적 추적용)
export function pickUniqueText(level: string, usedTexts: Set<string>): string | null {
  const candidates = poolForLevel(level).filter(t => !usedTexts.has(t))
  if (candidates.length === 0) return null
  const picked = pick(candidates)
  usedTexts.add(picked)
  return picked
}

// 레벨 무관 전체 풀에서 중복 없이 텍스트 뽑기 (기존 리뷰 일괄 수정용)
export function pickUniqueAnyText(usedTexts: Set<string>): string | null {
  const all = reviewPool.map(r => r.text)
  const candidates = all.filter(t => !usedTexts.has(t))
  if (candidates.length === 0) return null
  const picked = pick(candidates)
  usedTexts.add(picked)
  return picked
}

// 풀 전체 크기 — 입력 가능한 최대 개수 검증용
export function getPoolSize(): number {
  return reviewPool.length
}
