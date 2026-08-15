import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { normalizeCatalog } from './normalize.js';

const sourceRoot = fileURLToPath(new URL('../../../data/source/', import.meta.url));
const load = async (name: string) =>
  JSON.parse(await readFile(`${sourceRoot}${name}`, 'utf8')) as unknown;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to seed PostgreSQL');
  const catalog = normalizeCatalog(
    await load('categoriesList.json'),
    await load('ingredients.json'),
    await load('recipes.json'),
  );
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  await sql`SELECT pg_advisory_lock(831245091)`;
  try {
    for (const item of catalog.categories)
      await sql`INSERT INTO categories (id,title,thumb,description) VALUES (${item.id},${item.title},${item.thumb},${item.description}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,thumb=EXCLUDED.thumb,description=EXCLUDED.description`;
    for (const item of catalog.ingredients)
      await sql`INSERT INTO ingredients (id,title,description,thumb) VALUES (${item.id},${item.title},${item.description},${item.thumb}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,thumb=EXCLUDED.thumb`;
    for (const recipe of catalog.recipes) {
      await sql`INSERT INTO recipes (id,title,category,area,instructions,description,thumb,preview,time,youtube,tags) VALUES (${recipe.id},${recipe.title},${recipe.category},${recipe.area},${recipe.instructions},${recipe.description},${recipe.thumb},${recipe.preview},${recipe.time},${recipe.youtube},${JSON.stringify(recipe.tags)}::jsonb) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,category=EXCLUDED.category,area=EXCLUDED.area,instructions=EXCLUDED.instructions,description=EXCLUDED.description,thumb=EXCLUDED.thumb,preview=EXCLUDED.preview,time=EXCLUDED.time,youtube=EXCLUDED.youtube,tags=EXCLUDED.tags`;
      for (const [position, item] of recipe.ingredients.entries())
        await sql`INSERT INTO recipe_ingredients (recipe_id,ingredient_id,measure,position) VALUES (${recipe.id},${item.ingredientId},${item.measure},${position}) ON CONFLICT (recipe_id,ingredient_id) DO UPDATE SET measure=EXCLUDED.measure,position=EXCLUDED.position`;
    }
    console.log(
      `Seeded ${catalog.categories.length} categories, ${catalog.ingredients.length} ingredients and ${catalog.recipes.length} recipes.`,
    );
  } finally {
    await sql`SELECT pg_advisory_unlock(831245091)`;
    await sql.end();
  }
}

await main();
