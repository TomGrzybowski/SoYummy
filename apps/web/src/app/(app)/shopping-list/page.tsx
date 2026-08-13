import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
export default function ShoppingListPage() {
  return (
    <main className="content">
      <PageTitle>Shopping list</PageTitle>
      <div className="shoppingHeader">
        <span>Products</span>
        <span>Number</span>
        <span>Remove</span>
      </div>
      <EmptyState
        title="Your shopping list is empty"
        text="Open a recipe and add the ingredients you need."
      />
    </main>
  );
}
