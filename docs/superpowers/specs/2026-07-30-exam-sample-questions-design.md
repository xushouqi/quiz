# 模拟考试官方样题库设计

## 概述

把「模拟考试」与「闯关练习」的题库彻底分开：

- **闯关练习**：继续使用现有原创题（`source='practice'`）。
- **模拟考试**：改用 Math Kangaroo **官方公开发布的样题/历年样卷**（`source='official'`）为主，
  不足时用**原创仿真题**（`source='simulation'`）按难度补齐，仍还原官方赛制（24 题 / 75 分钟 /
  起始 24 分 / 答对 +3·+4·+5 / 答错 −1 / 不答 0 / 满分 120）。

来源标注仅在后台 / 家长端可见，孩子做题界面不显示。

## 背景与关键决策

来自 brainstorming 的既定选择（均为用户拍板）：

| 决策点 | 结论 |
|--------|------|
| 样题来源 | **只用官网免费样题**（mathkangaroo.org 历年样卷、mathkangaroo.in 的 G1-2 卷），不用第三方题库 |
| 官方题量 | **尽量多**：在官网来源范围内尽量多转录 G1-2 卷，仿真题仅作兜底 |
| 题库分离 | **严格分开**：考试库（官方+仿真）与练习库（原创）零重叠；为考试生成的仿真题**不**进练习 |
| 来源显示 | **仅后台/家长端可见**：孩子界面不标来源，家长端可见本卷「官方/仿真」构成 |
| 技术方向 | **方案 A**：单表 + `source` 字段 + 按子目录区分 |
| 配图缺口 | **适中**：在现有 illustration 基础上加一小撮 SVG 原语，以解锁更多官方题 |

### 版权立场（务必遵守）

官方真题/样卷版权归 **Kangourou Sans Frontières**。本项目为单个家庭的个人非商用使用，
**不是**「无版权」。因此：

- 来源仅限**官方主动公开发布**的样题/样卷，**不**抓取第三方盗版题库。
- 复制量保持克制，并在代码库与家长端**明确署名**出处。
- 体量的大头由**原创仿真题**承担——仿真题无任何版权问题。

## 需求

- 练习与考试两个题库零重叠；练习绝不出现考试题，考试绝不会出现练习原创题。
- 考试每难度（3/4/5）各 8 题、共 24 题；选题「官方优先、仿真补齐」。
- 现有 `answers` / 错题本 / 统计 / 计分逻辑不受破坏（仍是同一张 `questions` 表，外键不变）。
- 家长端可见本卷官方/仿真构成与官方来源致谢；孩子界面不变。
- 旧 `quiz.db` 平滑升级（幂等迁移）。

## 架构设计

采用**方案 A：单表 + `source` 字段 + 按子目录区分**。

### 为什么选这个方案

- 单表使 `answers.question_id` 外键、错题本 join、统计查询**全部不用改**。
- `source` 字段天然支持：选题过滤（练习/考试）、家长端构成统计。
- 子目录决定 source，写题者无需手填，物理分离、不易放错。

### 被否决的方案

- **方案 B（独立 `exam_questions` 表）**：`answers.question_id` 变歧义，错题本/统计 join 全部要重写，
  侵入性大，无实质收益。否决。
- **方案 C（单表 + JSON 内写 source，不分子目录）**：物理上不分离，易放错文件，不如目录直观。否决。

## 数据模型与迁移

`src/lib/db.ts` 的 `questions` 表新增两列：

```sql
source       TEXT NOT NULL DEFAULT 'practice'
             CHECK (source IN ('practice','official','simulation')),
attribution  TEXT   -- 仅官方题填来源出处（如 "MK-USA 2024 G1-2 Q3"）；其余为 NULL
```

`openDb()` 内加**幂等迁移**：

- `PRAGMA table_info(questions)` 检测是否已有 `source` / `attribution`；
- 缺失则 `ALTER TABLE questions ADD COLUMN ...`；
- 新库由 `CREATE TABLE`（`IF NOT EXISTS`）直接带上两列，反复打开安全。

> re-seed 仍会清空作答历史（题目 ID 变化）——与现状一致，README 已有警告。

`src/lib/types.ts`：

- `Question` / `QuestionRow` 增加 `source: 'practice' | 'official' | 'simulation'`
  与 `attribution: string | null`；`rowToQuestion` 一并映射。
- `RawQuestion` **不含** `source`（由所在目录注入）；`attribution` 作为可选字段透传。

## 目录结构

`source` 由子目录决定：

```
questions/
  practice/      ← 现有 6 个文件迁入（arithmetic / counting / logic / patterns / shapes / time.json）
  official/      ← 官方样题（如 2024-usa-g12.json），每条可带 attribution
  simulation/    ← 原创仿真题（按难度/题型分布编写）
```

`src/scripts/seed.ts` 改造：

- 依次遍历 `practice` / `official` / `simulation` 三个目录；
- 每目录 `loadQuestionFiles` → `validateBank` → 插入时写入对应 `source` 与可选 `attribution`；
- 保持原有「先清空 answers/sessions/questions 再插入」的事务行为；
- seed 结束按难度统计考试库（official+simulation）题量，某难度 < 8 时 `console.warn` 提醒补仿真题。

`src/lib/validate.ts`：允许 `attribution` 为可选字符串（存在则须为非空字符串），其余校验不变。

## 选题逻辑

`src/lib/questions.ts`：

- `getPracticeQuestions(db, topic, limit)`：SQL 增加 `source = 'practice'` 过滤
  （random 与按 topic 两条分支都要加）。→ 练习库与考试库天然零重叠。

- `getExamQuestions(db, perDifficulty = 8)`：对每个难度 `[3, 4, 5]`：
  1. 先取 `source='official'`、该难度、排除上次考过的题，上限 8；
  2. 不足 8 用 `source='simulation'`（排除上次考过 ∪ 已选官方）补齐；
  3. 仍不足 8 时沿用现有兜底：**放宽去重**（忽略「上次考试排除」，仅排除本轮已选的题）再取，
     把上次考用掉的那部分题重新纳入。
  - 注意：兜底**不会在同一套卷内重复同一题**。某难度考试库若真的 < 8 题，该难度就返回实际可用题数；
    「仿真每难度 ≥ 8」不变量才是「每卷满 24 题」的真正保证。
  - `pickExcluding` 增加 `source` 过滤参数。
  - 去重逻辑（`getLastExamSessionId` → 上次考试题 ID）保持不变。

## 内容生产

### 官方题转录（实现阶段执行）

- 来源：mathkangaroo.org 历年样卷、mathkangaroo.in 的 G1-2 卷（官方公开 PDF，英文）。
- 每条产出：
  - `difficulty` 按题位映射：Q1–8 → 3、Q9–16 → 4、Q17–24 → 5（与官方分值一致）；
  - `topic`（六类之一）、`text_en`（原题）、`text_zh`（翻译）；
  - `choices` 恰好 3 项——G1-2（Pre-Ecolier）官方即 3 选项，无需裁剪；
  - `correct_index`、双语 `explanation`；
  - `illustration`（映射到现有或新增原语，无法表达者跳过/改编）；
  - `attribution`（如 `"MK-USA 2024 G1-2 Q3"`）。

### 配图系统扩展

- 现有原语：`emoji:` / `svg:clock` / `svg:grid` / `svg:diagsquare`。
- 新增一小撮手写 SVG 原语（与现有实现同方式），覆盖官方常见图形，例如：
  `svg:dice`、`svg:bars`、`svg:path`、简单形状排列等（具体集合在实现时按实际遇到的官方题确定）。
- 仍无法用原语表达的官方题：跳过或改编为文字描述，缺口由仿真题补齐。
- **不**引入真实图片资源（避免图片管线 + 插图自身版权问题）。

### 仿真题生成（原创，无版权问题）

- 按 G1-2 风格 / 题型 / 难度分布原创编写，双语、同 schema，`source='simulation'`。
- 作用：① 官方题不足 8/难度时补齐；② 让多次考试有变化。
- **不变量**：仿真库每难度 ≥ 8，保证「零官方也能组满一套 24 题卷」。

### 来源标注与版权

- DB：官方题 `attribution` 列存出处。
- README 与家长面板加致谢行，例如：
  > 官方样题来源：Math Kangaroo（Kangourou Sans Frontières）公开发布的样题/历年样卷，
  > 仅供个人练习，版权归原作者/机构所有。
  > 参考：<https://mathkangaroo.org/mks/practice/free-question-samples/> · <https://www.mathkangaroo.in/>

## 家长端显示

- **考试报告页**（`src/app/exam/report/[id]/page.tsx`）：显示**本卷构成**「官方样题 X 题 · 仿真模拟 Y 题」
  ——由本次作答题目的 `source` 统计（报告本就经 `getQuestionsByIds` 取题，`source` 随之带出，
  就地计数即可）；底部加官方来源致谢。构成是「每次考试」维度，故放在报告页而非家长面板。
- **家长面板**（`src/app/parents/page.tsx`）与 **README**：仅放官方来源致谢行（不做逐卷统计）。
- 孩子看到的考试界面（`src/app/exam/page.tsx`）：**完全不变**，不显示来源标签。

## 边界与错误处理

- `official/` 为空 → 全仿真卷，正常工作。
- 仿真库满足「每难度 ≥ 8」不变量 → 考试总能组满 24 题（上次考用掉的题由兜底分支放宽去重补回）。
- 某难度考试库 < 8（仅当仿真也未补齐时）→ 该难度返回实际可用题数（不在同卷内重复同一题），不崩；
  seed 时已 `console.warn` 预警。
- 迁移幂等：`PRAGMA table_info` 检测后再 `ALTER`，新库/反复打开安全。

## 测试

- `tests/seed.test.ts`（更新）：
  - 子目录布局下 source 按目录正确写入；
  - `attribution` 透传；
  - 旧 schema 库经 `openDb` 迁移后补上两列。
- 新增选题测试：
  - 练习只返回 `source='practice'`（考试题不泄漏进练习）；
  - 考试每难度「官方优先 → 仿真补齐」，共 8/难度、24/卷；
  - 某难度考试库不足 8 时兜底复用、不崩；
  - 对上次考试的去重仍生效。
- 现有 scoring / stats 测试保持绿。

## 实现范围说明

- **工程改动**（schema/迁移/目录/选题/家长端/测试）是本 spec 的主体，确定可落地。
- **内容工作**（转录哪些官方题、新增哪几个 SVG 原语、写多少仿真题）在实现阶段根据实际遇到的
  官方题逐步确定；本 spec 只约定规则与不变量，不预先枚举具体题目。
