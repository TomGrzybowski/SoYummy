import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
export default function MyRecipesPage() {
  return (
    <main className="content">
      <PageTitle>My recipes</PageTitle>
      <EmptyState
        title="You have not added recipes yet"
        text="Create your first personal recipe and make this cookbook yours."
      />
    </main>
  );
}
