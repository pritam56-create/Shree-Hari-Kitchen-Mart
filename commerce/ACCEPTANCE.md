# Release status — incomplete

## Implemented source — core COD workflow verified against MySQL

- MySQL-only Prisma relational schema, generated migration and database-level checks.
- Bcrypt password hashing; cookie sessions; customer, admin and super-admin roles; password change and reset-token endpoints.
- Product and variant catalog, category/brand filters, database search and autocomplete, price sorting, 37 development seed records.
- Persistent registered cart, guest-cart merge, saved-for-later, wishlist and four-product comparison.
- Address management and merchant-configured PIN-code serviceability.
- Server-authoritative totals, inclusive GST, fixed/percentage coupons and restriction checks.
- Stock reservations; serializable checkout confirmation; immutable order and invoice snapshots; unique idempotency keys.
- Razorpay order creation, HMAC verification, captured-payment fetch and capture/failure webhooks; real unpaid COD orders.
- Customer order history/tracking and PDF invoice download.
- Admin product edit/create/disable, reviewed-image metadata, categories, brands, stock adjustments, orders/statuses, customers, coupons, delivery coverage and business settings.
- Delivered/paid verified-review eligibility, moderation, support tickets and staff responses.
- Return request/approval/receipt/restocking, Razorpay refund submission and reconciliation states.
- Cancellation reverses the original warehouse-level inventory movements inside the order transaction. Missing or inconsistent deduction records block cancellation instead of inventing a warehouse allocation.
- Private `/admin/login`, separate staff sessions, server page guards, granular role grants, staff account management, session revocation and redacted audit/security logs.
- Additional variant/specification editing, unpublished duplication, warehouse management and transactional stock transfers.
- Scheduled banner/homepage/blog/offer publication, product answers, staff search/work queue, payment records and sales CSV reports.
- Scheduled inventory-hold expiry and Resend outbox processing (delivery requires configured credentials).
- Original-warehouse return restocking and idempotent recording of completed COD bank transfers, with customer-visible refund history. Recording a transfer does not initiate a transfer.

## Acceptance not yet established

The expanded private-admin and COD suites **passed on 2026-09-14**, deployment `3044c265-64dd-47af-88c7-d2974f336fe0`, commit `fb2a00d12d08e2a817b6069b7ae4c5c7d78a9c9e`. Railway logs confirmed the additive migration, preserved seed data, return/restock and idempotent sandbox transfer-record tests, concurrent cancellation protection, and the private admin suite: separate sessions, RBAC, CSRF, staff revocation, catalog changes, stock transfers, publishing and redacted audit. No real funds were transferred by these tests. The live private login is `/admin/login`.

The requested 40-step Razorpay end-to-end acceptance test has **not passed** because gateway credentials are not configured. The real MySQL COD acceptance flow **passed** on Railway deployment `98b820f0-531a-4da8-95da-d62b2a96abfe` on 2026-09-12. Logs confirmed migration, 37 seeded products, and the complete COD acceptance result before public startup.

Verified against MySQL: customer registration/login/logout, wishlist/cart changes, coupon calculation, address storage, idempotent COD order creation, order and payment rows, inventory deduction, invoice creation/PDF output, customer/admin order retrieval, fulfillment through delivery and payment collection, verified review eligibility, customer support ticket, staff response and customer retrieval.

Public staging: https://shree-hari-store-production.up.railway.app/
The public health endpoint returned HTTP 200 with `database: mysql`. Browser checks confirmed the 37-product catalog and a category/price filter reducing it to one matching appliance.

On 2026-09-12, deployment `79a0331c-42fd-4cae-9294-a8e32584ca2a` ran commit `00eca48c42b983c3a188abee6809c4bef6a3a311` and passed the expanded MySQL acceptance suite. A dedicated test appliance held one unit in one warehouse and two in another. Checkout deducted all three, and simultaneous cancellation requests restored each warehouse exactly once, produced one cancellation history entry, and kept the unpaid COD payment pending. The fixture was disabled after the test. Eight local rules tests and the production build also passed. Razorpay remains unverified.

Deployment note: Railway's redeploy operation rebuilds the previous deployment's commit. Use a fresh source deployment with the intended commit SHA, and verify the deployment metadata and runtime acceptance logs.

1. Provision MySQL 8 and run the generated migration against a clean staging database.
2. Seed staging; exercise `mysql-acceptance.mjs` against a database ending in `_test` with `ALLOW_DATABASE_TESTS=1`, `TEST_BASE_URL`, `DATABASE_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Run browser tests at desktop and mobile widths, including refresh/relogin persistence, guest-cart merging, 401/403 ownership checks and every rendered action.
4. Complete actual Razorpay test payments, declines, duplicate callbacks, captured webhooks without a browser callback, webhook replay, delayed capture after reservation expiry, capture/stock/coupon races and refund reconciliation.
5. Concurrently purchase the last item; verify no negative stock or duplicate orders. Test transaction rollback and database restart recovery.
6. Review actual invoice PDFs against merchant tax/business requirements and multi-page orders. Download works in source; rendering and real data have not been verified.
7. Audit permissions, CSRF, rate limits, load, backups/restores, secrets and security dependencies. Confirm supplier stock, tax rates, warranties, product images and shipping commitments.

## Known missing features — do not advertise these as complete

- Mobile OTP login, email/phone verification delivery and SMS integration. Resend outbox processing exists; real password-reset/order-email delivery is unverified without credentials.
- Automatic captured-payment reconciliation, cancelled-paid-order refunds and provider refund-status polling. Signed processed-refund webhooks append completion history, but the real gateway flow is not yet tested.
- Bank transfer proof-file uploads and replacement fulfillment. COD transfer references can be recorded after staff confirmation.
- Remaining product metadata, bulk operations/import/export, hard deletion policies and richer category/brand management.
- Wishlist sharing, helpful/reported reviews, review/return/support file uploads and question moderation. Staff answers are now presented on product pages.
- Loyalty, referrals, recently viewed, search-history/trending/typo tolerance, gift cards, subscriptions and cart recovery.
- Extended reporting/conversion/profit metrics and all remaining ancillary schema tables. Basic CMS publication and sales reporting exist.
- Stripe/EMI adapters, image storage integration and logistics tracking API synchronization. Configuration names alone are not working integrations.
- Guest checkout without registration; guest cart is supported, but checkout currently requires an account.
- Product imagery, complete requested route coverage, final visual polish, SEO metadata per product and PWA/offline behavior.

## Publication blockers

- Railway project: `bcecc972-fc7d-4b1d-87be-67d4d9f2d825`; environment: `6d58a291-d187-41d6-a9fe-8ce7e8f2ef99`.
- MySQL service: `2c1e9f6b-e04f-4abe-8c9d-17754c44da2f`; image `mysql:8.4`; persistent volume `8c9092f5-1fbb-41f1-9333-028354126884` at `/var/lib/mysql`.
- GitHub repository is available at `pritam56-create/Shree-Hari-Kitchen-Mart`.
- Public staging may be used to exercise implemented workflows. It must not accept real sales until the remaining release gates are passed.

Do not publish this source as production-ready until the missing functionality and validation gates above are completed.
