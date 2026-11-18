#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
./node_modules/.bin/esbuild apps/ios/takeoff.ts --bundle --platform=browser --target=safari17 --outfile=apps/ios/Resources/takeoff.js
