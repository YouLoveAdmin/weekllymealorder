<script>
import { onMount, onDestroy } from 'svelte';
let menu = null;
let currentOrder = null;
let orderSelections = {};
let isLoading = true;
let errorMsg = '';
let successMsg = '';
let cutoffCheckInterval;
onMount(async () => {
  try {
    // Fetch weekly menu data
    const res = await fetch('/api/meals');
    const data = await res.json();
    menu = data;
    // Initialize selection structure for each variant
    orderSelections = {};
    if (menu && menu.meals) {
      for (const meal of menu.meals) {
        for (const variant of meal.variants) {
          orderSelections[variant.id] = { quantity: 0, options: {} };
          if (meal.options) {
            for (const opt of meal.options) {
              if (opt.is_multi_select) {
                orderSelections[variant.id].options[opt.id] = [];
              } else {
                orderSelections[variant.id].options[opt.id] = opt.is_required && opt.values.length ? opt.values[0].id : null;
              }
            }
          }
        }
      }
    }
    // Fetch current order (if any)
    const orderRes = await fetch('/api/order');
    const orderData = await orderRes.json();
    currentOrder = orderData.order;
  } catch (e) {
    errorMsg = 'Failed to load menu.';
  } finally {
    isLoading = false;
  }

  // Check cutoff every 30 seconds to update UI if period has closed
  cutoffCheckInterval = setInterval(() => {
    if (menu && menu.week && menu.week.is_open) {
      checkCutoffTime();
    }
  }, 30000); // Check every 30 seconds
});

onDestroy(() => {
  if (cutoffCheckInterval) {
    clearInterval(cutoffCheckInterval);
  }
});

async function checkCutoffTime() {
  try {
    const res = await fetch('/api/meals');
    const data = await res.json();
    if (data.week && data.week.is_open === 0 && menu.week.is_open === 1) {
      // Cutoff has passed, update the UI
      menu.week = data.week;
      errorMsg = 'Order period has closed. Orders can no longer be placed for this week.';
    }
  } catch (e) {
    // Silently handle check failures
  }
}

async function addToCart() {
  errorMsg = '';
  successMsg = '';
  // Build order items from selections
  const items = [];
  if (menu && menu.meals) {
    for (const meal of menu.meals) {
      for (const variant of meal.variants) {
        const sel = orderSelections[variant.id];
        if (sel.quantity > 0) {
          const selectedOptionValues = [];
          if (meal.options) {
            for (const opt of meal.options) {
              if (opt.is_multi_select) {
                selectedOptionValues.push(...sel.options[opt.id]);
              } else {
                const val = sel.options[opt.id];
                if (val) selectedOptionValues.push(val);
              }
            }
          }
          items.push({ meal_variant_id: variant.id, quantity: sel.quantity, options: selectedOptionValues });
        }
      }
    }
  }
  if (items.length === 0) {
    errorMsg = 'Please select at least one item.';
    return;
  }
  // Submit to cart
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to add to cart.';
    } else {
      successMsg = 'Items added to cart successfully!';
      // Refresh current order details
      const orderRes = await fetch('/api/order');
      const orderData = await orderRes.json();
      currentOrder = orderData.order;
    }
  } catch (e) {
    errorMsg = 'Failed to add to cart.';
  }
}

async function placeOrder() {
  errorMsg = '';
  successMsg = '';
  
  if (!currentOrder || currentOrder.status !== 'cart') {
    errorMsg = 'No cart found. Please add items to cart first.';
    return;
  }
  
  // Submit order
  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    if (!res.ok) {
      errorMsg = result.error || 'Failed to place order.';
    } else {
      successMsg = 'Order placed successfully!';
      // Refresh current order details
      const orderRes = await fetch('/api/order');
      const orderData = await orderRes.json();
      currentOrder = orderData.order;
    }
  } catch (e) {
    errorMsg = 'Failed to place order.';
  }
}

async function deleteOrder() {
  errorMsg = '';
  successMsg = '';
  
  if (!currentOrder || (currentOrder.status !== 'placed' && currentOrder.status !== 'cart')) {
    errorMsg = 'No order to delete.';
    return;
  }
  
  const orderType = currentOrder.status === 'cart' ? 'cart' : 'order';
  if (!confirm(`Are you sure you want to delete your ${orderType}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const res = await fetch('/api/order', {
      method: 'DELETE'
    });
    const result = await res.json();
    
    if (!res.ok) {
      errorMsg = result.error || 'Failed to delete order.';
    } else {
      successMsg = result.message || `${orderType.charAt(0).toUpperCase() + orderType.slice(1)} deleted successfully!`;
      currentOrder = null;
    }
  } catch (e) {
    errorMsg = 'Failed to delete order.';
  }
}
</script>
{#if isLoading}
<p class="text-gray-600">Loading menu...</p>
{/if}
{#if !isLoading}
{#if menu && menu.week}
<h1 class="text-2xl font-bold mb-4">Weekly Menu (Week of {menu.week.week_start_date})</h1>
{#if !menu.week.is_open}
<p class="text-red-600 mb-4">Ordering is closed for this week.</p>
{/if}
{/if}
{#if menu}
{#each menu.meals as meal}
<div class="mb-6 pb-4 border-b">
<h2 class="text-xl font-semibold">{meal.name}</h2>
<p class="text-gray-700 mb-2">{meal.description}</p>
{#each meal.variants as variant}
<div class="ml-4 mb-3">
<div class="flex items-center space-x-4">
<span class="font-medium">{variant.name} – ${ (variant.price / 100).toFixed(2) }</span>
<span class="text-sm text-gray-600">{variant.calories} cal</span>
<label class="ml-4 text-sm">
Qty:
<input type="number" min="0" max="10" class="w-16 border px-1 py-0.5" bind:value={orderSelections[variant.id].quantity} />
</label>
</div>
{#each meal.options as opt}
<div class="ml-6 text-sm">
{#if opt.is_multi_select}
<span class="font-medium">{opt.name}:</span>
{#each opt.values as val}
<label class="ml-2">
<input type="checkbox" bind:group={orderSelections[variant.id].options[opt.id]} value={val.id} />
{val.name}{#if val.extra_cost > 0} (+${(val.extra_cost / 100).toFixed(2)}){/if}
</label>
{/each}
{:else}
{#if !opt.is_required && opt.values.length === 1}
<!-- Single optional value as checkbox -->
<label>
<input type="checkbox" on:change={() => { const current = orderSelections[variant.id].options[opt.id]; orderSelections[variant.id].options[opt.id] = current ? null : opt.values[0].id; }} checked={orderSelections[variant.id].options[opt.id]} />
{opt.values[0].name}{#if opt.values[0].extra_cost > 0} (+${(opt.values[0].extra_cost / 100).toFixed(2)}){/if}
</label>
{:else}
<label class="font-medium">{opt.name}:</label>
{#if opt.values.length > 1}
<select bind:value={orderSelections[variant.id].options[opt.id]} class="ml-2 border">
<option value={null}>None</option>
{#each opt.values as val}
<option value={val.id}>{val.name}{#if val.extra_cost > 0} (+${(val.extra_cost / 100).toFixed(2)}){/if}</option>
{/each}
</select>
{:else}
<!-- Only one possible value (required) -->
<span class="ml-2">{opt.values[0].name}</span>
<input type="hidden" bind:value={orderSelections[variant.id].options[opt.id]} />
{/if}
{/if}
{/if}
</div>
{/each}
</div>
{/each}
</div>
{/each}
{/if}
<!-- Current Order Summary -->
{#if currentOrder}
<h2 class="text-xl font-semibold mt-6 mb-2">
  {#if currentOrder.status === 'cart'}
    Your Cart for This Week:
  {:else}
    Your Order for This Week:
  {/if}
</h2>
<ul class="mb-4">
{#each currentOrder.items as item}
<li class="mb-1">{item.quantity}× {item.meal_name} – {item.variant_name}
{#if item.options && item.options.length > 0}
<ul class="ml-4 text-gray-700 text-sm">
{#each item.options as opt}
<li>{opt.option_name}: {opt.value_name}{#if opt.extra_cost > 0} (+${(opt.extra_cost / 100).toFixed(2)}){/if}</li>
{/each}
</ul>
{/if}
</li>
{/each}
</ul>
<p class="font-medium">Total: ${ (currentOrder.total_price / 100).toFixed(2) }</p>
{#if currentOrder.status === 'placed'}
<div class="mt-3 flex items-center gap-4">
  <p class="text-green-600 font-semibold">Your order has been placed.</p>
  {#if menu && menu.week && menu.week.is_open}
  <button 
    on:click={deleteOrder}
    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
    title="Delete your order (only available before cutoff date)"
  >
    Delete Order
  </button>
  {/if}
</div>
{:else if currentOrder.status === 'cart'}
<div class="mt-3 flex items-center gap-4">
  <p class="text-yellow-600 font-semibold">Items in cart (not yet ordered).</p>
  {#if menu && menu.week && menu.week.is_open}
  <button 
    on:click={placeOrder}
    class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold transition-colors"
    title="Place your order"
  >
    Place Order
  </button>
  <button 
    on:click={deleteOrder}
    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
    title="Delete your cart"
  >
    Delete Cart
  </button>
  {/if}
</div>
{:else}
<p class="text-gray-600 font-semibold mt-2">Order status: {currentOrder.status}</p>
{/if}
{/if}
<!-- Order Submission -->
{#if menu && menu.week && menu.week.is_open && !(currentOrder && currentOrder.status === 'placed')}
{#if errorMsg}
<p class="text-red-600 mb-2">{errorMsg}</p>
{/if}
{#if successMsg}
<p class="text-green-600 mb-2">{successMsg}</p>
{/if}
{#if !currentOrder || currentOrder.status !== 'cart'}
<button class="px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition-colors" on:click|preventDefault={addToCart}>Add to Cart</button>
{/if}
{/if}
{/if}
