import Link from 'next/link';
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="emptyState">
      <div>🍲</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="button" href="/main">
        Explore recipes
      </Link>
    </div>
  );
}
