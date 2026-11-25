#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo 'Fill in POSTGRES_PASSWORD, Owner__Email and Owner__Password in .env, then run this script again.'
  exit 1
fi
docker compose up --build -d
echo 'Open http://localhost:5173 after startup, or the port you configured in .env.'
