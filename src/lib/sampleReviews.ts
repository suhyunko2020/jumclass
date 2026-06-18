// 관리자 샘플 리뷰 생성용 풀과 헬퍼.
// 풀이 충분히 커야 중복 없이 N개 생성 가능.

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
const englishNames = [
  'amy','alex','james','sophia','oliver','emma','noah','liam','ava','ethan',
  'isla','lucas','zoe','leo','mason','lily','jack','maya','eric','nina',
  'ryan','hannah','kevin','grace','daniel','chloe','henry','julia','peter','rose',
  'sean','wendy','tyler','vivian','dylan',
]
const avatars = [
  '🌙','✨','🌟','🔮','☯️','🌹','🕊️','🪄','🦋','🌻',
  '🌿','🍀','🌼','⭐','💫','🌈','🪐','🌸','🍃','🍂',
  '🪞','🪶','🍯','🫧','🌷',
]

// 리뷰 풀 — 100개 이상 다양한 톤/길이/어미.
// 같은 텍스트가 두 번 안 나오도록 generateSampleReviews에서 unique 추적.
const reviewPool: { text: string; level?: '입문' | '중급' | '고급' | '자격증' }[] = [
  // 공통 — 강사·영상 품질
  { text: '강사님 목소리도 차분하고 설명이 친절해서 끝까지 들었어요.' },
  { text: '한 번 듣고 다시 돌려봐도 새로 보이는 부분이 있어요. 알찹니다.' },
  { text: '솔직히 큰 기대 없이 시작했는데, 들으면서 메모를 엄청 했네요' },
  { text: '책으로만 봤을 땐 헷갈렸던 부분이 영상 보고 한 번에 정리됐어요!' },
  { text: '진짜 깔끔합니다. 군더더기 없어서 좋았어요.' },
  { text: '내용은 알찬데 좀 빠른 편이라 두 번 봤어요. 그래도 만족' },
  { text: '카드 한 장 한 장 그림을 짚어가면서 설명해주셔서 머리에 잘 남아요' },
  { text: '강의 듣고 친구한테 리딩해줬는데 반응 너무 좋았어요 ㅎㅎ' },
  { text: '음… 처음엔 반신반의했는데 듣고 나니까 추천하게 되네요.' },
  { text: '결제하고 살짝 걱정했는데 영상 퀄리티가 생각보다 훨씬 좋아서 놀랐습니다.' },
  { text: '평일 저녁마다 한 강의씩 듣고 있어요. 이 페이스로 갈 수 있을 것 같아요' },
  { text: '설명이 정말 따뜻해요. 듣는 동안 편안했습니다 :)' },
  { text: '복습용으로 자주 돌려보는 중입니다. 짧은 강의도 알찬 게 좋네요' },
  { text: '이 가격에 이 퀄리티면 진짜 가성비 미쳤다고 생각해요' },
  { text: '몇 번 반복해서 보니까 카드 보는 눈이 달라지는 게 느껴져요. 추천!' },
  { text: '강사님이 본인 경험을 곁들여서 설명해주시는 부분이 특히 좋았어요' },
  { text: '딱딱하지 않고 친한 친구한테 배우는 느낌이에요' },
  { text: '강사님 말투가 편안해서 잠 안 올 때 듣다가 진짜로 빠져들었어요' },
  { text: '주말 동안 몰아 들었는데 지루할 틈이 없네요' },
  { text: '집중력이 약한 편인데 영상 분량이 짧게 끊겨 있어서 좋아요' },
  { text: '결제 직후 바로 시청 가능한 점도 마음에 들었어요' },
  { text: '강의 자료가 따로 있어서 필기 부담이 줄어요' },
  { text: '음질이 깨끗해서 이어폰으로 들어도 피로감이 없네요' },
  { text: '피드백 주신 부분 반영해서 다음 리딩에 적용해봤어요. 감사합니다' },
  { text: '이런 강의 찾고 있었어요. 시간 가는 줄 모르고 봤습니다' },
  { text: '여러 플랫폼 둘러봤는데 여기가 제일 정성 들였다는 게 보여요' },
  { text: '꾸준히 듣다 보니 어느새 책 한 권을 다 본 느낌이에요' },
  { text: '오프라인 수업 못 가는 직장인한테 정말 적합한 형태입니다' },
  { text: '강의 들으면서 메모만 30장 넘었어요. 두고두고 볼 자료가 됐네요' },
  { text: '학원 다니다가 시간 안 맞아서 옮겼는데 더 잘 맞는 것 같아요' },

  // 입문
  { text: '타로 처음인데도 따라갈 수 있게 구성되어 있어서 좋았습니다.', level: '입문' },
  { text: '카드 의미를 외우려고만 했는데 흐름으로 이해하니까 훨씬 쉽네요', level: '입문' },
  { text: '입문 강의로 이만한 게 없는 것 같아요. 강사님 짱 ✨', level: '입문' },
  { text: '정말 기초부터 짚어주셔서 감사했어요. 카드가 이제 무섭지 않아요!', level: '입문' },
  { text: '아무것도 모르고 시작했는데 한 챕터 끝낼 때마다 뿌듯해요', level: '입문' },
  { text: '메이저 아르카나만 봐도 한참인데 차근차근 잡아주시네요', level: '입문' },
  { text: '책 사서 끄적이다가 답답해서 결제했는데 잘한 선택이었습니다', level: '입문' },
  { text: '카드 78장이 처음엔 무서웠는데 이제는 친근해요', level: '입문' },
  { text: '용어가 어려울 줄 알았는데 풀어 설명해주셔서 부담 없이 들어요', level: '입문' },
  { text: '왕초보인 저도 이해했으니 누구나 시작할 수 있을 것 같아요', level: '입문' },
  { text: '입문이라 가볍게 시작했는데 생각보다 깊이 있는 내용이라 좋았어요', level: '입문' },
  { text: '뭐부터 봐야 할지 모르던 저한테 길잡이 같은 강의예요', level: '입문' },
  { text: '카드 하나하나 친근하게 다가오기 시작했어요. 신기해요', level: '입문' },

  // 중급
  { text: '기초만 알고 막혀있던 부분이 풀렸어요. 스프레드 응용이 가능해졌습니다.', level: '중급' },
  { text: '실제 리딩에 적용할 만한 팁이 많아서 도움 됐어요', level: '중급' },
  { text: '리딩이 어려웠는데 강사님 노하우 듣고 감 잡았네요', level: '중급' },
  { text: '중급 강의를 찾고 있었는데 딱 맞는 깊이였어요. 만족', level: '중급' },
  { text: '셀프 리딩만 하다가 처음으로 남에게 봐줬습니다. 자신감이 붙었어요', level: '중급' },
  { text: '카드 조합 해석이 어려웠는데 패턴이 보이기 시작했어요', level: '중급' },
  { text: '기본기 확장하는 데 더할 나위 없는 강의입니다', level: '중급' },
  { text: '같은 카드도 상황에 따라 다르게 해석하는 법을 배웠어요', level: '중급' },
  { text: '리딩 케이스가 풍부해서 실전 감이 생겨요', level: '중급' },
  { text: '입문 후 막혔던 분들에게 강추합니다. 한 단계 도약이 가능해요', level: '중급' },

  // 고급
  { text: '심화 해석 기법이 정말 알찼습니다. 상담사 활동에 바로 적용 중이에요.', level: '고급' },
  { text: '깊이 있는 내용을 이렇게 풀어내기 쉽지 않은데 대단하다고 느꼈어요', level: '고급' },
  { text: '고급 스프레드 부분에서 머리 한 대 맞은 느낌이었습니다. 새로운 시각', level: '고급' },
  { text: '디테일이 살아있는 강의입니다. 진짜 감사해요 :)', level: '고급' },
  { text: '여러 강의를 들어봤는데 깊이가 다르네요. 추천합니다', level: '고급' },
  { text: '책에서도 잘 안 나오는 응용 해석법이 핵심이에요', level: '고급' },
  { text: '오랫동안 막혀있던 의문들이 한 번에 풀렸어요', level: '고급' },
  { text: '강사님의 임상 경험이 그대로 녹아있어서 신뢰가 갑니다', level: '고급' },
  { text: '심화로 갈수록 더 재밌어지는 게 신기해요. 강의 구성 참 잘 짜셨네요', level: '고급' },
  { text: '상담사 자체의 마음가짐까지 짚어주셔서 인상 깊었습니다', level: '고급' },

  // 자격증
  { text: '자격증 과정인 만큼 윤리·실무까지 다뤄줘서 좋았어요. 강사님 진도 관리도 꼼꼼하셨습니다.', level: '자격증' },
  { text: '체크리스트 받아가면서 한 회차씩 끝낼 때 성취감이 있어요', level: '자격증' },
  { text: '담당 강사님이 1:1로 봐주시니까 든든합니다. 모르는 거 바로바로 물어봤네요', level: '자격증' },
  { text: '커리어 시작하려고 등록했는데 비즈니스 파트가 특히 도움 됐어요', level: '자격증' },
  { text: '결제하고 강사님 알림톡 빨리 와서 놀랐고, 친절하셨어요. 추천합니다', level: '자격증' },
  { text: '진도 챙겨주시는 시스템이 좋아요. 혼자였으면 중간에 포기했을 듯', level: '자격증' },
  { text: '수료 동의서 작성부터 진도 관리까지 체계적입니다. 신뢰가 가요', level: '자격증' },
  { text: '자격증만 따려고 했는데 내용이 알차서 본인 공부도 됐어요', level: '자격증' },
  { text: '체계가 잘 잡혀 있어서 강의를 따라가기만 하면 되는 게 좋아요', level: '자격증' },
  { text: '강사님이 상담 사례를 풍부하게 들려주셔서 실전에 강해진 느낌이에요', level: '자격증' },
  { text: '제가 부담스러워하던 윤리 파트가 오히려 가장 인상 깊었습니다', level: '자격증' },
  { text: '같이 진행하시는 분들과 후기 공유하면서 더 깊게 들어갔어요', level: '자격증' },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeKoreanName(): string {
  return pick(koreanLastNames) + pick(koreanFirstNames)
}

function makeEnglishName(): string {
  return pick(englishNames)
}

export function makeSampleName(): { name: string; avatar: string } {
  const isKorean = Math.random() < 0.7
  return {
    name: isKorean ? makeKoreanName() : makeEnglishName(),
    avatar: pick(avatars),
  }
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
