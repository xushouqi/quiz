#!/bin/bash
# 生产环境重启脚本
# 自动检测 systemd 是否可用；不可用则手动启动 npm start。
set -e

cd /home/xsq/quiz

echo "当前 BUILD_ID (磁盘): $(cat .next/BUILD_ID 2>/dev/null || echo 'unknown')"
echo ""

INIT=$(ps -p 1 -o comm= | tr -d ' \n')
echo "init system: $INIT"
echo ""

if [ "$INIT" = "systemd" ]; then
  echo "systemd 已启用，使用 systemctl 重启..."
  sudo systemctl stop kangaroo-quiz || true
  sleep 2
  sudo systemctl start kangaroo-quiz
  sleep 3
  sudo systemctl status kangaroo-quiz --no-pager
else
  echo "systemd 未启用，改为手动启动 npm start..."
  # 尽量停掉旧进程
  pkill -f "next-server" || true
  pkill -f "npm start" || true
  sleep 2

  # 如果磁盘构建缺少奥数页产物，强制重新构建
  if [ ! -d .next/server/app/olympiad ]; then
    echo "检测到 olympiad 构建产物缺失，执行 npm run build..."
    npm run build
  fi

  # 清理可能残留的旧监听
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 1

  echo "启动服务..."
  nohup env NODE_ENV=production PORT=3000 npm start > /tmp/quiz.log 2>&1 &
  sleep 5
  echo "服务已启动，日志位置: /tmp/quiz.log"
  echo ""
  echo "--- 最近日志 ---"
  tail -n 25 /tmp/quiz.log || true
fi

echo ""
echo "验证运行中的 BUILD_ID..."
curl -sS --max-time 10 http://localhost:3000/ | head -c 200 | grep -oP '<!--\K[^-]+(?=-->)' || echo "无法获取 BUILD_ID"
echo ""
