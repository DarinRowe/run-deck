#!/usr/bin/env python3
"""Sample macOS process RSS and physical footprint without forcing garbage collection.

The labels file is a JSON object mapping an evidence label to a PID. It may be
updated during a run. PID reuse is detected using the kernel process start time.
"""
import argparse
import ctypes
import datetime
import json
import sys
import time
from pathlib import Path


class Usage(ctypes.Structure):
    # rusage_info_v0, from the macOS SDK's sys/resource.h.
    _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [
        (name, ctypes.c_uint64) for name in (
            "user_time", "system_time", "idle_wakeups", "interrupt_wakeups",
            "pageins", "wired_bytes", "rss_bytes", "footprint_bytes",
            "started", "exited",
        )
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("labels", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--seconds", type=float, default=1800)
    parser.add_argument("--interval", type=float, default=5)
    args = parser.parse_args()
    if sys.platform != "darwin" or args.seconds <= 0 or args.interval <= 0:
        parser.error("macOS and positive duration/interval are required")
    libproc = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
    libproc.proc_pid_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
    libproc.proc_pid_rusage.restype = ctypes.c_int
    identities = {}
    start = time.monotonic()
    with args.output.open("x", buffering=1) as output:
        while True:
            elapsed = time.monotonic() - start
            labels = json.loads(args.labels.read_text())
            for label, pid in labels.items():
                usage = Usage()
                row = {"timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                       "elapsed_s": round(elapsed, 3), "label": label, "pid": pid}
                if libproc.proc_pid_rusage(pid, 0, ctypes.byref(usage)):
                    row["error"] = f"proc_pid_rusage errno={ctypes.get_errno()}"
                elif identities.setdefault((label, pid), usage.started) != usage.started:
                    row["error"] = "PID reused; do not join this sample to the original process"
                else:
                    row.update(rss_bytes=usage.rss_bytes, footprint_bytes=usage.footprint_bytes,
                               process_start=usage.started)
                output.write(json.dumps(row) + "\n")
            if elapsed >= args.seconds:
                break
            time.sleep(min(args.interval, args.seconds - elapsed))
    print(json.dumps({"output": str(args.output), "elapsed_s": round(time.monotonic() - start, 1)}))


if __name__ == "__main__":
    main()
