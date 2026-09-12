# Private administration

The storefront remains at `/`. Staff sign in at `/admin/login`. The customer navigation contains no staff links. Both interfaces reuse the existing MySQL database and commerce records.

## Authentication and authorization

Existing `users`, `roles` and `user_roles` are reused. Staff use `admin_sessions`, a separately named HttpOnly/Secure/SameSite=Strict cookie, an eight-hour lifetime (seven days with Remember Me), and a 30-minute inactivity timeout. Customer cookies do not authorize admin APIs. Staff passwords cannot log into the customer login. Login rotates the staff session. Disabled staff and revoked permissions are checked on each request.

`admin_permissions` and `admin_role_permissions` contain module/action grants. Default roles are initialized once; subsequent deployments preserve edits. Only owners can manage staff, change role grants, or modify sensitive settings. Staff changes require the acting owner's password and revoke the target's sessions. No fixed default production password is supplied.

Every admin page is server guarded, and every admin API is independently permission guarded. Role-aware navigation is convenience, not the security boundary. Authentication is rate limited by account and request IP. Sensitive values are removed from audit details. `admin_security_events` records staff login failures/successes, resets and session revocations. Audit mutations record intent before handling and the resulting HTTP status; an interrupted request remains visibly STARTED for review.

## Operating modules

- Existing product/category/brand, cart, order, coupon, review, customer and inventory data are shared.
- Products support extra variants, variant enable/disable, specification editing and duplication into an unpublished, zero-stock copy.
- Warehouse creation/editing, atomic stock transfers and inventory movement history are available.
- Payments display stored gateway references, transactions, failures and refund records. No card numbers or CVV are stored or displayed.
- Invoices use a staff-permission-checked PDF endpoint. Customer PDF downloads remain ownership checked.
- Staff can publish answers to customer product questions.
- Banner, homepage, offer and blog content has draft/published state, schedule, order, reviewed image references and safe store-relative links. Public content comes from MySQL, is escaped as text, and refreshes each minute.
- Reports include actual daily collections, GST, completed refunds, order counts, top purchased products, payment methods, and CSV export. These are not profit or site-visitor conversion reports.
- The staff work queue derives pending orders, returns, support and low-stock alerts from the permitted modules.
- COD refunds can record completed offline transfers with reference, explicit confirmation and staff re-authentication. This action records evidence; it does not initiate a bank transfer. Replays cannot create another refund transaction.
- Completed refunds append customer-visible history and notifications. Sellable returns use the original order warehouse allocation.

## Background jobs and email

The deployed bootstrap starts a maintenance request every minute using a per-process secret, never exposed to the browser. It releases expired inventory holds and cleans expired sessions/rate-limit rows. Resend email delivery processes the MySQL outbox only when `RESEND_API_KEY` and `EMAIL_FROM` are configured. Failed sends retry with a lease and idempotency key; ambiguous old sends require review. Test recipients under `.test` are never mailed. Missing credentials leave mail queued and do not report delivery.

API references: [Resend sending](https://resend.com/docs/api-reference/emails/send-email) and [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Verification and remaining gates

`mysql-admin-acceptance.mjs` verifies customer denial, forged-cookie denial, private-page redirect, staff permissions, CSRF, session termination, product/price changes, transfers, content publication and redacted audit history. The existing MySQL suite covers COD checkout, stock, invoice, fulfillment, review and support, plus returns and a sandbox manual-transfer record. These tests do not move real money.

This is an implementation checkpoint, not a claim that every item in ADMIN_REQUIREMENTS.md is finished. Live Razorpay, real email/SMS, uploaded files, stronger privileged-account MFA, backups/restores, complete product metadata/imports/bulk operations, all dashboard/report dimensions, replacement fulfillment, loyalty/referrals and remaining integrations still require implementation or verification. Keep staging enabled until all release gates are passed. Never reset or drop existing commerce data to run tests.
