// 인메모리 LRU+TTL 캐시 단위테스트.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimpleCache } from "../src/lib/cache.js";

test("set/get 기본 동작과 size", () => {
  const c = new SimpleCache(10);
  c.set("a", 1);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("none"), null);
  assert.equal(c.size(), 1);
});

test("TTL 만료 후 get은 null이고 엔트리가 제거된다", async () => {
  const c = new SimpleCache(10);
  c.set("a", "v", 5);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(c.get("a"), null);
  assert.equal(c.size(), 0);
});

test("maxSize 초과 시 가장 오래 안 쓴 키가 제거된다(LRU)", () => {
  const c = new SimpleCache(2);
  c.set("a", 1);
  c.set("b", 2);
  c.get("a"); // a 승격 → b가 LRU
  c.set("c", 3);
  assert.equal(c.get("b"), null);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("c"), 3);
});

test("cleanup은 만료 엔트리만 지운다", async () => {
  const c = new SimpleCache(10);
  c.set("short", 1, 5);
  c.set("long", 2, 60_000);
  await new Promise((r) => setTimeout(r, 15));
  c.cleanup();
  assert.equal(c.size(), 1);
  assert.equal(c.get("long"), 2);
});
