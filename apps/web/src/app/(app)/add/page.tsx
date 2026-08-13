import { AddRecipeForm } from '@/components/add-recipe-form';
import { PageTitle } from '@/components/page-title';
export default function AddPage() {
  return (
    <main className="content">
      <PageTitle>Add recipe</PageTitle>
      <AddRecipeForm />
    </main>
  );
}
