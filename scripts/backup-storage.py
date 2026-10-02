#!/usr/bin/env python3
"""Supabase Storage 버킷의 모든 파일을 로컬로 내려받는다.

Supabase의 DB 백업에는 Storage 객체가 포함되지 않는다(대시보드 안내).
자격증 서명 이미지·강의 첨부파일은 법적 증빙이자 재생성 불가 자산이라 따로 받아둔다.

사용:  python3 scripts/backup-storage.py <버킷명> <저장경로>
"""
import json
import os
import sys
import urllib.parse
import urllib.request

BASE = os.environ.get("VITE_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")


def api(path: str, payload=None):
    url = f"{BASE}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def walk(bucket: str, prefix: str = ""):
    """버킷을 재귀 순회하며 파일 경로를 모은다 (폴더는 size 메타가 없다)."""
    items = api(f"/storage/v1/object/list/{bucket}",
                {"prefix": prefix, "limit": 1000, "offset": 0})
    for it in items:
        name = it.get("name")
        if not name:
            continue
        path = f"{prefix}{name}"
        if it.get("metadata"):          # 파일
            yield path, it["metadata"].get("size", 0)
        else:                            # 폴더
            yield from walk(bucket, path + "/")


def main():
    if len(sys.argv) < 3:
        print("사용: backup-storage.py <버킷명> <저장경로>")
        return 1
    bucket, dest = sys.argv[1], sys.argv[2]
    if not BASE or not KEY:
        print("  ⚠ Supabase 환경변수 없음")
        return 1

    count = total = 0
    for path, size in walk(bucket):
        local = os.path.join(dest, path)
        os.makedirs(os.path.dirname(local), exist_ok=True)
        quoted = urllib.parse.quote(path)
        # 공개 버킷은 public 경로, 비공개 버킷은 인증 경로로 받는다
        urls = [
            f"{BASE}/storage/v1/object/public/{bucket}/{quoted}",
            f"{BASE}/storage/v1/object/{bucket}/{quoted}",
        ]
        last_err = None
        for url in urls:
            try:
                req = urllib.request.Request(url)
                req.add_header("apikey", KEY)
                req.add_header("Authorization", f"Bearer {KEY}")
                with urllib.request.urlopen(req, timeout=120) as r, open(local, "wb") as f:
                    f.write(r.read())
                count += 1
                total += size
                last_err = None
                break
            except Exception as e:
                last_err = e
        if last_err:
            print(f"  ⚠ 실패: {path} ({last_err})")

    print(f"  ✓ {bucket}: {count}개 파일, {total/1048576:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
