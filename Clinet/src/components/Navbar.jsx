import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import cscLogo from '../assets/csclogo.png';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/login');
  }

  return (
    <header className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <img src={cscLogo} alt="Challenging Study Centre" className="brand-logo" />
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links ${open ? 'nav-links-open' : ''}`}>
          <NavLink to="/papers" onClick={() => setOpen(false)}>
            Papers
          </NavLink>

          {user ? (
            <>
              {user.role !== 'admin' && (
                <>
                  <NavLink to="/my-purchases" onClick={() => setOpen(false)}>
                    My Purchases
                  </NavLink>
                  <NavLink to="/my-account" onClick={() => setOpen(false)}>
                    My Account
                  </NavLink>
                </>
              )}
              {user.role === 'admin' && (
                <NavLink to="/admin/dashboard" onClick={() => setOpen(false)}>
                  Dashboard
                </NavLink>
              )}
              <span className="nav-divider" />
              <span className="nav-user">Hi, {user.name.split(' ')[0]}</span>
              <button type="button" className="btn-secondary" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setOpen(false)}>
                Log in
              </NavLink>
              <NavLink to="/signup" onClick={() => setOpen(false)}>
                Sign up
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
