# Shree Hari Kitchen Mart

Next.js kitchen-appliance commerce application with MySQL 8, Prisma, customer and administrator accounts, database-backed shopping, server-verified Razorpay payments, orders, inventory and PDF invoices.

This is an active implementation, not a production-certified release. See [acceptance status](commerce/ACCEPTANCE.md) for unfinished features and verification gates. All sample product content is vegetarian-only.

## Development

1. Install Node.js 24 and pnpm 11.25.0, then run `pnpm install --frozen-lockfile`.
2. Configure `DATABASE_URL` for MySQL 8 and `APP_URL` for the app origin. Use `commerce/.env.example` as the variable reference. Export variables for Prisma CLI; Next can also read `commerce/.env.local`.
3. Run `pnpm commerce:migrate`.
4. On a development database, run `pnpm commerce:seed` for 37 sample appliances. An initial super administrator is created only if `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 16 characters are supplied. No default password exists.
5. Run `pnpm dev`, or `pnpm build` and `pnpm start`.

## Deployment

The Railway configuration builds `commerce/Dockerfile`. Attach a MySQL 8 service with a persistent volume, configure the app's `DATABASE_URL` using private-network variable references, and set its public HTTPS origin in `APP_URL`. `/api/health` verifies database connectivity.

Seed content is not a supplier-verified commercial catalog. Configure merchant details, actual product prices/stock, warranty terms, reviewed images and supported delivery PIN codes before accepting public orders. Cash-on-delivery orders are unpaid until collection is recorded. Online payments require configured Razorpay credentials and captured-payment verification; no simulated payment success is implemented.

## Tests

`pnpm test` checks money calculations, GST, coupon allocation, content policy and order transitions. `commerce/tests/mysql-acceptance.mjs` is the MySQL integration harness for the customer-to-admin COD flow; it does not certify Razorpay payments.
