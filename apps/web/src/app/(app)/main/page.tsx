import { HomeContent } from '@/components/home-content';
import { catalog } from '@/lib/catalog';
export const metadata = { title: 'Recipes' };
export default async function MainPage() {
  const { recipes } = await catalog();
  return <HomeContent recipes={recipes} />;
}
