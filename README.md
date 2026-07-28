# 跳跳的数学冒险 🦘 — 袋鼠数学竞赛练习网站

为 6-8 岁（1-2 年级）孩子准备的袋鼠数学竞赛（Math Kangaroo Level 1-2）双语练习网站。

## 功能

- 🏃 **闯关练习**：6 大题型 + 随机混合，每题两次作答机会，即时动画反馈与双语解析，🔊 中文读题
- 📝 **模拟考试**：还原官方赛制（24 题 / 75 分钟 / 起始 24 分 / 答对 +3·+4·+5 / 答错 −1 / 不答 0 / 满分 120）
- 📒 **错题本**：自动收录错题，重做答对即移出
- ⭐ **星星与徽章**：首次答对 +3⭐，再次答对 +1⭐，里程碑徽章
- 📊 **家长面板**：算术密码门，题型正确率雷达图、考试分数曲线、连续打卡天数

## 快速开始

    npm install
    npm run seed     # 导入题库（54 道双语题）→ data/quiz.db
    npm run dev      # 打开 http://localhost:3000

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build && npm start` | 生产模式 |
| `npm test` | 运行 Vitest 测试 |
| `npm run seed` | 重新导入题库 |

## 添加/修改题目

编辑 `questions/` 目录下的 JSON 文件（每主题一个文件），然后运行 `npm run seed`。
每题必须包含：`difficulty`（3/4/5）、`topic`、双语题干（`text_zh`/`text_en`）、
恰好 3 个双语选项（`choices`）、`correct_index`（0/1/2）、双语解析。
`illustration` 可选：`emoji:🍎🍎`、`svg:clock:6:30`、`svg:grid`、`svg:diagsquare`。

> ⚠️ 重新 seed 会清空作答历史（题目 ID 会变化），星星与错题本随之重置。

## 技术栈

Next.js 15（App Router）· TypeScript · Tailwind CSS v4 · better-sqlite3（SQLite）· Vitest。
无图表库/动画库，全部手写 CSS + SVG。数据仅保存在本地 `data/quiz.db`，备份该文件即可。

## 部署到平板

- 局域网：`npm run dev -- -H 0.0.0.0`，平板访问 `http://<电脑IP>:3000`
- 公网：部署到 Vercel 免费方案；注意 Vercel 函数环境对 better-sqlite3 的写入限制，
  家庭长期使用建议跑在家里电脑或一台小服务器上

## 说明

题目为按袋鼠数学竞赛题型风格原创编写（官方真题受 Kangourou Sans Frontières 版权保护）。
官方样题与规则参考：<https://mathkangaroo.org/mks/faqs/about-the-test/> · <https://en.math-kangaroo.org.cn/>
