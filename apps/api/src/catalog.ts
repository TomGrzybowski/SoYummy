import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeCatalog } from '@so-yummy/db/normalize';

const root = fileURLToPath(new URL('../../../data/source/', import.meta.url));
const load = async (name: string) =>
  JSON.parse(await readFile(`${root}${name}`, 'utf8')) as unknown;

export async function loadCatalog() {
  return normalizeCatalog(
    await load('categoriesList.json'),
    await load('ingredients.json'),
    await load('recipes.json'),
  );
}
