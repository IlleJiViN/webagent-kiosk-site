export const PRICE = Object.freeze({
  drink: Object.freeze({
    '아메리카노': 3500,
    '카페라떼': 4000,
    '카페모카': 4500,
    '바닐라라떼': 4500,
    '녹차라떼': 4500
  }),
  size: Object.freeze({
    'S': 0,
    'M': 500,
    'L': 1000
  }),
  options: Object.freeze({
    '샷 추가': 500,
    '크림 추가': 500,
    '시럽 추가': 300,
    '디카페인': 0
  })
});

/**
 * Calculates the total price for an order.
 * Returns 0 if drink is not selected or invalid.
 */
export function calculateTotal({ drink, size = 'M', options = [], quantity = 1 } = {}) {
  if (typeof drink !== 'string' || !Object.hasOwn(PRICE.drink, drink)) {
    return 0;
  }

  if (typeof quantity === 'string' && quantity.trim() === '') {
    return 0;
  }
  const numQty = Number(quantity);
  if (!Number.isInteger(numQty) || numQty < 1 || numQty > 20) {
    return 0;
  }

  if (typeof size !== 'string' || !Object.hasOwn(PRICE.size, size)) {
    return 0;
  }

  if (!Array.isArray(options)) {
    return 0;
  }

  let optionsPrice = 0;
  for (const opt of options) {
    if (typeof opt !== 'string' || !Object.hasOwn(PRICE.options, opt)) {
      return 0;
    }
    optionsPrice += PRICE.options[opt];
  }

  const drinkPrice = PRICE.drink[drink];
  const sizePrice = PRICE.size[size];

  return (drinkPrice + sizePrice + optionsPrice) * numQty;
}

/**
 * Validates order inputs before submission.
 */
export function validateOrder({ customerName, drink, size, options = [], quantity, requests = '' } = {}) {
  if (typeof customerName !== 'string' || customerName.trim() === '') {
    return { valid: false, field: 'customerName', message: '이름을 입력해주세요' };
  }
  if (customerName.length > 60) {
    return { valid: false, field: 'customerName', message: '이름은 최대 60자까지 입력 가능합니다.' };
  }

  if (typeof drink !== 'string' || !Object.hasOwn(PRICE.drink, drink)) {
    return { valid: false, field: 'drink', message: '음료를 선택해주세요.' };
  }

  if (typeof size !== 'string' || !Object.hasOwn(PRICE.size, size)) {
    return { valid: false, field: 'size', message: '사이즈를 올바르게 선택해주세요.' };
  }

  if (!Array.isArray(options)) {
    return { valid: false, field: 'options', message: '옵션 목록이 올바르지 않습니다.' };
  }

  const optionSet = new Set();
  for (const opt of options) {
    if (typeof opt !== 'string' || !Object.hasOwn(PRICE.options, opt)) {
      return { valid: false, field: 'options', message: '올바르지 않은 옵션이 포함되어 있습니다.' };
    }
    if (optionSet.has(opt)) {
      return { valid: false, field: 'options', message: '중복된 옵션이 선택되었습니다.' };
    }
    optionSet.add(opt);
  }

  if (typeof quantity === 'string' && quantity.trim() === '') {
    return { valid: false, field: 'quantity', message: '수량을 입력해주세요.' };
  }
  const numQty = Number(quantity);
  if (!Number.isInteger(numQty) || numQty < 1 || numQty > 20) {
    return { valid: false, field: 'quantity', message: '수량은 1개 이상 20개 이하의 정수여야 합니다.' };
  }

  if (typeof requests !== 'string') {
    return { valid: false, field: 'requests', message: '요청사항 형식이 올바르지 않습니다.' };
  }
  if (requests.length > 500) {
    return { valid: false, field: 'requests', message: '요청사항은 최대 500자까지 입력 가능합니다.' };
  }

  return { valid: true };
}

/**
 * Creates the order payload adhering strictly to the schema.
 * Note: totalPrice argument is ignored; the price is always computed from choices.
 */
export function createOrderPayload({
  id,
  customerName,
  drink,
  size,
  options = [],
  quantity = 1,
  requests = ''
} = {}) {
  const finalId = id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '');
  const cleanName = typeof customerName === 'string' ? customerName.trim() : '';
  const cleanQty = Number(quantity);
  const cleanOpts = Array.isArray(options) ? [...options] : [];
  const cleanRequests = typeof requests === 'string' ? requests.trim() : '';
  const calculatedTotal = calculateTotal({
    drink,
    size,
    options: cleanOpts,
    quantity: cleanQty
  });

  return {
    id: finalId,
    customer_name: cleanName,
    drink,
    size,
    options: cleanOpts,
    quantity: cleanQty,
    requests: cleanRequests,
    total_price: calculatedTotal
  };
}

/**
 * Decodes the role from a JWT token. Returns role string or null.
 */
function getJwtRole(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    let jsonStr = '';
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(base64Url, 'base64url').toString('utf-8');
    } else if (typeof atob === 'function') {
      jsonStr = atob(padded);
    }
    if (jsonStr) {
      const decoded = JSON.parse(jsonStr);
      return decoded?.role ?? null;
    }
  } catch {
    // parse failed
  }
  return null;
}

/**
 * Validates the cafe configuration.
 * - supabaseUrl must be HTTPS, origin matching ^[a-z0-9-]+\.supabase\.co$
 * - pathname must be '/' or empty, no search/hash/auth
 * - publishableKey must start with 'sb_publishable_' or be a JWT with role === 'anon'
 */
export function isConfigValid(config) {
  if (!config || typeof config !== 'object') return false;
  const { supabaseUrl, publishableKey } = config;
  if (!supabaseUrl || typeof supabaseUrl !== 'string') return false;
  if (!publishableKey || typeof publishableKey !== 'string') return false;

  let parsed;
  try {
    parsed = new URL(supabaseUrl.trim());
  } catch {
    return false;
  }

  if (
    parsed.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
    parsed.port ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    return false;
  }

  const trimmedKey = publishableKey.trim();
  const isSbPublishable = trimmedKey.startsWith('sb_publishable_');
  const isAnonJwt = getJwtRole(trimmedKey) === 'anon';

  return isSbPublishable || isAnonJwt;
}

/**
 * Pure helper for submitting order to Supabase PostgREST endpoint.
 */
export async function submitOrder({
  supabaseUrl,
  publishableKey,
  payload,
  signal,
  isRetry = false
}) {
  if (!isConfigValid({ supabaseUrl, publishableKey })) {
    throw new Error('CONFIG_INVALID');
  }

  const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
  const cleanKey = publishableKey.trim();
  const endpoint = `${cleanUrl}/rest/v1/cafe_menu03`;

  const headers = {
    'apikey': cleanKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  if (!cleanKey.startsWith('sb_publishable_')) {
    headers['Authorization'] = `Bearer ${cleanKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  });

  // An inserted row is confirmed by PostgREST's 201 Created response.
  if (response.status === 201) {
    return { success: true, payload };
  }

  // 409 Conflict handling for idempotent retry
  if (response.status === 409 && isRetry) {
    let bodyJson = null;
    try {
      bodyJson = await response.json();
    } catch {
      // not json
    }

    if (
      bodyJson &&
      bodyJson.code === '23505' &&
      typeof bodyJson.message === 'string' &&
      bodyJson.message.includes('cafe_menu03_pkey')
    ) {
      return { success: true, payload, idempotencyConfirmed: true };
    }
  }

  let errorDetails = '';
  try {
    errorDetails = await response.text();
  } catch {
    // ignore
  }

  const error = new Error(`주문 요청 실패 (${response.status})`);
  error.status = response.status;
  error.details = errorDetails;
  throw error;
}
