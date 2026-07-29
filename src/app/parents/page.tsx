"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { OutbackBackground } from "@/components/background/OutbackBackground";
import { RadarChart } from "@/components/quiz/RadarChart";
import { ScoreCurve } from "@/components/quiz/ScoreCurve";

interface StatsPayload {
  stars: number;
  totalCorrect: number;
  perTopic: { topic: string; label: string; correct: number; total: number }[];
  examScores: { id: number; score: number; maxScore: number; finishedAt: number }[];
  streakDays: number;
  activeDays: number;
}

interface User {
  id: number;
  name: string;
  emoji: string;
}

function makeGate() {
  const a = 12 + Math.floor(Math.random() * 20);
  const b = 7 + Math.floor(Math.random() * 20);
  return { a, b, answer: a + b };
}

function StatTile({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="rounded-3xl border-4 border-cocoa/10 bg-white/90 p-4 text-center shadow">
      <div className="text-3xl">{emoji}</div>
      <div className="font-kids text-3xl">{value}</div>
      <div className="text-xs text-cocoa/60">{label}</div>
    </div>
  );
}

export default function ParentsPage() {
  const [gate, setGate] = useState(makeGate);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmoji, setNewUserEmoji] = useState("🐨");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!unlocked) return;

    // 加载用户列表
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users);
        // 默认选择第一个用户
        if (data.users.length > 0 && !selectedUserId) {
          setSelectedUserId(data.users[0].id);
        }
      });
  }, [unlocked, selectedUserId]);

  useEffect(() => {
    if (!unlocked || !selectedUserId) return;

    void fetchWithTimeout(`/api/stats?userId=${selectedUserId}`)
      .then((r) => r.json())
      .then((s: StatsPayload) => setStats(s))
      .catch(() => setStatsError(true));
  }, [unlocked, selectedUserId]);

  // 添加用户
  const addUser = async () => {
    if (!newUserName.trim()) return;
    await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newUserName, emoji: newUserEmoji }),
    });
    setNewUserName("");
    setNewUserEmoji("🐨");
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users);
  };

  // 删除用户
  const deleteUser = async (id: number) => {
    if (!confirm("确定删除这个用户吗？所有学习数据都会被删除！")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users);
  };

  // 更新用户
  const updateUser = async () => {
    if (!editingUser) return;
    await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editingUser.name,
        emoji: editingUser.emoji,
      }),
    });
    setEditingUser(null);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users);
  };

  const radarData = useMemo(() => {
    if (!stats) return [];
    return stats.perTopic.map((t) => ({
      label: t.label,
      value: t.total === 0 ? 0 : t.correct / t.total,
    }));
  }, [stats]);

  const curveData = useMemo(() => {
    if (!stats) return [];
    return stats.examScores.slice(-10).map((e) => ({ label: `#${e.id}`, score: e.score, max: e.maxScore }));
  }, [stats]);

  if (!unlocked) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(input) === gate.answer) {
              setUnlocked(true);
            } else {
              setError(true);
              setGate(makeGate());
              setInput("");
            }
          }}
          className="w-full max-w-sm rounded-[2rem] border-4 border-cocoa/10 bg-white/95 p-8 text-center shadow-xl"
        >
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 font-kids text-2xl">家长入口 Parents Gate</h1>
          <p className="mt-1 text-sm text-cocoa/60">算一算才能进来（防止小朋友误触）</p>
          <p className="mt-4 font-kids text-3xl">
            {gate.a} + {gate.b} = ？
          </p>
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            inputMode="numeric"
            aria-label="密码答案"
            className="mt-4 w-32 rounded-2xl border-4 border-cocoa/15 p-3 text-center font-kids text-2xl focus:border-sunny focus:outline-none"
          />
          {error && <p className="mt-2 text-sm text-coral">不对哦，换一题再试！</p>}
          <button type="submit" className="mt-4 w-full rounded-full bg-sunny p-3 font-kids text-xl text-white shadow">
            进入 Enter
          </button>
          <Link href="/" className="mt-3 block text-sm text-cocoa/50 underline">← 回首页 Home</Link>
        </form>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <OutbackBackground />
        {statsError ? (
          <p className="max-w-sm rounded-3xl border-4 border-coral/30 bg-coral/10 p-4 text-center font-kids text-coral">
            加载失败：请确认服务正在运行后刷新页面。Couldn&apos;t reach the server.
          </p>
        ) : (
          <p className="rounded-full bg-white/90 px-6 py-3 font-kids shadow">加载中…</p>
        )}
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh">
      <OutbackBackground />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <header className="flex items-center justify-between">
          <h1 className="font-kids text-3xl">家长面板 Dashboard</h1>
          <Link href="/" className="rounded-full bg-white/85 px-4 py-2 font-kids shadow">← 回首页 Home</Link>
        </header>

        {/* 用户选择器 */}
        {users.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-cocoa/10 bg-white/90 p-3 shadow">
            <span className="font-kids text-cocoa/60">查看：</span>
            <div className="flex flex-wrap gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 font-kids transition ${
                    selectedUserId === user.id
                      ? "bg-sunny text-white shadow"
                      : "bg-cocoa/5 hover:bg-cocoa/10"
                  }`}
                >
                  <span>{user.emoji}</span>
                  <span>{user.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <section className="grid grid-cols-3 gap-3">
          <StatTile emoji="⭐" value={stats.stars} label="星星 Stars" />
          <StatTile emoji="🔥" value={stats.streakDays} label="连续天数 Streak" />
          <StatTile emoji="🗓️" value={stats.activeDays} label="活跃天数 Active" />
        </section>
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">题型正确率 Accuracy by topic</h2>
          <RadarChart data={radarData} />
        </section>
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">考试分数曲线 Exam scores</h2>
          <ScoreCurve points={curveData} />
        </section>

        {/* 用户管理 */}
        <section className="rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl">
          <h2 className="font-kids text-2xl">用户管理 User Management</h2>

          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-2xl border-2 border-cocoa/10 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{user.emoji}</span>
                  <span className="font-kids text-xl">{user.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser({ ...user })}
                    className="rounded-full bg-sunny px-4 py-1 font-kids text-white transition hover:brightness-105"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteUser(user.id)}
                    className="rounded-full bg-coral px-4 py-1 font-kids text-white transition hover:brightness-105"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 添加新用户 */}
          <div className="mt-6 rounded-2xl border-2 border-dashed border-cocoa/20 p-4">
            <h3 className="font-kids text-lg">添加新用户</h3>
            <div className="mt-3 flex gap-3">
              <input
                type="text"
                value={newUserEmoji}
                onChange={(e) => setNewUserEmoji(e.target.value)}
                className="w-16 rounded-2xl border-2 border-cocoa/15 p-2 text-center text-2xl focus:border-sunny focus:outline-none"
                maxLength={2}
              />
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="名字"
                className="flex-1 rounded-2xl border-2 border-cocoa/15 p-2 font-kids focus:border-sunny focus:outline-none"
              />
              <button
                type="button"
                onClick={addUser}
                disabled={!newUserName.trim()}
                className="rounded-full bg-grass px-6 py-2 font-kids text-white transition hover:brightness-105 disabled:opacity-50"
              >
                添加
              </button>
            </div>
          </div>
        </section>

        {/* 编辑用户弹窗 */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/40 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="font-kids text-2xl">编辑用户</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="font-kids text-sm text-cocoa/60">头像</label>
                  <input
                    type="text"
                    value={editingUser.emoji}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, emoji: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border-2 border-cocoa/15 p-2 text-center text-3xl focus:border-sunny focus:outline-none"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="font-kids text-sm text-cocoa/60">名字</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-2xl border-2 border-cocoa/15 p-2 font-kids focus:border-sunny focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 rounded-full border-2 border-cocoa/10 bg-white p-3 font-kids transition hover:bg-cocoa/5"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={updateUser}
                  className="flex-1 rounded-full bg-sunny p-3 font-kids text-white transition hover:brightness-105"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
