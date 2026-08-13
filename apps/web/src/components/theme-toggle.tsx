'use client';
import { useState } from 'react';

export function ThemeToggle() {
  const [revision, setRevision] = useState(0);
  function toggle() {
    const next = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('so-yummy-theme', next ? 'dark' : 'light');
    setRevision((value) => value + 1);
  }
  return (
    <button
      type="button"
      className="themeToggle"
      onClick={toggle}
      aria-label="Toggle color theme"
      data-revision={revision}
    >
      <span />
    </button>
  );
}
