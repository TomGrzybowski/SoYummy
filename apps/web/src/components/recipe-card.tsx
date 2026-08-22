import Image from 'next/image';
import Link from 'next/link';
import type { Recipe } from '@so-yummy/contracts';
type RecipeCardRecipe = Pick<Recipe, 'id' | 'title' | 'thumb' | 'preview'>;
export function RecipeCard({ recipe }: { recipe: RecipeCardRecipe }) {
  return (
    <Link href={`/recipe/${recipe.id}`} className="recipeCard">
      <Image
        src={recipe.thumb || recipe.preview || '/figma/hero-02.png'}
        alt={recipe.title}
        fill
        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw"
      />
      <span>{recipe.title}</span>
    </Link>
  );
}
