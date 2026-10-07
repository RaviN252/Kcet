import { useState } from 'react';

const SECTIONS = [
  {
    title: 'Information we collect',
    body: (
      <>
        <p>During signup and use of the platform, we collect:</p>
        <ul className="list-disc! space-y-1 pl-5! marker:text-brand">
          <li>Your name, phone number, and email address</li>
          <li>A user ID and password (stored securely, never in plain text)</li>
          <li>Records of the papers you purchase and view</li>
          <li>Payment and transaction details processed through our payment partner</li>
        </ul>
      </>
    ),
  },
  {
    title: 'How we use your information',
    body: (
      <>
        <p>We use your information to:</p>
        <ul className="list-disc! space-y-1 pl-5! marker:text-brand">
          <li>Create and manage your account</li>
          <li>Process payments and unlock the papers you purchase</li>
          <li>Send you transactional emails, such as payment confirmations or failures</li>
          <li>Personalize the watermark shown on papers you view, for traceability</li>
          <li>Respond to support requests</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Payment information',
    body: (
      <p>
        All payments are processed through a secure, third-party payment gateway. We do not store
        your card, UPI, or banking details on our servers — this information is handled directly
        by our payment partner in line with their own security standards.
      </p>
    ),
  },
  {
    title: 'Cookies and local storage',
    body: (
      <p>
        We use browser local storage to keep you signed in between visits. We do not use
        third-party advertising or tracking cookies.
      </p>
    ),
  },
  {
    title: 'Data sharing',
    body: (
      <p>
        We do not sell your personal information. We share information only with the service
        providers necessary to run the platform — such as our payment gateway and email delivery
        provider — solely to complete the actions you request.
      </p>
    ),
  },
  {
    title: 'Data security',
    body: (
      <p>
        Passwords are hashed and never stored in plain text. Access to uploaded content and your
        purchase history is restricted to your account and platform administrators.
      </p>
    ),
  },
  {
    title: 'Your rights',
    body: (
      <p>
        You may request access to, correction of, or deletion of your personal information at any
        time by contacting our support team.
      </p>
    ),
  },
  {
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy from time to time. Continued use of the platform after changes
        are posted means you accept the updated policy.
      </p>
    ),
  },
  {
    title: 'Contact us',
    body: (
      <p>
        If you have any questions about this policy or how your data is handled, please reach out
        through our support contact — email us at{' '}
        <a href="mailto:challengingstudycentre@gmail.com">challengingstudycentre@gmail.com</a> or
        call <a href="tel:+919113807490">+91 9113807490</a>.
      </p>
    ),
  },
];

function PolicyRow({ number, title, body, open, onToggle }) {
  return (
    <div
      className={`rounded-xl px-5 transition-colors duration-200 ${
        open ? 'bg-brand-light py-5' : 'border-b border-black/8 py-4'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex! w-full items-center justify-between! gap-6 border-0! bg-transparent! p-0! text-left font-semibold text-[#121026]! shadow-none! transition-none hover:transform-none! hover:shadow-none!"
      >
        <span>
          {number}. {title}
        </span>
        <span className={`shrink-0 text-sm text-[#8f8da3]! transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] mt-3' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 pr-8 text-[#2c2a33]">{body}</div>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const [openSet, setOpenSet] = useState(() => new Set([0, 1]));
  const updatedOn = new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  function toggle(i) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="page">
      <div className="container-medium">
        <h1 className="border-b border-black/10 pb-5">Privacy Policy</h1>

        <div className="mt-6 rounded-xl border-l-4 border-brand bg-brand-light px-6 py-5">
          <p className="mb-2 font-semibold text-[#121026]">Last updated: {updatedOn}</p>
          <p className="mb-0! text-[#2c2a33]">
            We respect your privacy and are committed to protecting the personal information you
            share with us. This policy describes what information we collect, why we collect it,
            and how we use it when you use our platform to browse, purchase, and read exam
            preparation papers.
          </p>
        </div>

        <div className="mt-8 space-y-1">
          {SECTIONS.map((s, i) => (
            <PolicyRow
              key={s.title}
              number={i + 1}
              title={s.title}
              body={s.body}
              open={openSet.has(i)}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
