# Release status — incomplete

## Implemented source, requiring MySQL integration verification

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

## Acceptance not yet established

The requested 40-step Razorpay end-to-end acceptance test has **not passed** because gateway credentials are not configured. The real MySQL COD acceptance flow **passed** on Railway deployment `98b820f0-531a-4da8-95da-d62b2a96abfe` on 2026-09-12. Logs confirmed migration, 37 seeded products, and the complete COD acceptance result before public startup.

Verified against MySQL: customer registration/login/logout, wishlist/cart changes, coupon calculation, address storage, idempotent COD order creation, order and payment rows, inventory deduction, invoice creation/PDF output, customer/admin order retrieval, fulfillment through delivery and payment collection, verified review eligibility, customer support ticket, staff response and customer retrieval.

Public staging: https://shree-hari-store-production.up.railway.app/
The public health endpoint returned HTTP 200 with `database: mysql`. Browser checks confirmed the 37-product catalog and a category/price filter reducing it to one matching appliance.

1. Provision MySQL 8 and run the generated migration against a clean staging database.
2. Seed staging; exercise `mysql-acceptance.mjs` against a database ending in `_test` with `ALLOW_DATABASE_TESTS=1`, `TEST_BASE_URL`, `DATABASE_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Run browser tests at desktop and mobile widths, including refresh/relogin persistence, guest-cart merging, 401/403 ownership checks and every rendered action.
4. Complete actual Razorpay test payments, declines, duplicate callbacks, captured webhooks without a browser callback, webhook replay, delayed capture after reservation expiry, capture/stock/coupon races and refund reconciliation.
5. Concurrently purchase the last item; verify no negative stock or duplicate orders. Test transaction rollback and database restart recovery.
6. Review actual invoice PDFs against merchant tax/business requirements and multi-page orders. Download works in source; rendering and real data have not been verified.
7. Audit permissions, CSRF, rate limits, load, backups/restores, secrets and security dependencies. Confirm supplier stock, tax rates, warranties, product images and shipping commitments.

## Known missing features — do not advertise these as complete

- Mobile OTP login, email/phone verification delivery, email/SMS provider workers and password-reset email delivery. Reset and order notifications are stored in the outbox; no sender runs yet.
- Automatic captured-payment reconciliation, expiration scheduling, cancelled-paid-order refunds, provider refund-status polling/webhooks and completed-refund order histories. These currently require further implementation, not just credentials.
- COD bank-refund reference/proof handling and replacement fulfillment.
- Full multi-variant/specification editing, hard deletion/duplication, warehouse administration and inventory-restoration routing to the original warehouse.
- Wishlist sharing, helpful/reported reviews, review/return/support file uploads, customer questions/answers presentation and moderation.
- Loyalty, referrals, recently viewed, search-history/trending/typo tolerance, gift cards, subscriptions and cart recovery.
- CMS banners/blog/promotions, extended analytics/revenue charts/conversion metrics and all requested ancillary schema tables.
- Stripe/EMI adapters, image storage integration and logistics tracking API synchronization. Configuration names alone are not working integrations.
- Guest checkout without registration; guest cart is supported, but checkout currently requires an account.
- Product imagery, complete requested route coverage, final visual polish, SEO metadata per product and PWA/offline behavior.

## Publication blockers

- Railway project: `bcecc972-fc7d-4b1d-87be-67d4d9f2d825`; environment: `6d58a291-d187-41d6-a9fe-8ce7e8f2ef99`.
- MySQL service: `2c1e9f6b-e04f-4abe-8c9d-17754c44da2f`; image `mysql:8.4`; persistent volume `8c9092f5-1fbb-41f1-9333-028354126884` at `/var/lib/mysql`.
- GitHub repository is available at `pritam56-create/Shree-Hari-Kitchen-Mart`.
- Public staging may be used to exercise implemented workflows. It must not accept real sales until the remaining release gates are passed.

Do not publish this source as production-ready until the missing functionality and validation gates above are completed.
