import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';

const FAQS = [
  {
    q: 'Which exams are covered?',
    a: 'We cover papers for TET, PSTR, GPSTR, HSTR, and other competitive teaching and eligibility exams. New subjects and papers are added regularly.',
  },
  {
    q: 'Do I need to sign up to browse papers?',
    a: 'No. Anyone can browse the full catalog by subject without creating an account. You only need to sign up when you\'re ready to purchase and unlock a paper.',
  },
  {
    q: 'How do I purchase a paper?',
    a: 'Open any paper\'s detail page and click "Buy & unlock." You\'ll be taken through a secure checkout, and the paper unlocks in your account the moment payment is confirmed.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'We support UPI, cards, net banking, and popular wallets through our secure payment partner.',
  },
  {
    q: 'What if my payment fails or I\'m charged but don\'t get access?',
    a: 'If a payment fails, no amount is unlocked and you can safely try again. If you believe you were charged but didn\'t get access, please contact our support team with your payment details.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Since access is unlocked instantly after payment, purchases are generally final. If you believe there\'s been an error, reach out to support and we\'ll review it.',
  },
  {
    q: 'Can I download the PDF?',
    a: 'No — papers are shown in a protected, view-only reader in your browser to prevent unauthorized sharing. Right-click, printing, and downloading are disabled.',
  },
  {
    q: 'Why does the paper have my name on it?',
    a: 'Each page you view carries a light watermark with your name and phone number. This keeps content traceable and helps us keep prices fair for everyone.',
  },
  {
    q: 'I forgot my password. What do I do?',
    a: 'Use the "Forgot password?" link on the login page. You\'ll receive a reset link by email to set a new password.',
  },
  {
    q: 'How do I contact support?',
    a: 'Reach out to us through the contact details on our Privacy Policy page, and our team will get back to you as soon as possible.',
  },
];

function FaqItem({ item, open, onToggle, delay }) {
  return (
    <Reveal delay={delay}>
      <div
        className={`rounded-3xl border bg-white p-2 transition-all duration-300 ${
          open ? 'border-transparent shadow-lg' : 'border-black/6 shadow-sm hover:shadow-md'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex! w-full items-start justify-between! gap-6 rounded-2xl border-0! bg-transparent! px-6 py-5 text-left text-lg font-semibold text-[#121026]! shadow-none! transition-colors hover:transform-none! hover:shadow-none!"
        >
          <span>{item.q}</span>
          <span
            className={`relative mt-1 h-6 w-6 shrink-0 text-[#121026] transition-transform duration-300 ${
              open ? 'rotate-45' : ''
            }`}
          >
            <span className="absolute top-1/2 left-1/2 h-[2px] w-6 -translate-x-1/2 -translate-y-1/2 bg-current" />
            <span className="absolute top-1/2 left-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-current" />
          </span>
        </button>
        <div
          className={`grid transition-all duration-300 ease-out ${
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <p className="px-6 pb-6 text-base text-[#666478]">{item.a}</p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function FaqPage() {
  const [openKeys, setOpenKeys] = useState(() => new Set([0]));

  function toggle(i) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-light to-[#f8f8fb] px-6 py-16 sm:py-24">
        <div
          aria-hidden="true"
          className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl animate-float-slow"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-accent/15 blur-3xl animate-float"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="badge badge-accent">Help Center</span>
          <h1 className="mt-4 text-5xl!">FAQs.</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-[#666478]">
            Everything you need to know about browsing, buying, and reading papers.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-5">
          {FAQS.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openKeys.has(i)}
              onToggle={() => toggle(i)}
              delay={Math.min(i, 6) * 40}
            />
          ))}
        </div>

        <Reveal delay={100} className="mt-16">
          <div className="cta-band">
            <div>
              <h2>Still have questions?</h2>
              <p className="muted">Can't find the answer you're looking for? Check our Privacy Policy or reach out.</p>
            </div>
            <Link to="/privacy-policy" className="btn btn-lg btn-shine">
              Privacy Policy
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
