import {
  calculateTotal,
  validateOrder,
  createOrderPayload,
  isConfigValid,
  submitOrder
} from './domain.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const orderForm = document.getElementById('orderForm');
  const formCard = document.getElementById('formCard');
  const customerNameInput = document.getElementById('customerName');
  const drinkSelect = document.getElementById('drink');
  const sizeRadios = document.querySelectorAll('input[name="size"]');
  const optionCheckboxes = document.querySelectorAll('input[name="options"]');
  const quantityInput = document.getElementById('quantity');
  const requestsTextarea = document.getElementById('requests');
  const totalPriceElem = document.getElementById('totalPrice');
  const submitBtn = document.getElementById('submitBtn');
  const configNotice = document.getElementById('configNotice');
  const submitError = document.getElementById('submitError');
  const receiptArea = document.getElementById('receiptArea');

  let isSubmitting = false;
  let currentPendingPayload = null;
  let lastSubmittedSignature = null;

  // Retrieve current form state
  function getFormValues() {
    const selectedSize = document.querySelector('input[name="size"]:checked')?.value || 'M';
    const selectedOptions = Array.from(optionCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    return {
      customerName: customerNameInput.value,
      drink: drinkSelect.value,
      size: selectedSize,
      options: selectedOptions,
      quantity: quantityInput.value,
      requests: requestsTextarea.value
    };
  }

  // Create signature to detect form modifications
  function getSignature(values) {
    return JSON.stringify({
      customerName: values.customerName.trim(),
      drink: values.drink,
      size: values.size,
      options: values.options.slice().sort(),
      quantity: Number(values.quantity),
      requests: values.requests.trim()
    });
  }

  // Live total calculation
  function updateTotal() {
    const values = getFormValues();
    const total = calculateTotal({
      drink: values.drink,
      size: values.size,
      options: values.options,
      quantity: values.quantity
    });

    totalPriceElem.textContent = `${total.toLocaleString('ko-KR')}원`;
    return total;
  }

  // Invalidate pending payload when user modifies fields (ignored while submitting)
  function onFieldChange() {
    if (isSubmitting) return;

    const values = getFormValues();
    const currentSig = getSignature(values);
    if (currentPendingPayload && currentSig !== lastSubmittedSignature) {
      currentPendingPayload = null;
      lastSubmittedSignature = null;
    }
    if (submitError.style.display !== 'none') {
      submitError.style.display = 'none';
      submitError.textContent = '';
    }
    updateTotal();
  }

  // Set form controls enabled/disabled during submission
  function setSubmittingState(submitting) {
    isSubmitting = submitting;
    submitBtn.disabled = submitting;
    customerNameInput.disabled = submitting;
    drinkSelect.disabled = submitting;
    sizeRadios.forEach((r) => { r.disabled = submitting; });
    optionCheckboxes.forEach((cb) => { cb.disabled = submitting; });
    quantityInput.disabled = submitting;
    requestsTextarea.disabled = submitting;

    if (submitting) {
      submitBtn.textContent = '주문 접수 중...';
    } else {
      submitBtn.textContent = '주문하기';
    }
  }

  // Check configuration validity on initialization
  function checkConfig() {
    const config = window.CAFE_CONFIG;
    const valid = isConfigValid(config);

    if (!valid) {
      submitBtn.disabled = true;
      configNotice.style.display = 'block';
    } else {
      configNotice.style.display = 'none';
      if (!isSubmitting) {
        submitBtn.disabled = false;
      }
    }
    return valid;
  }

  // Render receipt safely using createElement and textContent
  function renderReceipt(payload) {
    receiptArea.replaceChildren();

    const title = document.createElement('h2');
    title.className = 'receipt-title';
    title.textContent = '주문이 접수되었습니다!';
    receiptArea.appendChild(title);

    const list = document.createElement('div');
    list.className = 'receipt-list';

    const items = [
      { label: '주문자', value: payload.customer_name },
      { label: '음료', value: payload.drink },
      { label: '사이즈', value: payload.size },
      { label: '추가 옵션', value: payload.options.length > 0 ? payload.options.join(', ') : '없음' },
      { label: '수량', value: `${payload.quantity}개` },
      { label: '주문 금액', value: `${payload.total_price.toLocaleString('ko-KR')}원`, highlight: true },
      { label: '요청사항', value: payload.requests || '없음' },
      { label: '주문 번호', value: payload.id, uuid: true }
    ];

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'receipt-row';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'receipt-label';
      labelSpan.textContent = item.label;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'receipt-value';
      if (item.highlight) valueSpan.classList.add('highlight');
      if (item.uuid) valueSpan.classList.add('uuid');
      valueSpan.textContent = item.value;

      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      list.appendChild(row);
    });

    receiptArea.appendChild(list);

    const newOrderBtn = document.createElement('button');
    newOrderBtn.type = 'button';
    newOrderBtn.id = 'newOrderBtn';
    newOrderBtn.className = 'new-order-btn';
    newOrderBtn.textContent = '새 주문';
    newOrderBtn.addEventListener('click', () => {
      receiptArea.style.display = 'none';
      receiptArea.replaceChildren();

      orderForm.reset();
      const defaultSize = document.getElementById('sizeM');
      if (defaultSize) defaultSize.checked = true;

      currentPendingPayload = null;
      lastSubmittedSignature = null;
      submitError.style.display = 'none';
      submitError.textContent = '';

      setSubmittingState(false);
      updateTotal();
      formCard.style.display = 'block';
      checkConfig();
    });

    receiptArea.appendChild(newOrderBtn);

    // Switch view
    formCard.style.display = 'none';
    receiptArea.style.display = 'block';
  }

  // Event Listeners for inputs
  customerNameInput.addEventListener('input', onFieldChange);
  drinkSelect.addEventListener('change', onFieldChange);
  sizeRadios.forEach((r) => r.addEventListener('change', onFieldChange));
  optionCheckboxes.forEach((cb) => cb.addEventListener('change', onFieldChange));
  quantityInput.addEventListener('input', onFieldChange);
  requestsTextarea.addEventListener('input', onFieldChange);

  // Form submit handler
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Guard against duplicate / concurrent submit events
    if (isSubmitting) {
      return;
    }

    // 1. Name empty validation with required alert and focus
    const rawName = customerNameInput.value.trim();
    if (rawName === '') {
      alert('이름을 입력해주세요');
      customerNameInput.focus();
      return;
    }

    const values = getFormValues();
    const validation = validateOrder({
      customerName: values.customerName,
      drink: values.drink,
      size: values.size,
      options: values.options,
      quantity: values.quantity,
      requests: values.requests
    });

    if (!validation.valid) {
      alert(validation.message);
      if (validation.field === 'customerName') customerNameInput.focus();
      else if (validation.field === 'drink') drinkSelect.focus();
      else if (validation.field === 'quantity') quantityInput.focus();
      return;
    }

    // Check config
    if (!checkConfig()) {
      return;
    }

    // Idempotency & UUID handling: maintain same UUID on retry, generate new on edit
    const currentSig = getSignature(values);
    let isRetry = false;

    if (currentPendingPayload && currentSig === lastSubmittedSignature) {
      isRetry = true;
    } else {
      isRetry = false;
      const uuid = crypto.randomUUID();
      currentPendingPayload = createOrderPayload({
        id: uuid,
        customerName: values.customerName,
        drink: values.drink,
        size: values.size,
        options: values.options,
        quantity: values.quantity,
        requests: values.requests
      });
      lastSubmittedSignature = currentSig;
    }

    // Capture frozen snapshot of payload for this submission run
    const submittedPayload = currentPendingPayload;

    // Lock controls to prevent race conditions & double submission
    setSubmittingState(true);
    submitError.style.display = 'none';
    submitError.textContent = '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      const config = window.CAFE_CONFIG;
      await submitOrder({
        supabaseUrl: config.supabaseUrl,
        publishableKey: config.publishableKey,
        payload: submittedPayload,
        signal: controller.signal,
        isRetry
      });

      clearTimeout(timeoutId);
      renderReceipt(submittedPayload);
    } catch (err) {
      clearTimeout(timeoutId);

      const isTimeout = err.name === 'AbortError' || controller.signal.aborted;
      const errorMsg = isTimeout
        ? '요청 시간이 초과되었습니다 (15초). 다시 시도해주세요.'
        : (err.message || '주문 요청에 실패했습니다. 다시 시도해주세요.');

      submitError.textContent = errorMsg;
      submitError.style.display = 'block';
    } finally {
      setSubmittingState(false);
      checkConfig();
    }
  });

  // Initial setup
  checkConfig();
  updateTotal();
});
