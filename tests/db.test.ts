import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";

describe("openDb", () => {
  it("creates the three tables", () => {
    const db = openDb(":memory:");
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["questions", "sessions", "answers"]));
  });

  it("enforces the difficulty CHECK constraint", () => {
    const db = openDb(":memory:");
    expect(() =>
      db
        .prepare(
          "INSERT INTO questions (difficulty, topic, text_zh, text_en, choices, correct_index, explanation_zh, explanation_en) VALUES (7, 'counting', 'z', 'e', '[]', 0, 'z', 'e')"
        )
        .run()
    ).toThrow();
  });

  it("inserts and reads a session row", () => {
    const db = openDb(":memory:");
    const info = db
      .prepare("INSERT INTO sessions (mode, started_at) VALUES ('practice', 123)")
      .run();
    const row = db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(Number(info.lastInsertRowid)) as { mode: string; started_at: number };
    expect(row.mode).toBe("practice");
    expect(row.started_at).toBe(123);
  });
});
