import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Category, Ingredient, Recipe } from '@so-yummy/contracts';

type Oid = { $oid: string };
type RawRecipe = Omit<Recipe, 'id' | 'time' | 'ingredients'> & {
  _id: Oid;
  time: string;
  ingredients: Array<{ id: Oid; measure: string }>;
};
type RawIngredient = { _id: Oid; ttl: string; desc: string; thb: string };
const source = path.resolve(process.cwd(), '../../data/source');
async function json<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(source, file), 'utf8')) as T;
}

export async function catalog() {
  const [rawCategories, rawIngredients, rawRecipes] = await Promise.all([
    json<Array<{ _id: string; title: string; thumb: string; description: string }>>(
      'categoriesList.json',
    ),
    json<RawIngredient[]>('ingredients.json'),
    json<RawRecipe[]>('recipes.json'),
  ]);
  const ingredients: Ingredient[] = rawIngredients.map((item) => ({
    id: item._id.$oid,
    title: item.ttl,
    description: item.desc ?? '',
    thumb: item.thb ?? '',
  }));
  const byId = new Map(ingredients.map((item) => [item.id, item]));
  const recipes: Recipe[] = rawRecipes.map((item) => ({
    id: item._id.$oid,
    title: item.title,
    category: item.category,
    area: item.area ?? '',
    instructions: item.instructions,
    description: item.description ?? '',
    thumb: item.thumb ?? item.preview ?? '',
    preview: item.preview ?? item.thumb ?? '',
    time: Number(item.time) || 30,
    youtube: item.youtube ?? '',
    tags: item.tags ?? [],
    ingredients: (item.ingredients ?? []).flatMap((entry) => {
      const ingredient = byId.get(entry.id.$oid);
      return ingredient
        ? [
            {
              ingredientId: ingredient.id,
              title: ingredient.title,
              thumb: ingredient.thumb,
              measure: entry.measure,
            },
          ]
        : [];
    }),
  }));
  const categories: Category[] = rawCategories.map((item) => ({
    id: item._id,
    title: item.title,
    thumb: item.thumb,
    description: item.description,
  }));
  return { categories, ingredients, recipes };
}
