<script>
import { onMount } from 'svelte';
let adminMeals = [];
let adminOptions = [];
let pricingRules = [];
let variantChoices = []; // combined list of variants for dropdown
let message = '';
let errorMsg = '';
// Form fields for admin actions
let newMealName = '';
let newMealDesc = '';
let selectedMealForVariant = '';
let newVariantName = '';
let newVariantPrice = 0;
let newVariantCalories = 0;
let newOptionName = '';
let newOptionRequired = false;
let newOptionMulti = false;
let selectedOptionGroup = '';
let newOptionValueName = '';
let newOptionValueCost = 0;
let linkMealRef = '';
let linkOptionRef = '';
let selectedVariantForRule = '';
let newRuleMinQty = 0;
let newRulePrice = 0;
async function loadAdminMeals() {
  const res = await fetch('/api/admin/meals');
  const data = await res.json();
  adminMeals = data.meals || [];
}
async function loadAdminOptions() {
  const res = await fetch('/api/admin/options');
  const data = await res.json();
  adminOptions = data.options || [];
}
async function loadPricingRules() {
  const res = await fetch('/api/admin/pricing-rules');
  const data = await res.json();
  pricingRules = data.pricing_rules || [];
}
onMount(async () => {
  try {
    await Promise.all([loadAdminMeals(), loadAdminOptions(), loadPricingRules()]);
  } catch (e) {
    errorMsg = 'Failed to load admin data.';
  }
});
// Reactive: update variant choices list whenever adminMeals changes
$: {
  variantChoices = [];
  for (const meal of adminMeals) {
    if (meal.variants) {
      for (const variant of meal.variants) {
        variantChoices.push({ id: variant.id, label: meal.name + ' - ' + variant.name });
      }
    }
  }
}
// Admin action functions
async function createMeal() {
  errorMsg = '';
  message = '';
  if (!newMealName) {
    errorMsg = 'Meal name is required';
    return;
  }
  try {
    const res = await fetch('/api/admin/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMealName, description: newMealDesc })
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to add meal';
    } else {
      message = 'Meal added successfully';
      newMealName = '';
      newMealDesc = '';
      await loadAdminMeals();
    }
  } catch (e) {
    errorMsg = 'Failed to add meal';
  }
}
async function createVariant() {
  errorMsg = '';
  message = '';
  if (!selectedMealForVariant || !newVariantName) {
    errorMsg = 'Please select a meal and enter variant name';
    return;
  }
  try {
    const priceVal = parseInt(newVariantPrice);
    const calVal = parseInt(newVariantCalories);
    const res = await fetch('/api/admin/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_ref_id: parseInt(selectedMealForVariant),
        name: newVariantName,
        price: isNaN(priceVal) ? 0 : priceVal,
        calories: isNaN(calVal) ? 0 : calVal
      })
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to add variant';
    } else {
      message = 'Variant added successfully';
      selectedMealForVariant = '';
      newVariantName = '';
      newVariantPrice = 0;
      newVariantCalories = 0;
      await loadAdminMeals();
    }
  } catch (e) {
    errorMsg = 'Failed to add variant';
  }
}
async function createOptionGroup() {
  errorMsg = '';
  message = '';
  if (!newOptionName) {
    errorMsg = 'Option group name is required';
    return;
  }
  try {
    const res = await fetch('/api/admin/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newOptionName,
        is_required: newOptionRequired,
        is_multi_select: newOptionMulti
      })
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to add option group';
    } else {
      message = 'Option group added successfully';
      newOptionName = '';
      newOptionRequired = false;
      newOptionMulti = false;
      await loadAdminOptions();
    }
  } catch (e) {
    errorMsg = 'Failed to add option group';
  }
}
async function createOptionValue() {
  errorMsg = '';
  message = '';
  if (!selectedOptionGroup || !newOptionValueName) {
    errorMsg = 'Please select an option group and enter a value name';
    return;
  }
  try {
    const costVal = parseInt(newOptionValueCost);
    const res = await fetch('/api/admin/option-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        option_ref_id: parseInt(selectedOptionGroup),
        name: newOptionValueName,
        extra_cost: isNaN(costVal) ? 0 : costVal
      })
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to add option value';
    } else {
      message = 'Option value added successfully';
      newOptionValueName = '';
      newOptionValueCost = 0;
      await loadAdminOptions();
    }
  } catch (e) {
    errorMsg = 'Failed to add option value';
  }
}
async function linkOptionToMeal() {
  errorMsg = '';
  message = '';
  if (!linkMealRef || !linkOptionRef) {
    errorMsg = 'Select a meal and option group to link';
    return;
  }
  try {
    const res = await fetch('/api/admin/meal-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_ref_id: parseInt(linkMealRef),
        option_ref_id: parseInt(linkOptionRef)
      })
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to link option';
    } else {
      message = 'Option group linked to meal';
      linkMealRef = '';
      linkOptionRef = '';
      await loadAdminMeals();
    }
  } catch (e) {
    errorMsg = 'Failed to link option';
  }
}
async function createPricingRule() {
  errorMsg = '';
  message = '';
  if (!selectedVariantForRule || newRuleMinQty <= 0 || newRulePrice <= 0) {
    errorMsg = 'All pricing rule fields are required';
    return;
  }
  try {
    const res = await fetch('/api/admin/pricing-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_variant_id: parseInt(selectedVariantForRule),
        min_total_quantity: parseInt(newRuleMinQty),
        price_per_unit: parseInt(newRulePrice)
      })
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to add pricing rule';
    } else {
      message = 'Pricing rule added successfully';
      selectedVariantForRule = '';
      newRuleMinQty = 0;
      newRulePrice = 0;
      await loadPricingRules();
    }
  } catch (e) {
    errorMsg = 'Failed to add pricing rule';
  }
}
</script>
{#if errorMsg}
<p class="text-red-600 font-semibold">{errorMsg}</p>
{/if}
{#if message}
<p class="text-green-600 font-semibold">{message}</p>
{/if}
<h2 class="text-2xl font-bold mt-4 mb-2">Meals & Variants</h2>
<ul class="mb-4">
{#each adminMeals as meal}
<li class="mb-2">
<strong>{meal.name}</strong> – {meal.description} {#if !meal.is_active}(inactive){/if}
<ul class="ml-4">
{#each meal.variants as v}
<li>{v.name}: ${ (v.price / 100).toFixed(2) } – {v.calories} cal {#if !v.is_active}(inactive){/if}</li>
{/each}
</ul>
{#if meal.options.length > 0}
<p class="ml-4 text-sm text-gray-700">Options: {meal.options.map(o => o.name).join(', ')}</p>
{/if}
</li>
{/each}
</ul>
<div class="mb-4">
<h3 class="font-semibold">Add New Meal</h3>
<input type="text" placeholder="Meal name" bind:value={newMealName} class="border px-2 py-1 mr-2" />
<input type="text" placeholder="Description" bind:value={newMealDesc} class="border px-2 py-1 mr-2" />
<button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={createMeal}>Add Meal</button>
</div>
<div class="mb-4">
<h3 class="font-semibold">Add Variant to Meal</h3>
<select bind:value={selectedMealForVariant} class="border px-2 py-1 mr-2">
<option value="" disabled selected>Select meal</option>
{#each adminMeals as meal}
<option value={meal.ref_id}>{meal.name}</option>
{/each}
</select>
<input type="text" placeholder="Variant name" bind:value={newVariantName} class="border px-2 py-1 mr-2" />
<input type="number" placeholder="Price (cents)" bind:value={newVariantPrice} class="border px-2 py-1 mr-2 w-28" />
<input type="number" placeholder="Calories" bind:value={newVariantCalories} class="border px-2 py-1 mr-2 w-20" />
<button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={createVariant}>Add Variant</button>
</div>
<div class="mb-6">
<h3 class="font-semibold">Assign Option Group to Meal</h3>
<select bind:value={linkMealRef} class="border px-2 py-1 mr-2">
<option value="" disabled selected>Select meal</option>
{#each adminMeals as meal}
<option value={meal.ref_id}>{meal.name}</option>
{/each}
</select>
<select bind:value={linkOptionRef} class="border px-2 py-1 mr-2">
<option value="" disabled selected>Select option group</option>
{#each adminOptions as opt}
<option value={opt.ref_id}>{opt.name}</option>
{/each}
</select>
<button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={linkOptionToMeal}>Link Option</button>
</div>
<h2 class="text-2xl font-bold mb-2">Option Groups & Values</h2>
<ul class="mb-4">
{#each adminOptions as opt}
<li class="mb-2">
<strong>{opt.name}</strong>
{#if opt.is_required} (required){/if}{#if opt.is_multi_select} (multiselect){/if} {#if !opt.is_active}(inactive){/if}
<ul class="ml-4">
{#each opt.values as val}
<li>{val.name}{#if val.extra_cost > 0} (+${(val.extra_cost / 100).toFixed(2)}){/if} {#if !val.is_active}(inactive){/if}</li>
{/each}
</ul>
</li>
{/each}
</ul>
<div class="mb-4">
<h3 class="font-semibold">Add Option Group</h3>
<input type="text" placeholder="Group name" bind:value={newOptionName} class="border px-2 py-1 mr-2" />
<label class="mr-2"><input type="checkbox" bind:checked={newOptionRequired} /> Required</label>
<label class="mr-2"><input type="checkbox" bind:checked={newOptionMulti} /> Multi-select</label>
<button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={createOptionGroup}>Add Group</button>
</div>
<div class="mb-6">
<h3 class="font-semibold">Add Option Value</h3>
<select bind:value={selectedOptionGroup} class="border px-2 py-1 mr-2">
<option value="" disabled selected>Select group</option>
{#each adminOptions as opt}
<option value={opt.ref_id}>{opt.name}</option>
{/each}
</select>
<input type="text" placeholder="Value name" bind:value={newOptionValueName} class="border px-2 py-1 mr-2" />
<input type="number" placeholder="Extra cost (cents)" bind:value={newOptionValueCost} class="border px-2 py-1 mr-2 w-28" />
<button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={createOptionValue}>Add Value</button>
</div>
<h2 class="text-2xl font-bold mb-2">Pricing Rules</h2>
<table class="mb-4 text-left border-collapse">
<tr><th class="p-1 border-b">Meal - Variant</th><th class="p-1 border-b">Min Qty</th><th class="p-1 border-b">Price per Unit</th></tr>
{#each pricingRules as rule}
<tr>
<td class="p-1 border-b">{rule.meal_name} – {rule.variant_name}</td>
<td class="p-1 border-b">{rule.min_total_quantity}</td>
<td class="p-1 border-b">${ (rule.price_per_unit / 100).toFixed(2) }</td>
</tr>
{/each}
</table>
<div class="mb-6">
<h3 class="font-semibold">Add Pricing Rule</h3>
<select bind:value={selectedVariantForRule} class="border px-2 py-1 mr-2">
<option value="" disabled selected>Select variant</option>
{#each variantChoices as choice}
<option value={choice.id}>{choice.label}</option>
{/each}
</select>
<input type="number" placeholder="Min quantity" bind:value={newRuleMinQty} class="border px-2 py-1 mr-2 w-20" />
<input type="number" placeholder="Price per unit (cents)" bind:value={newRulePrice} class="border px-2 py-1 mr-2 w-28" />
<button class="bg-blue-600 text-white px-3 py-1 rounded" on:click={createPricingRule}>Add Rule</button>
</div>
