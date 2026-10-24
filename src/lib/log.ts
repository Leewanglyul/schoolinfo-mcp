// 서버 로그 헬퍼 — 에러 메시지에 섞일 수 있는 인증키(apiKey=/KEY=)를 마스킹한 뒤 기록한다.
//
// fetchWithRetry는 자기 에러만 마스킹하고, 전역 catch·개별 엔드포인트 catch는 console.error에
// 메시지를 그대로 찍었다. 외부 라이브러리가 요청 URL을 메시지에 포함시키는 경우(undici 등)에
// 대비해 모든 서버 로그가 한 경로를 지나게 한다.

import { maskSensitiveUrl } from "./fetch-with-retry.js";

/** 에러 → 안전한 한 줄 메시지 (키 마스킹, Error/문자열/기타 모두 수용) */
export function safeErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
  return maskSensitiveUrl(msg ?? String(e));
}

/** `[tag] message` 형식으로 stderr에 기록 (키 마스킹 적용) */
export function logError(tag: string, e: unknown): void {
  console.error(`[${tag}]`, safeErrorMessage(e));
}

/** 같은 태그는 프로세스 수명 동안 한 번만 기록 — 설정 누락처럼 요청마다 반복되는 경고용 */
const warnedOnce = new Set<string>();
export function warnOnce(tag: string, message: string): void {
  if (warnedOnce.has(tag)) return;
  warnedOnce.add(tag);
  console.error(`[${tag}] ${message}`);
}
