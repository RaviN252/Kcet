import { useInView } from '../hooks/useInView';

// Fades + slides a section up into place the first time it scrolls into view.
export default function Reveal({ children, delay = 0, className = '' }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
