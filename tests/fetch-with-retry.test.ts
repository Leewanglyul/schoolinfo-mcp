// 타임아웃·재시도·키 마스킹 래퍼 단위테스트 — 외부 네트워크 없이 globalThis.fetch를 스텁한다.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry, maskSensitiveUrl } from "../src/lib/fetch-with-retry.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("maskSensitiveUrl: apiKey/KEY/oc 값만 가리고 나머지 쿼리는 유지", () => {
  const u = "https://x.go.kr/openApi.do?apiKey=SECRET123&apiType=0&KEY=abc&oc=me";
  const m = maskSensitiveUrl(u);
  assert.ok(!m.includes("SECRET123") && !m.includes("abc") && !m.includes("=me"), m);
  assert.ok(m.includes("apiType=0"), m);
  assert.equal(maskSensitiveUrl(""), "");
});

test("fetchWithRetry: 503 뒤 200이면 재시도해서 성공을 반환", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1 ? new Response("busy", { status: 503 }) : new Response("ok", { status: 200 });
  }) as typeof fetch;
  const res = await fetchWithRetry("https://example.test/", {}, { retries: 2, retryDelay: 1 });
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test("fetchWithRetry: 404처럼 재시도 대상이 아닌 상태는 즉시 그대로 반환", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response("nope", { status: 404 }); }) as typeof fetch;
  const res = await fetchWithRetry("https://example.test/", {}, { retries: 3, retryDelay: 1 });
  assert.equal(res.status, 404);
  assert.equal(calls, 1);
});

test("fetchWithRetry: 재시도 소진 시 마지막 응답을 반환(호출부가 상태로 판단)", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response("busy", { status: 503 }); }) as typeof fetch;
  const res = await fetchWithRetry("https://example.test/", {}, { retries: 2, retryDelay: 1 });
  assert.equal(res.status, 503);
  assert.equal(calls, 3);
});

test("fetchWithRetry: 타임아웃은 라벨이 붙은 한국어 메시지로 실패하고 URL(키)을 노출하지 않는다", async () => {
  globalThis.fetch = ((_: any, init: RequestInit) =>
    new Promise((_, reject) => {
      init.signal!.addEventListener("abort", () => {
        const e = new Error("aborted"); e.name = "AbortError"; reject(e);
      });
    })) as typeof fetch;
  await assert.rejects(
    fetchWithRetry("https://example.test/?apiKey=SECRET", {}, { timeout: 5, retries: 0, label: "학교알리미" }),
    (e: Error) => e.message.includes("학교알리미") && e.message.includes("시간이 초과") && !e.message.includes("SECRET")
  );
});

test("fetchWithRetry: 네트워크 예외 메시지의 키는 마스킹된다", async () => {
  globalThis.fetch = (async () => { throw new Error("connect failed https://x/?apiKey=SECRET"); }) as typeof fetch;
  await assert.rejects(
    fetchWithRetry("https://example.test/", {}, { retries: 0 }),
    (e: Error) => !e.message.includes("SECRET") && e.message.includes("apiKey=***")
  );
});
