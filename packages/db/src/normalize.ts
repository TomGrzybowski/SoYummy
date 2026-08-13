import type { Category, Ingredient, Recipe } from '@so-yummy/contracts';

type Oid = { $oid: string };
type SourceCategory = { _id: string; title: string; thumb: string; description: string };
type SourceIngredient = { _id: Oid; ttl: string; desc?: string; thb?: string };
type SourceRecipe = {
  _id: Oid;
  title: string;
  category: string;
  area?: string;
  instructions: string;
  description?: string;
  thumb?: string;
  preview?: string;
  time?: string | number;
  youtube?: string;
  tags?: string[];
  ingredients?: Array<{ id: Oid; measure: string }>;
};

export function normalizeCatalog(
  categoryData: unknown,
  ingredientData: unknown,
  recipeData: unknown,
) {
  const sourceCategories = categoryData as SourceCategory[];
  const sourceIngredients = ingredientData as SourceIngredient[];
  const sourceRecipes = recipeData as SourceRecipe[];
  if (
    sourceCategories.length !== 14 ||
    sourceIngredients.length !== 574 ||
    sourceRecipes.length !== 285
  ) {
    throw new Error(
      `Unexpected source totals: ${sourceCategories.length}/${sourceIngredients.length}/${sourceRecipes.length}`,
    );
  }
  const ingredients: Ingredient[] = sourceIngredients.map((item) => ({
    id: item._id.$oid,
    title: item.ttl.trim(),
    description: item.desc ?? '',
    thumb: item.thb ?? '',
  }));
  const ingredientMap = new Map(ingredients.map((item) => [item.id, item]));
  const categories: Category[] = sourceCategories.map((item) => ({
    id: item._id,
    title: item.title,
    thumb: item.thumb,
    description: item.description,
  }));
  const recipes: Recipe[] = sourceRecipes.map((item) => ({
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
    ingredients: (item.ingredients ?? []).map((entry) => {
      const ingredient = ingredientMap.get(entry.id.$oid);
      if (!ingredient)
        throw new Error(`Recipe ${item._id.$oid} references missing ingredient ${entry.id.$oid}`);
      return {
        ingredientId: ingredient.id,
        title: ingredient.title,
        thumb: ingredient.thumb,
        measure: entry.measure,
      };
    }),
  }));
  return { categories, ingredients, recipes };
}
