#!/usr/bin/env bash

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found, installing..."
    npm i -g pnpm
#else
#    echo "pnpm is already installed"
fi

set -e

if [[ "$npm_execpath" != *pnpm* ]]; then
  echo -e "\033[1;31m\nThis project requires pnpm as a package manager.\n\033[0m"
  exit 1
fi
