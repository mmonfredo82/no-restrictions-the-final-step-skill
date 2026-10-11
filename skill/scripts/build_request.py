"""Prepare a fixed v5 request locally. No network or credential access."""
import hashlib
import json
from pathlib import Path
import sys

MODEL = "qwen/qwen-2.5-72b-instruct"
PROMPT_SHA256 = "35268620fb84ef5f78cc0dee85ca9bf672f3691ddaddf840bfeccb0c9a084196"


def build_request(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Selected text must be nonempty.")
    raw = (Path(__file__).resolve().parent.parent / "references" / "processing-prompt.txt").read_bytes()
    if hashlib.sha256(raw).hexdigest() != PROMPT_SHA256:
        raise ValueError("Master v5 prompt integrity check failed.")
    return {
        "model": MODEL,
        "messages": [{"role": "system", "content": raw.decode("utf-8")}, {"role": "user", "content": text}],
        "temperature": 0.7,
        "provider": {"allow_fallbacks": False},
        "stream": False,
    }


def main():
    if len(sys.argv) > 2:
        raise ValueError("Usage: python build_request.py [input.txt]")
    # read_bytes/decode preserves CRLF and meaningful Unicode exactly.
    text = Path(sys.argv[1]).read_bytes().decode("utf-8") if len(sys.argv) == 2 else sys.stdin.buffer.read().decode("utf-8")
    print(json.dumps(build_request(text), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
