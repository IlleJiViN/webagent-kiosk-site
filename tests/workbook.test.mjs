import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateTotal, validateOrder, createOrderPayload, isConfigValid, submitOrder} from '../workbook/domain.mjs';
import {publicConfigSource} from '../scripts/build-workbook.mjs';

const config = {supabaseUrl: 'https://exampleproject.supabase.co', publishableKey: 'sb_publishable_test_only'};
const base = {customerName: '워크북 검증용', drink: '카페라떼', size: 'M', options: ['샷 추가'], quantity: 1, requests: ''};
const id = '17400cc8-47d7-4b9f-8ad6-26ca037fdd47';

test('workbook prices, quantity, free decaf, and empty drink', () => {
  assert.equal(calculateTotal({...base}), 5000);
  assert.equal(calculateTotal({drink:'아메리카노',size:'S',options:[],quantity:2}), 7000);
  assert.equal(calculateTotal({drink:'카페모카',size:'L',options:['시럽 추가'],quantity:1}), 5800);
  assert.equal(calculateTotal({...base, options:['디카페인']}), 4500);
  assert.equal(calculateTotal({...base,drink:''}), 0);
});

test('invalid names, quantities, unsupported and duplicate options are rejected', () => {
  assert.equal(validateOrder(base).valid, true);
  assert.equal(validateOrder({...base,customerName:'   '}).message, '이름을 입력해주세요');
  for (const quantity of [0,21,1.5,'',NaN,Infinity])
    assert.equal(validateOrder({...base,quantity}).valid, false, `quantity ${quantity}`);
  for (const options of [['샷 추가','샷 추가'], ['할인'], ['toString'], '샷 추가', null])
    assert.equal(validateOrder({...base,options}).valid, false, `options ${options}`);
  for (const drink of ['toString','constructor','없는 메뉴'])
    assert.equal(validateOrder({...base,drink}).valid, false, `drink ${drink}`);
  for (const size of ['toString','constructor','XL'])
    assert.equal(validateOrder({...base,size}).valid, false, `size ${size}`);
  assert.equal(validateOrder({...base,requests:'가'.repeat(501)}).valid, false);
  assert.equal(validateOrder({...base,requests:123}).valid, false);
});

test('payload is normalized and price is computed from choices', () => {
  const payload = createOrderPayload({...base,id,customerName:'  워크북 검증용  ',quantity:'2',totalPrice:1});
  assert.equal(payload.id,id);
  assert.equal(payload.customer_name,'워크북 검증용');
  assert.equal(payload.quantity,2);
  assert.equal(payload.total_price,10000);
  assert.deepEqual(payload.options,['샷 추가']);
});

test('only public Supabase credentials and project HTTPS origins are accepted', () => {
  assert.equal(isConfigValid(config),true);
  for (const publishableKey of ['', 'sb_secret_do_not_use', 'random-token',
    `x.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.x`])
    assert.equal(isConfigValid({...config,publishableKey}),false);
  for (const supabaseUrl of ['http://exampleproject.supabase.co','https://example.org','https://exampleproject.supabase.co/path','https://a:b@exampleproject.supabase.co'])
    assert.equal(isConfigValid({...config,supabaseUrl}),false, supabaseUrl);
  assert.throws(()=>publicConfigSource({SUPABASE_URL:config.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:'sb_secret_forbidden'}));
  assert.match(publicConfigSource({SUPABASE_URL:config.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:config.publishableKey}), /window.CAFE_CONFIG/);
});

test('POST uses minimal-return insertion and correct public-key headers', async (t) => {
  let sent;
  t.mock.method(globalThis,'fetch', async (url,opts)=>{ sent={url,opts}; return new Response(null,{status:201}); });
  const payload=createOrderPayload({...base,id});
  assert.equal((await submitOrder({...config,payload})).success,true);
  assert.equal(sent.url,`${config.supabaseUrl}/rest/v1/cafe_menu03`);
  assert.equal(sent.opts.method,'POST');
  assert.equal(sent.opts.headers.Prefer,'return=minimal');
  assert.equal(sent.opts.headers.Authorization,undefined);
  assert.deepEqual(JSON.parse(sent.opts.body),payload);
  const anon=`x.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.x`;
  await submitOrder({...config,publishableKey:anon,payload});
  assert.equal(sent.opts.headers.Authorization,`Bearer ${anon}`);
});

test('a failed DB response cannot produce success', async (t) => {
  t.mock.method(globalThis,'fetch', async()=>new Response(JSON.stringify({code:'42501'}),{status:403}));
  await assert.rejects(submitOrder({...config,payload:createOrderPayload({...base,id})}));
});

test('provisional gateway responses cannot be mistaken for a stored order', async (t) => {
  let status=202;
  t.mock.method(globalThis,'fetch',async()=>new Response(null,{status}));
  const payload=createOrderPayload({...base,id});
  await assert.rejects(submitOrder({...config,payload}));
  status=200;
  await assert.rejects(submitOrder({...config,payload}));
});

test('only same-ID retry conflicts confirm an already saved order', async (t) => {
  let constraint='cafe_menu03_pkey';
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({code:'23505',message:`duplicate key value violates unique constraint "${constraint}"`}),{status:409}));
  const payload=createOrderPayload({...base,id});
  await assert.rejects(submitOrder({...config,payload,isRetry:false}));
  assert.equal((await submitOrder({...config,payload,isRetry:true})).idempotencyConfirmed,true);
  constraint='some_other_key';
  await assert.rejects(submitOrder({...config,payload,isRetry:true}));
});

test('network failures and cancellation are propagated', async (t) => {
  t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Network unavailable');});
  await assert.rejects(submitOrder({...config,payload:createOrderPayload({...base,id})}));
});
