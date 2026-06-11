#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED="$ROOT/backend/seed_samples"
DOCS="/mnt/c/Users/USER/Documents"
mkdir -p "$SEED"

count=0
max=24
find "$DOCS" -maxdepth 3 -type f \( -iname '*.pdf' -o -iname '*.docx' -o -iname '*.xlsx' -o -iname '*.png' \) ! -iname '*.psd' 2>/dev/null | while read -r f; do
  if [ "$count" -ge "$max" ]; then break; fi
  size=$(wc -c < "$f" | tr -d ' ')
  if [ "$size" -gt 10485760 ]; then continue; fi
  base=$(basename "$f")
  dest="$SEED/$base"
  if [ -f "$dest" ]; then
    ext="${base##*.}"
    name="${base%.*}"
    dest="$SEED/${name}_$count.$ext"
  fi
  cp "$f" "$dest" && echo "Copied: $(basename "$dest")"
  count=$((count + 1))
done

ls "$SEED" | wc -l
