#!/bin/sh

set -eu

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -d ./node_modules/.bin ]; then
  PATH="$(pwd)/node_modules/.bin:${PATH}"
  export PATH
fi

exec "$@"
