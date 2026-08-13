'use client';
import { useState } from 'react';
import { apiClient } from '@so-yummy/api-client';
export function AddRecipeForm() {
  const [message, setMessage] = useState('');
  async function submit(data: FormData) {
    setMessage('');
    try {
      const payload = {
        title: data.get('title'),
        category: data.get('category'),
        area: data.get('area') || '',
        description: data.get('description') || '',
        instructions: data.get('instructions'),
        time: Number(data.get('time')),
        ingredients: [{ ingredientId: data.get('ingredientId'), measure: data.get('measure') }],
      };
      await apiClient.post('/recipes', payload);
      setMessage('Recipe added successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add recipe.');
    }
  }
  return (
    <form className="recipeForm" action={submit}>
      <label className="upload">
        <span>＋</span>Upload recipe photo
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <div className="formFields">
        <input name="title" placeholder="Enter item title" required />
        <textarea name="description" placeholder="Enter about recipe" />
        <select name="category" defaultValue="Breakfast">
          <option>Breakfast</option>
          <option>Miscellaneous</option>
          <option>Chicken</option>
          <option>Dessert</option>
          <option>Beef</option>
        </select>
        <input name="area" placeholder="Cuisine / area" />
        <input name="time" type="number" min="1" defaultValue="30" />
        <input name="ingredientId" placeholder="Ingredient ID" required />
        <input name="measure" placeholder="Measure" required />
        <textarea
          name="instructions"
          placeholder="Enter recipe instructions"
          minLength={20}
          required
        />
      </div>
      {message && <p role="status">{message}</p>}
      <button>Add recipe</button>
    </form>
  );
}
