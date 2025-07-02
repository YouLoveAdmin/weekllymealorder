# Weekly Lunch Ordering System – Setup & Usage
**Platform:** Cloudflare Workers with D1 (database) and static assets.

## Setup and Deployment
1. **Install Dependencies:** Ensure Node.js is installed. Run `npm install` to install all dependencies.
2. **Cloudflare Configuration:** Set environment variables used by `wrangler.toml`:
   - `CLOUDFLARE_ACCOUNT_ID` – your Cloudflare account ID.
   - `D1_DATABASE_ID` – the ID of the D1 database named `lunch_orders` (create it with `wrangler d1 create lunch_orders`).
3. **Database Schema:** Apply the schema and seed data to your D1 database:
```bash
npx wrangler d1 execute lunch_orders --file=schema.sql
```
This will create all tables and insert initial data (meals, options, admin users, etc.).
4. **Build Frontend:** Compile the Svelte application with Tailwind:
```bash
npm run build
```
This outputs static assets to the `dist` directory (which the Worker will serve).
5. **Cloudflare Access:** Configure Cloudflare Access to protect the application. Only authenticated users can reach the site, and the Worker relies on the `cf-access-authenticated-user-email` header to identify users. Ensure your Access policy passes this header. To grant admin rights, use the seeded admin emails (`alice@example.com`, `bob@example.com`) or update the `admin_users` table with your own email/user.
6. **Development:** During development, run:
```bash
npm run dev
```
This will watch and rebuild the frontend on changes and run `wrangler dev` to serve the Worker locally. The application will be available at the localhost test address (by default, http://127.0.0.1:8787).
7. **Testing:** Log in via Cloudflare Access. Regular users will see the weekly menu at the root URL (`/`). Admin users can access the admin interface at `/admin.html` (the Worker also redirects `/admin` to this page).
8. **Deployment:** When ready to deploy, run:
```bash
npx wrangler publish
```
This will upload the Worker script and static assets to Cloudflare. Once published, the app will be live on your workers.dev subdomain or your configured custom domain route.

## Usage
- **User View:** Authenticated users can view the weekly menu on the home page. They can select a quantity for each meal variant and choose options (e.g., Spice Level, Add Sauce). Clicking "Place Order" will submit their order. The interface will display the user's current order for the week and the total price. Users are limited to one order per week; attempting to place a second order will be prevented.
- **Admin View:** Users marked as admins (in the `admin_users` table) can access the admin interface at `/admin.html`. The admin page provides:
  - **Meal Management:** Add new meals and their descriptions. Add variants (sizes with price and calories) to each meal.
  - **Option Management:** Create option groups (with flags for required/multi-select) and add option values (with extra costs). These option groups can be linked to meals.
  - **Pricing Rules:** Define quantity-based discounts for meal variants by specifying a minimum quantity and a discounted price per unit.
Changes made in the admin interface take effect immediately (they update the D1 database). Regular users will see updated menus or prices as soon as the data is changed.

## Security & Notes
- Cloudflare Access ensures only authorized users reach the application. The Worker verifies the user email on every request (`cf-access-authenticated-user-email` header).
- The `admin_users` table controls admin privileges within the app. Non-admin users cannot access admin API routes (the Worker returns 403 Forbidden for those attempts).
- All important calculations and validations (like total price, discount rules, one-order-per-week enforcement) are performed server-side in the Worker for security.
- The database uses *immutable versioning* for meals, options, etc. In this simple setup, we always fetch and manipulate the active version of each item. When updating an entity, the intended approach is to insert a new row with an incremented version and mark the old version as inactive (preserving historical data integrity for past orders).
