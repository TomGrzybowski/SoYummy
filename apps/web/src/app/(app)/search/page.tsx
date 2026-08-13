import { Suspense } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { RecipeCard } from '@/components/recipe-card';
import { SearchForm } from '@/components/search-form';
import { catalog } from '@/lib/catalog';
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const { recipes } = await catalog();
  const found = q
    ? recipes.filter(
        (recipe) =>
          recipe.title.toLowerCase().includes(q.toLowerCase()) ||
          recipe.ingredients.some((ingredient) =>
            ingredient.title.toLowerCase().includes(q.toLowerCase()),
          ),
      )
    : [];
  return (
    <main className="content">
      <PageTitle>Search</PageTitle>
      <Suspense fallback={<div className="skeleton" />}>
        <SearchForm initial={q} />
      </Suspense>
      {found.length ? (
        <div className="catalogGrid">
          {found.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Try looking for something else"
          text="Enter a recipe or ingredient name to find your next meal."
        />
      )}
    </main>
  );
}
