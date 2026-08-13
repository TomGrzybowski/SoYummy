import Image from 'next/image';
import { notFound } from 'next/navigation';
import { catalog } from '@/lib/catalog';
export default async function RecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
  const { recipes } = await catalog();
  const recipe = recipes.find((item) => item.id === recipeId);
  if (!recipe) notFound();
  return (
    <main>
      <section className="recipeHero">
        <Image src={recipe.thumb} alt={recipe.title} fill priority sizes="100vw" />
        <div>
          <h1>{recipe.title}</h1>
          <p>
            {recipe.description ||
              `A delicious ${recipe.category.toLowerCase()} recipe for every occasion.`}
          </p>
          <button>Add to favorite recipes</button>
          <span>◷ {recipe.time} min</span>
        </div>
      </section>
      <div className="recipeDetail">
        <section>
          <h2>Ingredients</h2>
          <ul className="ingredients">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.ingredientId}>
                <Image src={ingredient.thumb} alt="" width={80} height={80} />
                <span>{ingredient.title}</span>
                <em>{ingredient.measure}</em>
                <button aria-label={`Add ${ingredient.title} to shopping list`}>＋</button>
              </li>
            ))}
          </ul>
        </section>
        <section className="preparation">
          <h2>Recipe Preparation</h2>
          {recipe.instructions
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line, index) => (
              <p key={index}>
                <b>{index + 1}</b>
                {line}
              </p>
            ))}
        </section>
      </div>
    </main>
  );
}
