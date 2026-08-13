import Image from 'next/image';
import Link from 'next/link';
import type { Recipe } from '@so-yummy/contracts';
import { RecipeCard } from './recipe-card';
export function HomeContent({ recipes }: { recipes: Recipe[] }) {
  const sections = ['Breakfast', 'Miscellaneous', 'Chicken', 'Dessert'];
  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <h1>
            <span>So</span>Yummy
          </h1>
          <p>
            What to cook? It&apos;s not only a recipe app, it is, in fact, your cookbook. You can
            add your own recipes to save them for the future.
          </p>
          <form action="/search">
            <input name="q" aria-label="Search recipes" placeholder="Search recipes" />
            <button>Search</button>
          </form>
        </div>
        <div className="heroVisual">
          <div className="heroWash" />
          <Image
            className="heroBowl"
            src="/figma/hero-04.png"
            alt="A bowl full of fresh vegetables"
            width={600}
            height={430}
            priority
          />
          <Image className="heroLeaf" src="/figma/hero-01.png" alt="" width={280} height={280} />
          <div className="heroTip">
            <b>Delicious and healthy</b> way to enjoy a variety of fresh ingredients in one
            satisfying meal <Link href={`/recipe/${recipes[0]?.id}`}>→</Link>
          </div>
        </div>
      </section>
      <div className="homeSections">
        {sections.map((section) => (
          <section className="recipeSection" key={section}>
            <h2>{section}</h2>
            <div className="recipeGrid">
              {recipes
                .filter((recipe) => recipe.category === section)
                .slice(0, 4)
                .map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
            </div>
            <Link className="seeAll" href={`/categories/${encodeURIComponent(section)}`}>
              See all
            </Link>
          </section>
        ))}
        <div className="center">
          <Link className="button buttonOutline greenOutline" href="/categories/Beef">
            Other categories
          </Link>
        </div>
      </div>
    </main>
  );
}
