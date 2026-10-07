import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from '../components/Reveal';
import './HomePage.css';

const FEATURES = [
  {
    title: 'Browse by subject',
    desc: 'Find the exact past paper you need in seconds, filtered the way you actually study.',
    icon: '🔎',
  },
  {
    title: 'Secure, view-only reader',
    desc: 'Papers render as protected pages in your browser — no raw PDF downloads, no leaks.',
    icon: '🔒',
  },
  {
    title: 'Instant unlock after payment',
    desc: 'Pay securely with Cashfree and get access the moment your payment is confirmed.',
    icon: '⚡',
  },
  {
    title: 'Traceable, watermarked pages',
    desc: 'Every page you view carries your name, so content stays accountable and trustworthy.',
    icon: '🛡️',
  },
];

const STEPS = [
  { step: '01', title: 'Browse', desc: 'Filter the free catalog by subject.' },
  { step: '02', title: 'Unlock', desc: 'Buy the paper you need with a secure one-time payment.' },
  { step: '03', title: 'Study', desc: 'Read it instantly in the protected in-browser viewer.' },
];

const TESTIMONIALS = [
  {
    name: 'Anitha R.',
    quote:
      'I could finally find previous years\' papers all in one place instead of hunting across forums. The practice made a real difference in my preparation.',
  },
  {
    name: 'Manjunath K.',
    quote:
      'Being able to study on my phone without worrying about downloading a huge file was great. Simple, fast, and it just works.',
  },
  {
    name: 'Divya S.',
    quote:
      'Genuinely helpful platform. I cleared my exam this year and I truly believe the past papers played a big part in that.',
  },
  {
    name: 'Ravi Kumar',
    quote:
      'Support was quick to respond when I had a question about my payment. It made me trust the platform a lot more.',
  },
  {
    name: 'Lakshmi N.',
    quote:
      'I recommend this to every aspirant preparing for a competitive exam. Affordable, reliable, and easy to use.',
  },
  {
    name: 'Suresh B.',
    quote:
      'The watermark and secure viewer actually made me feel more confident that this is a serious, well-run platform.',
  },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero-section relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-brand/20 blur-3xl animate-float-slow"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-accent/20 blur-3xl animate-float"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-brand/10 blur-3xl animate-float-slow"
        />

        <div className="hero-inner relative">
          <span className="badge badge-accent animate-fade-in-up">
            TET · PSTR · GPSTR · HSTR Exam Prep
          </span>
          <h1 className="animate-fade-in-up [animation-delay:100ms]">
            Real past question papers, ready when you are.
          </h1>
          <p className="hero-sub animate-fade-in-up [animation-delay:200ms]">
            Browse question papers by subject for free — unlock the ones you need with a secure
            payment, and study them in a protected, distraction-free reader.
          </p>
          <div className="hero-cta animate-fade-in-up [animation-delay:300ms]">
            <Link to="/papers" className="btn btn-lg btn-shine">
              Browse papers
            </Link>
            {!user && (
              <Link to="/signup" className="btn btn-secondary btn-lg">
                Create free account
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="page">
        <div className="container">
          <Reveal>
            <h2 className="center-text">Why aspirants choose us</h2>
          </Reveal>
          <div className="card-grid section-gap">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="card feature-card h-full">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p className="muted">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="section-gap">
            <h2 className="center-text">How it works</h2>
          </Reveal>
          <div className="steps-grid section-gap">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 100}>
                <div className="step-card">
                  <span className="step-number">{s.step}</span>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="section-gap">
            <h2 className="center-text">What aspirants say</h2>
          </Reveal>
          <div className="card-grid section-gap">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 60}>
                <div className="card testimonial-card h-full">
                  <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                  <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                  <p className="testimonial-name">— {t.name}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="section-gap">
            <div className="cta-band">
              <div>
                <h2>Ready to find your paper?</h2>
                <p className="muted">No login needed to browse — sign up only when you're ready to unlock one.</p>
              </div>
              <Link to="/papers" className="btn btn-lg btn-shine">
                Start browsing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
