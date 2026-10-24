// HTTP 서버의 보안 보조 로직(rate limit 키·MCP 인증) + MCP 응답 상한 단위테스트. 서버를 listen하지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, mcpAuthorized } from "../src/server.js";
import { capText, MAX_TOOL_TEXT } from "../src/mcpServer.js";

const req = (headers: Record<string, string>, remote = "10.0.0.1") =>
  ({ headers, socket: { remoteAddress: remote } }) as any;

test("clientIp: fly-client-ip가 있으면 최우선", () => {
  assert.equal(clientIp(req({ "fly-client-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }), false), "1.2.3.4");
});

test("clientIp: Vercel에서는 x-real-ip를 신뢰하고, 그 외 환경에서는 무시한다", () => {
  const r = req({ "x-real-ip": "5.6.7.8" });
  assert.equal(clientIp(r, true), "5.6.7.8");
  assert.equal(clientIp(r, false), "10.0.0.1");
});

test("clientIp: x-forwarded-for는 어느 환경에서도 신뢰하지 않는다(위조 가능)", () => {
  const r = req({ "x-forwarded-for": "9.9.9.9" });
  assert.equal(clientIp(r, true), "10.0.0.1");
  assert.equal(clientIp(r, false), "10.0.0.1");
});

test("mcpAuthorized: 토큰 미설정이면 공개(항상 허용)", () => {
  assert.equal(mcpAuthorized(undefined, undefined), true);
  assert.equal(mcpAuthorized("Bearer anything", ""), true);
});

test("mcpAuthorized: 토큰 설정 시 정확한 Bearer만 허용", () => {
  assert.equal(mcpAuthorized("Bearer s3cret", "s3cret"), true);
  assert.equal(mcpAuthorized("bearer s3cret", "s3cret"), true);
  assert.equal(mcpAuthorized("Bearer wrong", "s3cret"), false);
  assert.equal(mcpAuthorized("Bearer s3cret-longer", "s3cret"), false);
  assert.equal(mcpAuthorized(undefined, "s3cret"), false);
  assert.equal(mcpAuthorized("Basic s3cret", "s3cret"), false);
});

test("capText: 상한 이하는 그대로, 초과 시 잘라서 안내문을 붙인다", () => {
  assert.equal(capText("짧은 글", "힌트"), "짧은 글");
  const long = "가".repeat(MAX_TOOL_TEXT + 5_000);
  const out = capText(long, "범위를 좁히세요.");
  assert.ok(out.length < long.length);
  // 본문은 정확히 상한까지만 남고 그 뒤에 안내문이 붙는다
  assert.equal(out.slice(0, MAX_TOOL_TEXT), "가".repeat(MAX_TOOL_TEXT));
  assert.notEqual(out[MAX_TOOL_TEXT], "가");
  assert.ok(out.includes("앞부분") && out.includes("범위를 좁히세요."));
});
