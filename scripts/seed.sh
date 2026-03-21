#!/bin/sh

set -eu

echo "Seeding initial samples..."
tsx scripts/seed.ts
