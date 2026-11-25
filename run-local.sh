#!/usr/bin/env sh
set -eu
page="$(cd "$(dirname "$0")" && pwd)/RUN-LOCAL.html"
case "$(uname -s)" in
  Darwin) exec open "$page" ;;
  *) exec xdg-open "$page" ;;
esac
