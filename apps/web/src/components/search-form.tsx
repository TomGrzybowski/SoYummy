'use client';
import { useRouter } from 'next/navigation';
export function SearchForm({ initial = '' }: { initial?: string }) {
  const router = useRouter();
  return (
    <form
      className="largeSearch"
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get('q');
        router.push(`/search?q=${encodeURIComponent(String(value ?? ''))}`);
      }}
    >
      <input
        defaultValue={initial}
        name="q"
        placeholder="Search recipes"
        aria-label="Search recipes"
      />
      <button>Search</button>
    </form>
  );
}
