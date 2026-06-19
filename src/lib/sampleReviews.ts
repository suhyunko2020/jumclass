// 관리자 샘플 리뷰 생성용 풀과 헬퍼.
// 풀이 충분히 커야 중복 없이 N개 생성 가능.
// 닉네임은 모두 한글 실명 형태로 생성하고, 사이트에는 성만 노출(maskName)된다.
// 아바타는 실제 회원과 동일하게 이름 첫 글자(성)를 사용한다.
//
// 문구 원칙:
// - 덱 특정 사실(카드 장수·메이저 아르카나 등)은 쓰지 않는다 → 어떤 카드 강의에 붙어도 자연스럽도록.
// - AI스러운 표현(길잡이/도약/시야가 트인다 등) 금지. 실제 후기처럼 구체적이고 담백하게.
// - 말투를 일부러 섞는다: 해요체/합니다체/반말/명사형 마무리/ㅋㅋ·ㅎㅎ·!! 등 → 사람마다 다르게.

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

// 리뷰 풀 — 말투/길이 일부러 다양하게. 같은 텍스트가 두 번 안 나오도록 추적.
const reviewPool: { text: string; level?: '입문' | '중급' | '고급' | '자격증' }[] = [
  // ── 공통 (강사·영상·플랫폼) ──
  { text: '깔끔함. 군더더기 없어서 좋았다.' },
  { text: '강추요 ㅋㅋ' },
  { text: '후회 안 함. 진작 들을걸 그랬어요.' },
  { text: '잘 보고 있습니다.' },
  { text: '생각보다 알차네' },
  { text: '믿고 보는 곳이에요.' },
  { text: '재밌게 봤다 ㅎㅎ' },
  { text: '이 가격에 이 정도면 돈값 합니다.' },
  { text: '기대 이상!' },
  { text: '목소리가 차분해서 집중 잘됨.' },
  { text: '책으로 볼 땐 막막했는데 영상 보니까 바로 이해됐어요.' },
  { text: '짧게 끊겨 있어서 출퇴근하면서 보기 딱 좋습니다.' },
  { text: '결제하자마자 바로 볼 수 있어서 편했음.' },
  { text: '복습용으로 자꾸 돌려보게 되네 ㅋㅋ' },
  { text: '영상 화질이 좋아서 살짝 놀랐어요.' },
  { text: '자료 따로 줘서 일일이 필기 안 해도 돼 편함.' },
  { text: '음질 깨끗해서 이어폰으로 들어도 안 피곤하다.' },
  { text: '천천히 따라 하기 좋게 만들어졌네요.' },
  { text: '친한 선배한테 배우는 느낌이라 부담 없었어요.' },
  { text: '몇 번 돌려보니까 카드 보는 눈이 확실히 달라짐.' },
  { text: '다음 강의도 결제하려고요!' },
  { text: '주변에도 슬쩍 추천했습니다.' },
  { text: '솔직히 큰 기대 없이 샀는데 메모장이 어느새 꽉 찼다. 두고두고 볼 자료가 생긴 셈.' },
  { text: '여기저기 둘러보다 결제했는데 확실히 정성이 다르네요. 만족합니다.' },
  { text: '직장 다니면서 학원은 시간이 안 맞아 포기했었는데, 이건 내 페이스대로 들으니까 너무 좋다.' },
  { text: '강사님이 본인 상담했던 얘기를 곁들여주셔서 그게 제일 도움 됐어요. 이론만 읊는 강의랑은 다름.' },

  // ── 입문 ──
  { text: '진짜 처음인데 따라갈 만했음.', level: '입문' },
  { text: '왕초보도 됩니다. 강추.', level: '입문' },
  { text: '카드 이제 안 무서워요 ㅎㅎ', level: '입문' },
  { text: '용어 어려울까 봐 걱정했는데 풀어서 알려주셔서 편했다.', level: '입문' },
  { text: '뭐부터 해야 할지 몰랐는데 감 잡혔어요.', level: '입문' },
  { text: '기초부터 차근차근 잡아줘서 좋았습니다.', level: '입문' },
  { text: '한 챕터 끝낼 때마다 괜히 뿌듯 ㅋㅋ', level: '입문' },
  { text: '책 사서 끄적이다 답답해서 결제. 잘한 듯.', level: '입문' },
  { text: '입문이라 가볍게 봤는데 은근 깊이 있어서 좋았어요.', level: '입문' },
  { text: '아무것도 모르고 시작했는데 지금은 친구 봐줄 정도는 됨.', level: '입문' },
  { text: '설명이 쉬워서 술술 들어옵니다.', level: '입문' },
  { text: '겁먹을 필요 없었네. 생각보다 쉬워요.', level: '입문' },

  // ── 중급 ──
  { text: '막혔던 부분이 풀렸다.', level: '중급' },
  { text: '실전 팁 많아서 좋네요.', level: '중급' },
  { text: '셀프로만 하다 처음 남 봐줬는데 자신감 붙음 ㅋㅋ', level: '중급' },
  { text: '카드 조합 해석이 어려웠는데 이제 패턴이 보여요.', level: '중급' },
  { text: '같은 카드도 상황 따라 다르게 읽는 법 배웠습니다.', level: '중급' },
  { text: '리딩 사례가 많아서 실전 감 살아남.', level: '중급' },
  { text: '기초만 알고 멈춰 있던 사람한테 딱이에요.', level: '중급' },
  { text: '강사님 노하우 듣고 나서야 감 잡았다.', level: '중급' },
  { text: '중급 깊이 적당함. 만족.', level: '중급' },

  // ── 고급 ──
  { text: '확실히 깊이가 다르네.', level: '고급' },
  { text: '상담에 바로 쓰는 중입니다.', level: '고급' },
  { text: '책엔 잘 안 나오는 응용법이 알맹이예요.', level: '고급' },
  { text: '오래 막혔던 의문이 한 번에 풀렸다.', level: '고급' },
  { text: '강사님 임상 경험이 그대로 녹아 있어서 믿음이 감.', level: '고급' },
  { text: '고급 파트에서 한 방 먹은 느낌 ㅋㅋ', level: '고급' },
  { text: '심화로 갈수록 더 재밌어지는 게 신기합니다.', level: '고급' },
  { text: '해석 기법이 알차서 상담 일에 큰 도움 됨.', level: '고급' },
  { text: '마음가짐까지 짚어주셔서 인상 깊었어요.', level: '고급' },

  // ── 자격증 ──
  { text: '진도 관리 꼼꼼해서 든든했음.', level: '자격증' },
  { text: '1:1로 봐주시니 마음이 놓이네요.', level: '자격증' },
  { text: '한 회차씩 끝낼 때마다 성취감 ㅋㅋ', level: '자격증' },
  { text: '혼자였으면 중간에 포기했을 듯. 챙겨주셔서 끝까지 했어요.', level: '자격증' },
  { text: '커리어 준비로 등록. 실무 파트가 특히 도움 됐다.', level: '자격증' },
  { text: '결제하니까 강사님 연락 빨리 와서 놀랐어요. 친절하심.', level: '자격증' },
  { text: '수료까지 체계가 잡혀 있어서 따라가기만 하면 됐습니다.', level: '자격증' },
  { text: '자격증만 따려 했는데 내용이 알차서 내 공부도 됨.', level: '자격증' },
  { text: '윤리 파트 부담스러울 줄 알았는데 오히려 제일 와닿았다.', level: '자격증' },
  { text: '상담 사례 많이 들려주셔서 실전에 강해진 느낌이에요.', level: '자격증' },
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
