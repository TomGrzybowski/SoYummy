import { FavoriteRecipes } from '@/components/favorite-recipes';
import { PageTitle } from '@/components/page-title';
export default function FavoritePage() {
  return (
    <main className="content">
      <PageTitle>Favorites</PageTitle>
      <FavoriteRecipes />
    </main>
  );
}
