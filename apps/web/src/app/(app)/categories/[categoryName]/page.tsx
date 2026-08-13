import Link from 'next/link';
import { PageTitle } from '@/components/page-title';
import { RecipeCard } from '@/components/recipe-card';
import { catalog } from '@/lib/catalog';
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  const selected = decodeURIComponent(categoryName);
  const { categories, recipes } = await catalog();
  return (
    <main className="content">
      <PageTitle>Categories</PageTitle>
      <div className="categoryTabs">
        {categories.map((category) => (
          <Link
            className={category.title === selected ? 'active' : ''}
            key={category.id}
            href={`/categories/${encodeURIComponent(category.title)}`}
          >
            {category.title}
          </Link>
        ))}
      </div>
      <div className="catalogGrid">
        {recipes
          .filter((recipe) => recipe.category.toLowerCase() === selected.toLowerCase())
          .map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
      </div>
    </main>
  );
}
