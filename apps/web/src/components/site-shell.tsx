import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from './theme-toggle';

export function Logo() {
  return (
    <Link className="logo" href="/main" aria-label="So Yummy home">
      <span>Y</span>
      <strong>So Yummy</strong>
    </Link>
  );
}
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="header">
        <Logo />
        <nav className="desktopNav" aria-label="Main navigation">
          <Link href="/categories/Beef">Categories</Link>
          <Link href="/add">Add recipes</Link>
          <Link href="/my">My recipes</Link>
          <Link href="/favorite">Favorites</Link>
          <Link href="/shopping-list">Shopping list</Link>
          <Link href="/search" aria-label="Search">
            ⌕
          </Link>
        </nav>
        <details className="mobileNav">
          <summary aria-label="Open navigation">☰</summary>
          <nav aria-label="Mobile navigation">
            <Link href="/categories/Beef">Categories</Link>
            <Link href="/add">Add recipes</Link>
            <Link href="/my">My recipes</Link>
            <Link href="/favorite">Favorites</Link>
            <Link href="/shopping-list">Shopping list</Link>
            <Link href="/search">Search</Link>
          </nav>
        </details>
        <div className="profile">
          <Link href="/account/security" aria-label="Account security">
            TG
          </Link>
          <ThemeToggle />
        </div>
      </header>
      {children}
      <Footer />
    </>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="footerGrid">
        <div>
          <Logo />
          <ul>
            <li>Database of recipes that can be replenished</li>
            <li>Flexible search for desired and unwanted ingredients</li>
            <li>Ability to add your own recipes with photos</li>
            <li>Convenient and easy to use</li>
          </ul>
        </div>
        <div className="footerLinks">
          <Link href="/search">Search</Link>
          <Link href="/add">Add recipes</Link>
          <Link href="/my">My recipes</Link>
          <Link href="/favorite">Favorite</Link>
          <Link href="/shopping-list">Shopping list</Link>
        </div>
        <Newsletter />
      </div>
      <div className="legal">
        © 2026 All rights reserved · <Link href="/">Terms of service</Link>
      </div>
    </footer>
  );
}
function Newsletter() {
  return (
    <form className="newsletter" action="/api/v1/subscribe" method="post">
      <strong>Subscribe to our Newsletter</strong>
      <p>Subscribe to receive recipes, news and inspiration.</p>
      <label>
        <span className="srOnly">Email address</span>
        <input name="email" type="email" placeholder="Enter your email address" required />
      </label>
      <button>Subscribe</button>
    </form>
  );
}
