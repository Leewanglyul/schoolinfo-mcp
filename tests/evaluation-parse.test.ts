// 평가계획 다운로드/파싱 방어 로직 단위테스트 — 네트워크 없이 HTML 파서와 실패 처리를 검증.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  looksLikeHtml, parseEvaluationDocument, parseFileList, parseSubmissionRounds, extractEvaluationSections,
} from "../src/evaluation.js";

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

test("looksLikeHtml: Content-Type 또는 선두 바이트로 HTML 안내 페이지를 가려낸다", () => {
  assert.equal(looksLikeHtml("text/html; charset=euc-kr", enc("x")), true);
  assert.equal(looksLikeHtml(null, enc("  <!DOCTYPE html><html>")), true);
  assert.equal(looksLikeHtml("application/octet-stream", enc("<html><body>로그인</body>")), true);
  assert.equal(looksLikeHtml("application/octet-stream", enc("PK\u0003\u0004hwpx...")), false);
  assert.equal(looksLikeHtml(null, enc("%PDF-1.7")), false);
});

test("parseEvaluationDocument: 빈 파일은 '빈 파일' 에러", async () => {
  await assert.rejects(parseEvaluationDocument(new ArrayBuffer(0)), /빈 파일/);
});

test("parseEvaluationDocument: 깨진/미지원 파일은 kordoc 사유를 포함한 에러 (예전 '문서 파싱 실패'만 아님)", async () => {
  await assert.rejects(
    parseEvaluationDocument(enc("<html><body>세션이 만료되었습니다</body></html>")),
    (e: Error) => e.message.startsWith("문서 변환 실패:") && e.message.length > "문서 변환 실패:".length
  );
});

test("parseFileList: onclick 핸들러·파일명·크기(KB/MB)를 추출하고 중복 seq를 제거", () => {
  const html = `
    <a href="#" onclick="javascript:getEiFile43('5'); return false;">2026학년도 1학년 평가계획.hwpx(89 KB)</a>
    <a href="#" onclick='getEiFile43("7")'> 2학년 평가계획 (수정).pdf (1.2 MB) </a>
    <a href="#" onclick="getEiFile43('5')">중복.hwp(1 KB)</a>`;
  const files = parseFileList(html);
  assert.equal(files.length, 2);
  assert.deepEqual(files[0], { seq: "5", filename: "2026학년도 1학년 평가계획.hwpx", sizeKB: 89 });
  assert.equal(files[1].seq, "7");
  assert.equal(files[1].filename, "2학년 평가계획 (수정).pdf");
  assert.equal(files[1].sizeKB, Math.round(1.2 * 1024));
});

test("parseFileList: 첨부가 없으면 빈 배열", () => {
  assert.deepEqual(parseFileList("<div>첨부파일이 없습니다</div>"), []);
});

test("parseSubmissionRounds: 자료제출일 드롭다운에서 연도/차수/선택 여부를 분해", () => {
  const html = `<select id="select_trans_dt" name="x">
    <option value="20251">(1차) 2025년 04월</option>
    <option value="20253" selected>(3차) 2025년 09월</option>
  </select>`;
  const r = parseSubmissionRounds(html);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { year: 2025, chasu: 1, label: "(1차) 2025년 04월", selected: false });
  assert.equal(r[1].chasu, 3);
  assert.equal(r[1].selected, true);
  assert.deepEqual(parseSubmissionRounds("<div/>"), []);
});

test("extractEvaluationSections: 키워드가 든 블록만 추출", () => {
  const md = "머리말\n\n수행평가 40% 반영\n\n관련 없는 문단\n\n성취기준 [9국01-02]";
  const hits = extractEvaluationSections(md);
  assert.deepEqual(hits, ["수행평가 40% 반영", "성취기준 [9국01-02]"]);
});
