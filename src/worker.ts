export interface Env {
  DB: any; // D1Database binding
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

// Define ExecutionContext interface for Cloudflare Workers
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// Utility function to get current PST date/time
function getPSTDateTime() {
  const now = new Date();
  // Convert to PST (UTC-8) or PDT (UTC-7) automatically
  const pstTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return pstTime;
}

// Utility function to get current PST date string in YYYY-MM-DD format
function getPSTDateString() {
  const pstTime = getPSTDateTime();
  return pstTime.toISOString().split('T')[0];
}

// Utility function to get current PST timestamp for database
function getPSTTimestamp() {
  const pstTime = getPSTDateTime();
  return pstTime.toISOString();
}
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    // Require authentication via Cloudflare Access
    const userEmail = request.headers.get('cf-access-authenticated-user-email');
    if (!userEmail) {
      return new Response('Unauthorized', { status: 401 });
    }
    // Ensure user exists in database (create if not)
    let user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(userEmail).first();
    if (!user) {
      const username = userEmail.split('@')[0] || 'User';
      const userCreatedAt = getPSTTimestamp();
      await env.DB.prepare('INSERT INTO users (name, email, created_at) VALUES (?, ?, ?)').bind(username, userEmail, userCreatedAt).run();
      user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(userEmail).first();
    }
    const userId = user.id;
    // Check if user is an admin
    const adminRecord = await env.DB.prepare('SELECT id FROM admin_users WHERE user_id = ? AND is_active = 1').bind(userId).first();
    const isAdmin = !!adminRecord;
    // Redirect /admin to /admin.html for the admin interface
    if (path === '/admin') {
      return Response.redirect(`${url.origin}/admin.html`, 302);
    }
    // Public API endpoints
    // Get basic user info (including admin flag)
    if (path === '/api/me' && method === 'GET') {
      const info = { name: user.name, email: userEmail, isAdmin: isAdmin };
      return new Response(JSON.stringify(info), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Get weekly menu and meals
    if (path === '/api/meals' && method === 'GET') {
      // Find current open order week
      const week = await env.DB.prepare('SELECT * FROM order_weeks WHERE is_open = 1 LIMIT 1').first();
      if (!week) {
        return new Response(JSON.stringify({ week: null, meals: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Determine if ordering is still open (check cutoff date)
      const todayStr = getPSTDateString();
      if (todayStr > week.cutoff_date) {
        week.is_open = 0; // treat as closed if past cutoff
      }
      // Fetch active meals and their variants/options
      const mealsResult = await env.DB.prepare('SELECT id, ref_id, name, description FROM meals WHERE is_active = 1').all();
      const mealsList = mealsResult.results || [];
      for (const meal of mealsList) {
        // Active variants for the meal
        const varsResult = await env.DB.prepare('SELECT id, name, price, calories FROM meal_variants WHERE meal_ref_id = ? AND is_active = 1').bind(meal.ref_id).all();
        meal.variants = varsResult.results || [];
        // Option groups linked to the meal
        meal.options = [];
        const optsLinkRes = await env.DB.prepare('SELECT option_ref_id FROM meal_options WHERE meal_ref_id = ?').bind(meal.ref_id).all();
        const optionRefs = optsLinkRes.results ? optsLinkRes.results.map((o: any) => o.option_ref_id) : [];
        for (const optRef of optionRefs) {
          const opt = await env.DB.prepare('SELECT id, name, is_required, is_multi_select FROM options WHERE ref_id = ? AND is_active = 1').bind(optRef).first();
          if (!opt) continue;
          const valsRes = await env.DB.prepare('SELECT id, name, extra_cost FROM option_values WHERE option_ref_id = ? AND is_active = 1').bind(optRef).all();
          opt.values = valsRes.results || [];
          meal.options.push(opt);
        }
      }
      const responseData = {
        week: {
          id: week.id,
          week_start_date: week.week_start_date,
          week_end_date: week.week_end_date,
          is_open: week.is_open,
          cutoff_date: week.cutoff_date
        },
        meals: mealsList
      };
      return new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Get current user's order for the week (if any)
    if (path === '/api/order' && method === 'GET') {
      const week = await env.DB.prepare('SELECT id FROM order_weeks WHERE is_open = 1 LIMIT 1').first();
      if (!week) {
        return new Response(JSON.stringify({ order: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      const order = await env.DB.prepare('SELECT id, status, total_price FROM orders WHERE user_id = ? AND order_week_id = ?').bind(userId, week.id).first();
      if (!order) {
        return new Response(JSON.stringify({ order: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Fetch order items
      const itemsRes = await env.DB.prepare('SELECT id, meal_variant_id, quantity, base_price FROM order_items WHERE order_id = ?').bind(order.id).all();
      const items = itemsRes.results || [];
      for (const item of items) {
        // Get variant and meal names for display
        const variant = await env.DB.prepare('SELECT name, meal_ref_id FROM meal_variants WHERE id = ?').bind(item.meal_variant_id).first();
        item.variant_name = variant ? variant.name : '';
        if (variant) {
          const meal = await env.DB.prepare('SELECT name FROM meals WHERE ref_id = ? AND is_active = 1').bind(variant.meal_ref_id).first();
          item.meal_name = meal ? meal.name : '';
        }
        // Get selected options for this item
        const optsRes = await env.DB.prepare(
          'SELECT o.name AS option_name, ov.name AS value_name, ov.extra_cost AS extra_cost ' +
          'FROM order_item_options oio ' +
          'JOIN option_values ov ON oio.option_value_id = ov.id ' +
          'JOIN options o ON ov.option_ref_id = o.ref_id ' +
          'WHERE oio.order_item_id = ?'
        ).bind(item.id).all();
        item.options = optsRes.results || [];
        // Calculate line total (base price + extras) * quantity
        let extrasTotal = 0;
        for (const opt of item.options) {
          extrasTotal += opt.extra_cost;
        }
        const unitPrice = item.base_price + extrasTotal;
        item.line_total = unitPrice * item.quantity;
      }
      order.items = items;
      return new Response(JSON.stringify({ order: order }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Add items to cart (does not place order yet)
    if (path === '/api/cart' && method === 'POST') {
      const week = await env.DB.prepare('SELECT * FROM order_weeks WHERE is_open = 1 LIMIT 1').first();
      if (!week || !week.is_open) {
        return new Response(JSON.stringify({ error: 'Ordering is not open' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const todayStr = getPSTDateString();
      if (todayStr > week.cutoff_date) {
        return new Response(JSON.stringify({ error: 'Order period has closed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Check for existing order
      const existingOrder = await env.DB.prepare('SELECT id, status FROM orders WHERE user_id = ? AND order_week_id = ?').bind(userId, week.id).first();
      if (existingOrder && existingOrder.status === 'placed') {
        return new Response(JSON.stringify({ error: 'You have already placed an order this week' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (existingOrder && existingOrder.status === 'cart') {
        // Remove existing cart to replace with new one
        await env.DB.prepare('DELETE FROM order_item_options WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)').bind(existingOrder.id).run();
        await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(existingOrder.id).run();
        await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(existingOrder.id).run();
      }
      const data = await request.json();
      const items = data.items || [];
      if (!items.length) {
        return new Response(JSON.stringify({ error: 'No items in cart' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Create a new order in "cart" status
      const currentTimestamp = getPSTTimestamp();
      await env.DB.prepare('INSERT INTO orders (user_id, order_week_id, status, total_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(userId, week.id, 'cart', 0, currentTimestamp, currentTimestamp).run();
      const newOrderRes = await env.DB.prepare('SELECT last_insert_rowid() as orderId').first();
      const orderId = newOrderRes.orderId;
      let orderTotal = 0;
      // Calculate total quantities per variant for discount rules
      const totalQtyByVariant: Record<number, number> = {};
      for (const item of items) {
        totalQtyByVariant[item.meal_variant_id] = (totalQtyByVariant[item.meal_variant_id] || 0) + item.quantity;
      }
      // Insert order items and options
      for (const item of items) {
        const variantId = item.meal_variant_id;
        const quantity = item.quantity;
        // Fetch base price of the variant
        const variantRow = await env.DB.prepare('SELECT price FROM meal_variants WHERE id = ?').bind(variantId).first();
        if (!variantRow) continue;
        let basePrice = variantRow.price;
        // Apply pricing rule if threshold met
        const rule = await env.DB.prepare(
          'SELECT price_per_unit FROM meal_order_pricing_rules ' +
          'WHERE meal_variant_id = ? AND min_total_quantity <= ? ' +
          'ORDER BY min_total_quantity DESC LIMIT 1'
        ).bind(variantId, totalQtyByVariant[variantId] || quantity).first();
        if (rule) {
          basePrice = rule.price_per_unit;
        }
        // Insert order item
        await env.DB.prepare('INSERT INTO order_items (order_id, meal_variant_id, quantity, base_price) VALUES (?, ?, ?, ?)').bind(orderId, variantId, quantity, basePrice).run();
        const newItemRes = await env.DB.prepare('SELECT last_insert_rowid() as itemId').first();
        const orderItemId = newItemRes.itemId;
        // Calculate extra cost for selected options
        let extrasCost = 0;
        if (item.options && Array.isArray(item.options)) {
          for (const optionValueId of item.options) {
            const optVal = await env.DB.prepare('SELECT extra_cost FROM option_values WHERE id = ?').bind(optionValueId).first();
            const extra = optVal ? optVal.extra_cost : 0;
            await env.DB.prepare('INSERT INTO order_item_options (order_item_id, option_value_id) VALUES (?, ?)').bind(orderItemId, optionValueId).run();
            extrasCost += extra;
          }
        }
        const itemTotal = (basePrice + extrasCost) * quantity;
        orderTotal += itemTotal;
      }
      // Update order total (but keep status as "cart")
      const updateTimestamp = getPSTTimestamp();
      await env.DB.prepare('UPDATE orders SET total_price = ?, updated_at = ? WHERE id = ?').bind(orderTotal, updateTimestamp, orderId).run();
      return new Response(JSON.stringify({ orderId: orderId, status: 'cart' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Place order (convert cart to placed order)
    if (path === '/api/order' && method === 'POST') {
      const week = await env.DB.prepare('SELECT * FROM order_weeks WHERE is_open = 1 LIMIT 1').first();
      if (!week || !week.is_open) {
        return new Response(JSON.stringify({ error: 'Ordering is not open' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const todayStr = getPSTDateString();
      if (todayStr > week.cutoff_date) {
        return new Response(JSON.stringify({ error: 'Order period has closed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Find existing cart
      const existingOrder = await env.DB.prepare('SELECT id, status FROM orders WHERE user_id = ? AND order_week_id = ?').bind(userId, week.id).first();
      if (!existingOrder) {
        return new Response(JSON.stringify({ error: 'No cart found. Please add items to cart first.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (existingOrder.status === 'placed') {
        return new Response(JSON.stringify({ error: 'You have already placed an order this week' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (existingOrder.status !== 'cart') {
        return new Response(JSON.stringify({ error: 'Invalid order status' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Update order status to "placed"
      const updateTimestamp = getPSTTimestamp();
      await env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind('placed', updateTimestamp, existingOrder.id).run();
      return new Response(JSON.stringify({ orderId: existingOrder.id, status: 'placed' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Delete current user's order for the week (before cutoff)
    if (path === '/api/order' && method === 'DELETE') {
      const week = await env.DB.prepare('SELECT * FROM order_weeks WHERE is_open = 1 LIMIT 1').first();
      if (!week || !week.is_open) {
        return new Response(JSON.stringify({ error: 'No active order week' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const todayStr = getPSTDateString();
      if (todayStr > week.cutoff_date) {
        return new Response(JSON.stringify({ error: 'Order period has closed. Cannot delete order after cutoff date.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Find existing order
      const existingOrder = await env.DB.prepare('SELECT id, status FROM orders WHERE user_id = ? AND order_week_id = ?').bind(userId, week.id).first();
      if (!existingOrder) {
        return new Response(JSON.stringify({ error: 'No order found to delete' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      // Can delete both cart and placed orders before cutoff
      if (existingOrder.status !== 'placed' && existingOrder.status !== 'cart') {
        return new Response(JSON.stringify({ error: 'Invalid order status' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Delete order and related data
      await env.DB.prepare('DELETE FROM order_item_options WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)').bind(existingOrder.id).run();
      await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(existingOrder.id).run();
      await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(existingOrder.id).run();
      return new Response(JSON.stringify({ success: true, message: 'Order deleted successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Admin API endpoints (require admin privileges)
    if (path.startsWith('/api/admin')) {
      if (!isAdmin) {
        return new Response('Forbidden', { status: 403 });
      }
      // List meals (and their variants & linked options)
      if (path === '/api/admin/meals' && method === 'GET') {
        const mealsRes = await env.DB.prepare('SELECT id, ref_id, name, description, is_active, version FROM meals WHERE is_active = 1').all();
        const meals = mealsRes.results || [];
        for (const meal of meals) {
          const variantsRes = await env.DB.prepare('SELECT id, name, price, calories, is_active, version FROM meal_variants WHERE meal_ref_id = ? AND is_active = 1').bind(meal.ref_id).all();
          meal.variants = variantsRes.results || [];
          const optsRes = await env.DB.prepare(
            'SELECT o.id, o.name FROM meal_options mo ' +
            'JOIN options o ON mo.option_ref_id = o.ref_id AND o.is_active = 1 ' +
            'WHERE mo.meal_ref_id = ?'
          ).bind(meal.ref_id).all();
          meal.options = optsRes.results || [];
        }
        return new Response(JSON.stringify({ meals: meals }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Create a new meal
      if (path === '/api/admin/meals' && method === 'POST') {
        const body = await request.json();
        const name = body.name;
        const description = body.description || '';
        if (!name) {
          return new Response(JSON.stringify({ error: 'Meal name is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const refRes = await env.DB.prepare('SELECT IFNULL(MAX(ref_id), 0) + 1 as newRef FROM meals').first();
        const newRef = refRes.newRef;
        const createdAt = getPSTTimestamp();
        await env.DB.prepare('INSERT INTO meals (ref_id, version, name, description, is_active) VALUES (?, ?, ?, ?, ?)').bind(newRef, 1, name, description, 1).run();
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Add a new meal variant
      if (path === '/api/admin/variants' && method === 'POST') {
        const body = await request.json();
        const mealRef = body.meal_ref_id;
        const name = body.name;
        const price = body.price;
        const calories = body.calories || 0;
        if (!mealRef || !name || price == null) {
          return new Response(JSON.stringify({ error: 'Missing variant fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const createdAt = getPSTTimestamp();
        await env.DB.prepare('INSERT INTO meal_variants (meal_ref_id, version, name, price, calories, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(mealRef, 1, name, price, calories, 1, createdAt).run();
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Create a new option group
      if (path === '/api/admin/options' && method === 'POST') {
        const body = await request.json();
        const name = body.name;
        const isRequired = body.is_required ? 1 : 0;
        const isMulti = body.is_multi_select ? 1 : 0;
        if (!name) {
          return new Response(JSON.stringify({ error: 'Option name is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const refRes = await env.DB.prepare('SELECT IFNULL(MAX(ref_id), 0) + 1 as newRef FROM options').first();
        const newRef = refRes.newRef;
        const createdAt = getPSTTimestamp();
        await env.DB.prepare('INSERT INTO options (ref_id, version, name, is_required, is_multi_select, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newRef, 1, name, isRequired, isMulti, 1, createdAt).run();
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Add a new option value
      if (path === '/api/admin/option-values' && method === 'POST') {
        const body = await request.json();
        const optionRef = body.option_ref_id;
        const name = body.name;
        let extraCost = body.extra_cost;
        if (extraCost == null || extraCost === '') extraCost = 0;
        if (!optionRef || !name) {
          return new Response(JSON.stringify({ error: 'Missing option value fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const createdAt = getPSTTimestamp();
        await env.DB.prepare('INSERT INTO option_values (option_ref_id, version, name, extra_cost, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(optionRef, 1, name, extraCost, 1, createdAt).run();
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Link an option group to a meal
      if (path === '/api/admin/meal-options' && method === 'POST') {
        const body = await request.json();
        const mealRef = body.meal_ref_id;
        const optionRef = body.option_ref_id;
        if (!mealRef || !optionRef) {
          return new Response(JSON.stringify({ error: 'Missing meal or option reference' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        try {
          await env.DB.prepare('INSERT INTO meal_options (meal_ref_id, option_ref_id) VALUES (?, ?)').bind(mealRef, optionRef).run();
        } catch (e) {
          // Ignore duplicate linking
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Create a new pricing rule
      if (path === '/api/admin/pricing-rules' && method === 'POST') {
        const body = await request.json();
        const variantId = body.meal_variant_id;
        const minQty = body.min_total_quantity;
        const pricePerUnit = body.price_per_unit;
        if (!variantId || minQty == null || pricePerUnit == null) {
          return new Response(JSON.stringify({ error: 'Missing pricing rule fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const createdAt = getPSTTimestamp();
        await env.DB.prepare('INSERT INTO meal_order_pricing_rules (meal_variant_id, min_total_quantity, price_per_unit, created_at) VALUES (?, ?, ?, ?)').bind(variantId, minQty, pricePerUnit, createdAt).run();
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // List all option groups (with their values)
      if (path === '/api/admin/options' && method === 'GET') {
        const optsRes = await env.DB.prepare('SELECT id, ref_id, name, is_required, is_multi_select, is_active, version FROM options WHERE is_active = 1').all();
        const options = optsRes.results || [];
        for (const opt of options) {
          const valsRes = await env.DB.prepare('SELECT id, name, extra_cost, is_active, version FROM option_values WHERE option_ref_id = ? AND is_active = 1').bind(opt.ref_id).all();
          opt.values = valsRes.results || [];
        }
        return new Response(JSON.stringify({ options: options }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // List all pricing rules
      if (path === '/api/admin/pricing-rules' && method === 'GET') {
        const rulesRes = await env.DB.prepare(
          'SELECT r.id, r.meal_variant_id, r.min_total_quantity, r.price_per_unit, ' +
          'v.name AS variant_name, m.name AS meal_name ' +
          'FROM meal_order_pricing_rules r ' +
          'JOIN meal_variants v ON r.meal_variant_id = v.id AND v.is_active = 1 ' +
          'JOIN meals m ON v.meal_ref_id = m.ref_id AND m.is_active = 1'
        ).all();
        return new Response(JSON.stringify({ pricing_rules: rulesRes.results || [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      // List all orders (admin view)
      if (path === '/api/admin/orders' && method === 'GET') {
        const ordersRes = await env.DB.prepare(
          'SELECT o.id, o.user_id, o.status, o.total_price, o.created_at, o.updated_at, ' +
          'u.name AS user_name, u.email AS user_email, ' +
          'ow.week_start_date, ow.week_end_date ' +
          'FROM orders o ' +
          'JOIN users u ON o.user_id = u.id ' +
          'JOIN order_weeks ow ON o.order_week_id = ow.id ' +
          'ORDER BY o.created_at DESC'
        ).all();
        const orders = ordersRes.results || [];
        
        // Get order items for each order
        for (const order of orders) {
          const itemsRes = await env.DB.prepare(
            'SELECT oi.quantity, oi.base_price, ' +
            'mv.name AS variant_name, m.name AS meal_name ' +
            'FROM order_items oi ' +
            'JOIN meal_variants mv ON oi.meal_variant_id = mv.id ' +
            'JOIN meals m ON mv.meal_ref_id = m.ref_id ' +
            'WHERE oi.order_id = ?'
          ).bind(order.id).all();
          order.items = itemsRes.results || [];
        }
        
        return new Response(JSON.stringify({ orders: orders }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
    // For any other request, serve static assets
    return env.ASSETS.fetch(request);
  }
};
