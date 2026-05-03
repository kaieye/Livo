/**
 * The single short prompt the connection-test flow sends to the model.
 *
 * Kept ≤ 32 tokens of expected output so that even strict free-tier quotas
 * don't reject the probe; the wording asks the model to identify itself,
 * which gives us a meaningful success signal beyond "HTTP 200 + empty body".
 */

export const CONNECTION_TEST_PROMPT: string =
  '简短告诉我你是什么公司的什么模型、是什么版本，不超过15个字'

export const CONNECTION_TEST_MAX_TOKENS = 32

export const CONNECTION_TEST_CONNECT_TIMEOUT_MS = 10000

export const CONNECTION_TEST_READ_TIMEOUT_MS = 15000

export const CONNECTION_TEST_MAX_ATTEMPTS = 2

export const CONNECTION_TEST_RETRY_DELAY_MS = 900

export const CONNECTION_TEST_EMPTY_RETRY_DELAY_MS = 700
