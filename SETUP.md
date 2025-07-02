# Setup Instructions

## Prerequisites
- Node.js installed
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd weekly-lunch-orders
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Wrangler**
   - Copy `wrangler.toml.template` to `wrangler.toml`
   - Replace `YOUR_CLOUDFLARE_ACCOUNT_ID` with your actual account ID
   - Replace `YOUR_D1_DATABASE_ID` with your D1 database ID

4. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

5. **Create D1 Database** (if not exists)
   ```bash
   npx wrangler d1 create lunch_orders
   ```
   Copy the database ID to your `wrangler.toml`

6. **Apply Database Schema**
   ```bash
   npx wrangler d1 execute lunch_orders --remote --file=schema.sql
   ```

7. **Build the frontend**
   ```bash
   npm run build
   ```

8. **Deploy**
   ```bash
   npx wrangler deploy
   ```

## Development

- Run development server: `npm run dev`
- Build for production: `npm run build`
- Deploy: `npx wrangler deploy`

## Important Files Not in Repository

- `wrangler.toml` - Contains sensitive account/database IDs
- `node_modules/` - Dependencies (install with `npm install`)
- `dist/` - Build output (generated with `npm run build`)
- `.wrangler/` - Wrangler cache and local state
