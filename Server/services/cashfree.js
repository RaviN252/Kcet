function isConfigured() {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

function baseUrl() {
  if (process.env.CASHFREE_BASE_URL) return process.env.CASHFREE_BASE_URL;
  return process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'x-api-version': '2023-08-01',
  };
}

async function createOrder({ orderId, amount, customer, returnUrl }) {
  const res = await fetch(`${baseUrl()}/orders`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: String(customer.id),
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      },
      order_meta: { return_url: returnUrl },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Cashfree order creation failed');
  }
  return data; // { order_id, payment_session_id, order_status, ... }
}

async function getOrder(orderId) {
  const res = await fetch(`${baseUrl()}/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Could not fetch Cashfree order status');
  }
  return data; // { order_status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED', ... }
}

module.exports = { isConfigured, createOrder, getOrder };
