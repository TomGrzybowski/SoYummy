import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
export default function FavoritePage() {
  return (
    <main className="content">
      <PageTitle>Favorites</PageTitle>
      <EmptyState
        title="No favorite recipes yet"
        text="Save recipes you love and they will appear here."
      />
    </main>
  );
}
