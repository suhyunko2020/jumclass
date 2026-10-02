#!/usr/bin/env bash
# Supabase 전체 백업 — DB 덤프 + Storage 파일
#
# Supabase의 자동 백업(PHYSICAL)은 복구 전용이라 파일로 받아둘 수 없고,
# Storage(첨부파일·서명 이미지)는 아예 백업에 포함되지 않는다.
# 이 스크립트는 둘 다 로컬 파일로 받아 보관한다.
#
# 준비 (최초 1회):
#   1) Supabase 대시보드 → Project Settings → Database → Connection string → URI 복사
#   2) 프로젝트 루트에 .env.backup 파일을 만들고 아래처럼 저장 (git에 올라가지 않음)
#        SUPABASE_DB_URL="postgresql://postgres.xxxx:비밀번호@...pooler.supabase.com:5432/postgres"
#
# 실행:  ./scripts/backup-supabase.sh

set -euo pipefail
cd "$(dirname "$0")/.."

OUT_DIR="${BACKUP_DIR:-$HOME/jumclass-backups}"
STAMP="$(date +%Y%m%d_%H%M)"
DEST="$OUT_DIR/$STAMP"
mkdir -p "$DEST"

# ── 설정 로드 ────────────────────────────────────────────
[ -f .env.backup ] && { set -a; . ./.env.backup; set +a; }
[ -f .env ] && { set -a; . ./.env; set +a; }

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ SUPABASE_DB_URL 이 없습니다."
  echo "   대시보드 → Project Settings → Database → Connection string(URI)을 복사해"
  echo "   .env.backup 에 SUPABASE_DB_URL=\"...\" 형태로 저장해주세요."
  exit 1
fi

PG_DUMP="$(command -v pg_dump || echo /opt/homebrew/opt/libpq/bin/pg_dump)"
if [ ! -x "$PG_DUMP" ]; then
  echo "❌ pg_dump 가 없습니다.  brew install libpq  로 설치해주세요."
  exit 1
fi

# ── 1) 데이터베이스 덤프 ──────────────────────────────────
echo "▶ 데이터베이스 백업 중…"
"$PG_DUMP" "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges -f "$DEST/database.dump"
echo "  ✓ database.dump  ($(du -h "$DEST/database.dump" | cut -f1))"

# 사람이 읽을 수 있는 SQL 형태로도 하나 더 (긴급 확인용)
"$PG_DUMP" "$SUPABASE_DB_URL" --no-owner --no-privileges -f "$DEST/database.sql"
gzip -f "$DEST/database.sql"
echo "  ✓ database.sql.gz"

# ── 2) Storage 파일 백업 ─────────────────────────────────
# DB 백업에 포함되지 않으므로 별도로 받는다 (자격증 서명 이미지 = 법적 증빙)
if [ -n "${VITE_SUPABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "▶ Storage 파일 백업 중…"
  for BUCKET in lesson-attachments certificate-signatures; do
    python3 scripts/backup-storage.py "$BUCKET" "$DEST/storage/$BUCKET" || \
      echo "  ⚠ $BUCKET 백업 실패 (계속 진행)"
  done
else
  echo "⚠ VITE_SUPABASE_URL/ANON_KEY 가 없어 Storage 백업을 건너뜁니다."
fi

# ── 3) 오래된 백업 정리 (기본 30일) ──────────────────────
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
find "$OUT_DIR" -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "✅ 백업 완료: $DEST"
du -sh "$DEST"
