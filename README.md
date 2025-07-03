# Weekly Lunch Ordering System
**Platform:** Cloudflare Workers with D1 (database) and static assets.

## Quick Start

For detailed setup instructions, see [SETUP.md](SETUP.md).

## Prerequisites
- Node.js installed
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler`

## Setup and Deployment

1. **Clone and Install**
   ```bash
   git clone <your-repo-url>
   cd weekly-lunch-orders
   npm install
   ```

2. **Configure Wrangler**
   - Copy `wrangler.toml.template` to `wrangler.toml`
   - Replace `YOUR_CLOUDFLARE_ACCOUNT_ID` with your actual account ID
   - Replace `YOUR_D1_DATABASE_ID` with your D1 database ID

3. **Authenticate and Setup Database**
   ```bash
   npx wrangler login
   npx wrangler d1 create lunch_orders  # if database doesn't exist
   npx wrangler d1 execute lunch_orders --remote --file=schema.sql
   ```

4. **Build and Deploy**
   ```bash
   npm run build
   npx wrangler deploy
   ```

## Usage

### User Interface
- **Home Page (/):** Authenticated users can view the weekly menu, select meal quantities, choose options (spice level, add-ons), and place orders
- **Order Limits:** Users are limited to one order per week
- **Real-time Updates:** Menu and pricing changes by admins are immediately visible

### Admin Interface (/admin)
Admin users can access the management interface at `/admin.html`:
- **Meal Management:** Add/edit meals and their descriptions
- **Variant Management:** Create meal variants with different sizes, prices, and calories
- **Option Management:** Create option groups (required/multi-select) and option values with extra costs
- **Pricing Rules:** Define quantity-based discounts
- **Order Overview:** View and manage all user orders

## Development

- **Development server:** `npm run dev` (builds frontend with watch mode)
- **Build for production:** `npm run build`
- **Deploy:** `npx wrangler deploy`
- **Local testing:** Available at http://127.0.0.1:8787 during development

## Configuration

### Cloudflare Access Setup
Configure Cloudflare Access to protect the application:
- Only authenticated users can reach the site
- The Worker relies on the `cf-access-authenticated-user-email` header to identify users
- Ensure your Access policy passes this header

### Admin User Setup
Grant admin privileges by adding users to the `admin_users` table:
```bash
npx wrangler d1 execute lunch_orders --remote --command "INSERT INTO admin_users (user_id, role, is_active) SELECT id, 'admin', 1 FROM users WHERE email = 'your-email@domain.com';"
```

## Architecture

- **Frontend:** Svelte with Tailwind CSS
- **Backend:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite-compatible)
- **Authentication:** Cloudflare Access
- **Deployment:** Serverless on Cloudflare's edge network

## Important Files

### Included in Repository
- `wrangler.toml.template` - Configuration template (safe to share)
- `schema.sql` - Database schema and seed data
- `src/` - Source code (Worker and Svelte components)
- `SETUP.md` - Detailed setup instructions

### Excluded from Repository (see .gitignore)
- `wrangler.toml` - Contains sensitive account/database IDs
- `node_modules/` - Dependencies (install with `npm install`)
- `dist/` - Build output (generated with `npm run build`)
- `.wrangler/` - Wrangler cache and local state

## Security & Technical Notes

### Security
- **Authentication:** Cloudflare Access ensures only authorized users can access the application
- **Authorization:** Admin privileges are controlled via the `admin_users` table
- **Server-side Validation:** All calculations, pricing, and order limits are enforced server-side
- **Data Integrity:** Database uses immutable versioning for audit trails

### Technical Details
- **Edge Computing:** Runs on Cloudflare's global edge network for low latency
- **Serverless:** No server management required, scales automatically
- **Database:** D1 provides SQLite-compatible database with global replication
- **Static Assets:** Frontend is served as static files from Cloudflare's CDN

## Contributing

1. Follow the setup instructions in [SETUP.md](SETUP.md)
2. Make your changes
3. Test locally with `npm run dev`
4. Deploy with `npx wrangler deploy`

## Support

For issues or questions:
- Check the [SETUP.md](SETUP.md) for detailed configuration steps
- Review the database schema in `schema.sql`
- Examine the Worker API in `src/worker.ts`
