#!/usr/bin/env bash
# Run as root by `hawk setup sparrow`, after it makes $DATA.
set -euo pipefail
install -d -o sparrow -g sparrow -m 0750 "$DATA/attachments"
