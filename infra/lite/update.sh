#!/bin/sh
# 코드 업데이트 반영:  cd /opt/ontoegeun/app && git pull && sh infra/lite/update.sh
set -eu
LITE=/opt/ontoegeun/app/infra/lite
sh "$LITE/build-web.sh"
cd "$LITE"
docker compose build ai
docker compose up -d
echo "업데이트 완료"
