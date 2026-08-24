# 项目说明（quiz / 跳跳的数学冒险）

## 服务启动方式（面向平板的部署）

### 生产模式（systemd 托管）

已配置 systemd 服务 `kangaroo-quiz.service`（`/etc/systemd/system/kangaroo-quiz.service`），开机自启、崩溃自动重启。

```bash
# 管理命令
sudo systemctl start kangaroo-quiz     # 启动
sudo systemctl stop kangaroo-quiz      # 停止
sudo systemctl restart kangaroo-quiz   # 重启
sudo systemctl status kangaroo-quiz    # 查看状态
journalctl -u kangaroo-quiz -f         # 查看日志（实时）
journalctl -u kangaroo-quiz --since today  # 今天的日志
```

- 服务配置：`Restart=always`，崩溃后 5 秒自动重启
- 端口 3000，监听 `0.0.0.0`（局域网可达）
- 日志：`journalctl -u kangaroo-quiz`（已接入 journald，不再写 `server.log`）
- TTS 磁盘缓存目录：`data/tts-cache/`（已 gitignore，可安全删除重建）

### 开发模式（手动启动）

本地开发调试用，**不要**用于平板访问：

```bash
npm run dev            # 端口 3000，带 HMR 热更新
```

- 手动启动，Ctrl+C 停止
- 适合开发调试：改代码即时刷新，错误信息更详细
- **不要**用 `npm run dev` 做生产服务——每个路由首次命中要付按需编译惩罚，延迟高

### 为什么生产模式不用 dev（2026-07-30 实测）

| | `next dev`（开发） | `next build && next start`（生产） |
|---|---|---|
| API 首次访问 | 700-1300ms（按需编译） | 8-43ms |
| 页面交互 INP | ~253ms | ~66ms |

### 注意

- 若发现 API 变慢，先检查 `ss -tlnp | grep :3000` 的进程链是 `next start`（生产）还是 `next dev`（开发）——曾经出现过 dev 被意外拉起的情况。
- 代码改动后需要 `sudo systemctl restart kangaroo-quiz` 才能生效；若只是静态资源/内容变更，视 Next.js 缓存情况可能需要重启。

## 常用命令

- `npm test` — vitest，47 个用例（注：tests/ 目录有 8 个预存的 tsc 类型错误，与 vitest 运行无关）
- `npm run seed` — 重建题库数据
