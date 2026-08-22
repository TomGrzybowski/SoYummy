import { PageTitle } from '@/components/page-title';
import { ShoppingList } from '@/components/shopping-list';
export default function ShoppingListPage() {
  return (
    <main className="content">
      <PageTitle>Shopping list</PageTitle>
      <div className="shoppingHeader">
        <span>Products</span>
        <span>Number</span>
        <span>Remove</span>
      </div>
      <ShoppingList />
    </main>
  );
}
