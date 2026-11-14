#!/usr/bin/env python3
"""Old name kept so earlier notes still work. The recipe now lives in fetch_venue.py:
    python3 data/fetch_venue.py msg [--refresh]
"""
import os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.exit(subprocess.call([sys.executable, os.path.join(here, "fetch_venue.py"), "msg"] + sys.argv[1:]))
