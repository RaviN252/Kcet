const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:not-configured] To: ${to} | Subject: ${subject}\n${html}`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}

function sendPaymentSuccessEmail(user, subjectRow, payment) {
  return sendEmail({
    to: user.email,
    subject: 'Payment successful — access unlocked',
    html: `<p>Hi ${user.name},</p>
      <p>Your payment of ₹${payment.amount} for <strong>${subjectRow.name}</strong> was successful.
      You can now view every paper under this subject in your account.</p>
      <p>Payment ID: ${payment.gateway_payment_id || 'manual'}</p>`,
  });
}

function sendPaymentFailureEmail(user, subjectRow, payment) {
  return sendEmail({
    to: user.email,
    subject: 'Payment failed / cancelled',
    html: `<p>Hi ${user.name},</p>
      <p>Your payment of ₹${payment.amount} for <strong>${subjectRow.name}</strong> was
      ${payment.status}. No amount has been unlocked. Please try again.</p>`,
  });
}

function sendAdminPaymentClaimEmail(adminEmail, user, subjectRow, payment) {
  return sendEmail({
    to: adminEmail,
    subject: `UPI payment claim — ${subjectRow.name} (₹${payment.amount})`,
    html: `<p>A student says they paid via UPI. Please verify and approve or reject it from the
      Manual Payment page.</p>
      <p><strong>Student:</strong> ${user.name} — ${user.email} — ${user.phone}</p>
      <p><strong>Subject:</strong> ${subjectRow.name}</p>
      <p><strong>Amount claimed:</strong> ₹${payment.amount}</p>
      <p><strong>UPI reference (UTR):</strong> ${payment.gateway_payment_id}</p>`,
  });
}

function sendPaymentReminderEmail(user, subjectRow) {
  const payUrl = `${process.env.CLIENT_URL || ''}/papers/${subjectRow.id}`;
  return sendEmail({
    to: user.email,
    subject: `Did you finish paying for ${subjectRow.name}?`,
    html: `<p>Hi ${user.name},</p>
      <p>You started buying <strong>${subjectRow.name}</strong> (₹${subjectRow.price}) but haven't
      confirmed your payment yet.</p>
      <p>If you've already paid via UPI, go back and submit your transaction reference (UTR) here:</p>
      <p><a href="${payUrl}">${payUrl}</a></p>
      <p>If you haven't paid, no action is needed — you can complete it whenever you're ready.</p>`,
  });
}

function sendPasswordResetEmail(user, token) {
  const resetUrl = `${process.env.CLIENT_URL || ''}/reset-password?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: 'Reset your password',
    html: `<p>Hi ${user.name || ''},</p>
      <p>We received a request to reset your password. This link expires in 5 minutes:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, you can ignore this email.</p>`,
  });
}

module.exports = {
  sendEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
  sendAdminPaymentClaimEmail,
  sendPaymentReminderEmail,
  sendPasswordResetEmail,
};
