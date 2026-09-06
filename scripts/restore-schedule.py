#!/usr/bin/env python3
import base64
from pathlib import Path
h = "".join(Path(f".tmp-restore2/h{i}.b64").read_text().strip() for i in range(13))
p = "".join(Path(f".tmp-restore2/p{i}.b64").read_text().strip() for i in range(16))
Path("frontend/src/app/zibagar/hours/page.tsx").write_bytes(base64.b64decode(h))
Path("frontend/src/lib/panel-api.ts").write_bytes(base64.b64decode(p))
print("hours", Path("frontend/src/app/zibagar/hours/page.tsx").stat().st_size)
print("panel", Path("frontend/src/lib/panel-api.ts").stat().st_size)
assert Path("frontend/src/app/zibagar/hours/page.tsx").stat().st_size > 10000
assert b"PLACEHOLDER" not in Path("frontend/src/app/zibagar/hours/page.tsx").read_bytes()
assert b"fetchMyTimeOffs" in Path("frontend/src/lib/panel-api.ts").read_bytes()
print("OK")
