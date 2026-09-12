Create a complete, production-ready, private ADMIN PANEL for my EXISTING kitchen appliances e-commerce website.

IMPORTANT CONTEXT:

The customer-facing e-commerce website is already created.

Do NOT redesign or rebuild the customer-facing website.

I now want to create a completely separate ADMIN SIDE that connects to the SAME EXISTING BACKEND and SAME EXISTING MYSQL DATABASE.

The admin system must allow the website owner and authorized staff to manage the entire e-commerce website without exposing admin functionality to normal customers.

HIGHEST PRIORITY REQUIREMENTS:

1. Keep the existing customer website unchanged.
2. Use the SAME existing MySQL database.
3. Use the SAME product, customer, order, payment, inventory, coupon, review and other existing database records.
4. Do NOT create a separate database for the admin panel.
5. Create a separate secure admin authentication system.
6. Normal customers must NEVER be able to access admin pages.
7. Admin pages must NOT appear in customer navigation, sitemap, menus or customer-facing UI.
8. Protect every admin page and every admin API endpoint with server-side authorization.
9. Do not rely on simply hiding the admin URL.
10. Build a real working admin system, not a visual mockup.

---

## ADMIN ACCESS STRUCTURE

Use a structure such as:

Customer Website:

[https://yourdomain.com](https://yourdomain.com/)

Customer Account:

[https://yourdomain.com/account](https://yourdomain.com/account)

Admin Login:

[https://yourdomain.com/admin/login](https://yourdomain.com/admin/login)

Admin Dashboard:

[https://yourdomain.com/admin](https://yourdomain.com/admin)

Admin Product Management:

[https://yourdomain.com/admin/products](https://yourdomain.com/admin/products)

Admin Orders:

[https://yourdomain.com/admin/orders](https://yourdomain.com/admin/orders)

Admin Inventory:

[https://yourdomain.com/admin/inventory](https://yourdomain.com/admin/inventory)

Admin Customers:

[https://yourdomain.com/admin/customers](https://yourdomain.com/admin/customers)

Admin Payments:

[https://yourdomain.com/admin/payments](https://yourdomain.com/admin/payments)

Admin Returns:

[https://yourdomain.com/admin/returns](https://yourdomain.com/admin/returns)

Admin Settings:

[https://yourdomain.com/admin/settings](https://yourdomain.com/admin/settings)

Do NOT display the admin login link anywhere on the normal customer website.

---

## VERY IMPORTANT SECURITY PRINCIPLE

The admin system must NOT be secured only by hiding:

/admin

Anyone can guess a URL.

Every admin request must be validated by the backend.

For every protected admin page:

1. Check whether the user is authenticated.
2. Check whether their account is active.
3. Check whether their role allows admin access.
4. Check whether they have permission for the requested module.
5. Reject unauthorized requests server-side.

If a normal customer visits:

/admin

they must receive:

403 Forbidden

or be redirected away from the admin portal.

A customer must NEVER be able to gain admin access simply by modifying frontend JavaScript, URLs, cookies or API requests.

---

## SAME MYSQL DATABASE

MYSQL IS THE ONLY PRIMARY DATABASE.

Connect this admin panel to the SAME MySQL database already being used by the customer website.

Do NOT create duplicate copies of:

- Products
- Customers
- Orders
- Payments
- Inventory
- Coupons
- Reviews
- Addresses
- Returns
- Refunds
- Invoices

When the admin modifies something, the existing customer website should reflect the change.

Example:

Admin changes:

Product stock:
50 → 30

Customer website should immediately show:

Stock = 30

Admin changes:

Sale Price:
₹8,999 → ₹7,499

Customer website should show:

₹7,499

Admin disables a product.

Customer website should stop showing that product.

---

## ADMIN DATABASE TABLES

Reuse existing tables wherever appropriate.

Add admin-specific tables if they do not already exist.

Recommended tables:

admins

admin\_roles

admin\_permissions

admin\_role\_permissions

admin\_sessions

admin\_activity\_logs

audit\_logs

admin\_login\_attempts

admin\_notifications

Example admins table fields:

id
name
email
phone
password\_hash
role\_id
status
last\_login\_at
created\_at
updated\_at

NEVER store admin passwords as plain text.

Use:

Argon2

or

bcrypt

---

## ADMIN ROLES

Create Role-Based Access Control.

Support roles such as:

SUPER\_ADMIN

ADMIN

PRODUCT\_MANAGER

ORDER\_MANAGER

INVENTORY\_MANAGER

FINANCE\_MANAGER

CUSTOMER\_SUPPORT

CONTENT\_MANAGER

MARKETING\_MANAGER

---

## SUPER ADMIN

SUPER\_ADMIN is the website owner.

SUPER\_ADMIN has access to everything.

SUPER\_ADMIN can:

- Manage products
- Manage categories
- Manage brands
- Manage inventory
- Manage orders
- Manage customers
- Manage payments
- Manage returns
- Manage refunds
- Manage coupons
- Manage banners
- Manage website content
- Manage reviews
- Manage support
- View analytics
- Change website settings
- Manage staff/admin accounts
- Manage roles
- Manage permissions
- View audit logs
- View security logs

Only SUPER\_ADMIN should be able to:

- Create other admins
- Disable admins
- Change staff roles
- Change staff permissions
- Access sensitive store settings
- Manage payment configuration
- Manage tax configuration
- Manage API configuration

---

## ADMIN LOGIN

Create a separate professional admin login page.

Admin login should contain:

Email

Password

Remember Me

Forgot Password

Login

Optional:

Two-factor authentication

OTP

Authenticator app

The admin login design must be visually different from the customer login.

Do not allow customer accounts to login through the admin login.

---

## ADMIN SESSION SECURITY

After successful authentication:

Create a secure admin session.

Use:

HttpOnly cookies

Secure cookies

SameSite protection

Session expiration

Session rotation

CSRF protection where applicable

Require re-authentication for highly sensitive actions if necessary.

---

## ADMIN DASHBOARD

Create a premium private dashboard.

Main dashboard should show real data from MySQL.

Display:

Total Revenue

Today's Revenue

Monthly Revenue

Total Orders

Today's Orders

Pending Orders

Processing Orders

Packed Orders

Shipped Orders

Delivered Orders

Cancelled Orders

Returns

Refunds

Total Customers

New Customers

Total Products

Active Products

Inactive Products

Low Stock Products

Out of Stock Products

Average Order Value

Conversion Metrics

Top Products

Top Categories

Top Brands

Recent Orders

Recent Customers

Recent Returns

Recent Refunds

Charts:

Daily sales

Weekly sales

Monthly sales

Revenue trend

Order trend

Category sales

Payment method distribution

Use actual database queries.

Do NOT hardcode dashboard numbers.

---

## ADMIN SIDEBAR

Create a professional sidebar containing:

Dashboard

Products

Categories

Brands

Inventory

Orders

Customers

Payments

Invoices

Returns

Refunds

Coupons

Offers

Reviews

Questions & Answers

Support

Banners

Homepage Content

Blog

Notifications

Reports

Analytics

Admins

Roles & Permissions

Audit Logs

Settings

Logout

Show menu items according to the logged-in admin's permissions.

---

## PRODUCT MANAGEMENT

Create a complete product management system.

Admin can:

View all products

Search products

Filter products

Sort products

Add product

Edit product

Duplicate product

Archive product

Disable product

Enable product

Delete product according to business rules

Bulk update products

Bulk update prices

Bulk update stock

Export products

Import products

---

## ADD PRODUCT FORM

Product form should contain:

Product Name

Slug

SKU

Brand

Category

Subcategory

Short Description

Full Description

MRP

Selling Price

Discount

GST

Cost Price

Stock Quantity

Low Stock Threshold

Warranty

Weight

Dimensions

Color

Capacity

Wattage

Material

Model Number

Country of Origin

Shipping Weight

Status

Featured Product

Best Seller

New Arrival

SEO Title

SEO Description

SEO Keywords

Product Images

Product Video

Specifications

Variants

---

## STRICT VEGETARIAN POLICY

This existing store follows a strict vegetarian-content policy.

The admin system must preserve this rule.

Do NOT allow:

Egg-related products

Meat-specific appliances

Chicken-related content

Fish-related content

Seafood-related content

Meat processing equipment

Non-vegetarian recipe content

Add a mandatory admin confirmation before publishing a product:

VEGETARIAN COMPLIANCE

“I confirm that this product and its marketing content contain no eggs, meat, chicken, fish, seafood or other non-vegetarian content.”

Require confirmation before publishing.

---

## IMAGE MANAGEMENT

Allow admin to:

Upload multiple product images

Change primary image

Reorder images

Delete images

Preview images

Add image alt text

Upload product videos

Use existing configured storage such as Cloudinary or S3-compatible storage.

Store references in the same MySQL product data structure.

---

## CATEGORY MANAGEMENT

Admin can:

Create category

Edit category

Delete category according to business rules

Enable/disable category

Create nested category

Upload category image

Set category description

Set SEO information

Change sort order

---

## BRAND MANAGEMENT

Admin can:

Add brand

Edit brand

Disable brand

Upload logo

Add brand description

Set brand SEO information

---

## INVENTORY MANAGEMENT

Create complete real-time inventory management.

Show:

SKU

Product

Variant

Current Stock

Reserved Stock

Available Stock

Low Stock Level

Warehouse

Last Updated

Admin can:

Increase stock

Decrease stock

Transfer stock

Correct stock

Add inventory notes

View inventory history

Every inventory change must create an inventory transaction record.

Example:

Product:
Philips Air Fryer

Previous Stock:
45

Adjustment:
+20

New Stock:
65

Reason:
New supplier stock

Changed By:
Admin

Date:
...

---

## ORDER MANAGEMENT

Admin must see every order from the existing customer website.

Order table:

Order Number

Customer

Order Date

Products

Amount

Payment Status

Order Status

Delivery Status

Actions

Filters:

New

Confirmed

Processing

Packed

Shipped

Out for Delivery

Delivered

Cancelled

Returned

Refunded

---

## ORDER DETAIL PAGE

Show:

Order Number

Order Date

Customer

Customer Contact

Billing Address

Shipping Address

Products

Variants

SKU

Quantity

Prices

Discounts

Taxes

Shipping Charges

Total

Payment Status

Payment Method

Payment ID

Invoice

Order Timeline

Tracking Number

Courier

Customer Notes

Admin Notes

Admin actions:

Confirm order

Process order

Mark packed

Mark shipped

Add tracking number

Change courier

Mark out for delivery

Mark delivered

Cancel order

Start refund

Approve return

Print invoice

Download invoice

Contact customer

---

## ORDER STATUS HISTORY

Never overwrite order status history.

Record every change.

Example:

10:30 AM

Order Confirmed

Changed by:
System

11:45 AM

Processing

Changed by:
Admin Rahul

2:15 PM

Packed

Changed by:
Warehouse Manager

Store this history in MySQL.

---

## CUSTOMER MANAGEMENT

Admin can view customer accounts.

Show:

Customer ID

Name

Email

Phone

Join Date

Total Orders

Lifetime Spend

Average Order Value

Returns

Refunds

Account Status

Admin can open customer profile.

Show:

Customer Information

Addresses

Orders

Invoices

Reviews

Wishlist

Support Tickets

Returns

Refunds

Loyalty Points

Notifications

Do NOT expose sensitive passwords.

Do NOT expose raw payment card information.

---

## PAYMENT MANAGEMENT

Create a payment dashboard.

Show:

Transaction ID

Order Number

Customer

Amount

Payment Gateway

Payment Method

Status

Date

Support statuses:

Paid

Pending

Failed

Refunded

Partially Refunded

COD Pending

Admin must never see:

Full credit card number

CVV

Raw banking passwords

UPI PIN

Sensitive gateway secrets

---

## INVOICE MANAGEMENT

Use existing invoice system.

Admin can:

View invoice

Search invoice

Download PDF

Print invoice

Search using:

Invoice Number

Order Number

Customer

Date

---

## RETURNS MANAGEMENT

Show return requests.

Admin can:

Open request

View reason

View uploaded evidence

Approve return

Reject return

Request additional information

Schedule return pickup

Mark item received

Inspect returned item

Return item to inventory

Mark item damaged

Start refund

---

## REFUND MANAGEMENT

Create refund workflow.

Support:

Full refund

Partial refund

Refund status

Refund gateway ID

Refund reason

Refund amount

Refund date

Changed by admin

Record everything in MySQL.

---

## COUPON MANAGEMENT

Admin can:

Create coupon

Edit coupon

Disable coupon

Delete expired coupon

Set:

Coupon Code

Discount Type

Discount Amount

Percentage

Maximum Discount

Minimum Purchase

Start Date

End Date

Usage Limit

Per Customer Limit

Category Restriction

Brand Restriction

Product Restriction

Customer Restriction

---

## BANNER MANAGEMENT

Admin must be able to control customer website banners without editing code.

Create:

Desktop Banner

Mobile Banner

Title

Subtitle

Image

CTA Text

CTA Link

Start Date

End Date

Display Priority

Status

Admin can:

Publish

Unpublish

Schedule

Edit

Delete

---

## HOMEPAGE MANAGEMENT

Allow admin to control:

Hero Banners

Deals of the Day

Featured Products

Best Sellers

New Arrivals

Trending Products

Top Categories

Top Brands

Combo Offers

Shop by Budget

Recommended Products

Homepage section ordering

Admin changes should affect the existing public homepage.

---

## REVIEW MANAGEMENT

Admin can:

View reviews

Approve review

Hide review

Reject review

Flag suspicious review

Respond to review

Filter by rating

Search reviews

View verified purchase status

Never let admin modify a customer's review text in a way that misrepresents the customer.

---

## QUESTIONS AND ANSWERS

Admin can:

View product questions

Answer questions

Moderate customer answers

Hide spam

---

## CUSTOMER SUPPORT

Create support dashboard.

Support staff can:

View tickets

Search tickets

Open ticket

Reply

Change status

Assign ticket

Add internal note

Add attachment

Close ticket

Statuses:

Open

Pending

Waiting for Customer

Resolved

Closed

---

## NOTIFICATIONS

Admin should receive notifications for:

New Order

Payment Failure

Return Request

Refund Request

Low Stock

Out of Stock

New Review

Support Ticket

Suspicious Login

Failed Admin Login Attempts

---

## ADMIN USERS

SUPER\_ADMIN can create admin accounts.

Fields:

Name

Email

Phone

Role

Permissions

Status

Temporary Password

SUPER\_ADMIN can:

Create

Edit

Disable

Enable

Reset Password

Change Role

View Last Login

Terminate Sessions

---

## ROLE AND PERMISSION SYSTEM

Permissions should be granular.

Examples:

products.view

products.create

products.edit

products.delete

inventory.view

inventory.adjust

orders.view

orders.update

orders.cancel

payments.view

refunds.create

customers.view

customers.disable

coupons.manage

reviews.moderate

support.manage

analytics.view

admins.manage

settings.manage

---

## SERVER-SIDE PERMISSION CHECKING

Do NOT only hide buttons based on role.

Every backend action must check permissions.

Example:

If PRODUCT\_MANAGER tries to access:

POST /api/admin/refunds

but does not have:

refunds.create

Backend must return:

403 Forbidden

Even if they manually call the API.

---

## AUDIT LOG

Create a detailed audit log.

Record important admin actions.

Store:

Admin ID

Admin Name

Action

Entity Type

Entity ID

Old Value

New Value

IP Address

User Agent

Timestamp

Example:

Admin:
Rahul

Action:
Updated Product Price

Product:
Philips Air Fryer

Old:
₹8,999

New:
₹7,499

Timestamp:
12 Sep 2026 2:45 PM

---

## ADMIN LOGIN SECURITY LOGS

Record:

Successful login

Failed login

Logout

Password reset

Password change

2FA change

Session termination

Suspicious activity

IP address

User agent

Timestamp

---

## BRUTE FORCE PROTECTION

Protect admin login using:

Rate limiting

Temporary account lock

IP monitoring

CAPTCHA after repeated failures if needed

2FA for privileged roles

---

## ADMIN SETTINGS

Create settings sections:

GENERAL

Store Name

Logo

Favicon

Contact Email

Phone

Address

Currency

Timezone

TAX

GST Settings

Tax Rates

Invoice Settings

SHIPPING

Delivery Charges

Free Shipping Threshold

Delivery Areas

Courier Settings

PAYMENTS

Razorpay

Stripe if used

COD

Do not expose secret keys after saving.

EMAIL

SMTP or configured email provider

NOTIFICATIONS

Order Alerts

Low Stock Alerts

Returns

Security Alerts

SEO

Default SEO

Social Links

SECURITY

Session Timeout

Password Requirements

2FA Policy

---

## REPORTING

Create reports for:

Sales

Orders

Products

Inventory

Customers

Payments

Refunds

Returns

Taxes

Coupons

Brands

Categories

Profit estimates

Support export to:

CSV

Excel

PDF where appropriate

---

## SEARCH

Admin global search should search:

Order Number

Invoice Number

SKU

Product Name

Customer Name

Customer Email

Customer Phone

Transaction ID

Tracking Number

---

## ADMIN UI DESIGN

Create a premium professional admin interface.

Use:

Desktop-first layout

Responsive tablet support

Collapsible sidebar

Top navigation

Breadcrumbs

Search

Notification icon

Admin profile menu

Data tables

Pagination

Filters

Bulk actions

Charts

Status badges

Confirmation dialogs

Toast notifications

Loading skeletons

Empty states

Error states

Avoid flashy consumer-style animations.

Admin interface should prioritize:

Speed

Clarity

Data density

Efficiency

Security

---

## CONFIRMATION FOR DANGEROUS ACTIONS

Require confirmation for:

Delete Product

Cancel Order

Issue Refund

Delete Category

Disable Admin

Change Critical Settings

Show confirmation message such as:

“Are you sure you want to issue a ₹7,499 refund for Order #KK10243?”

---

## DATABASE SAFETY

Do not directly concatenate SQL queries.

Use parameterized queries or Prisma ORM.

MYSQL ONLY.

Recommended ORM:

Prisma configured with:

provider = "mysql"

---

## TRANSACTION SAFETY

Use MySQL transactions for critical admin operations.

Examples:

Refund processing

Stock adjustment

Order cancellation

Return completion

Inventory restoration

Payment reconciliation

If part of a critical operation fails:

ROLLBACK

---

## DO NOT MODIFY EXISTING DATABASE STRUCTURE BLINDLY

Before creating new migrations:

1. Inspect the existing MySQL schema.
2. Reuse existing tables and relationships.
3. Detect existing product/order/customer/payment tables.
4. Map admin functionality to existing tables.
5. Add only missing admin-specific fields/tables.
6. Avoid breaking existing customer-side functionality.
7. Create migrations safely.
8. Preserve all existing customer and order data.

Do NOT drop existing production tables.

Do NOT reset the existing database.

Do NOT delete existing records.

---

## EXISTING CUSTOMER WEBSITE INTEGRATION

Admin changes must update the existing website.

Examples:

ADMIN:

Product price changed

↓

MYSQL

↓

CUSTOMER WEBSITE:

Updated price visible

ADMIN:

Banner published

↓

MYSQL

↓

CUSTOMER HOMEPAGE:

Banner appears

CUSTOMER:

Places order

↓

MYSQL

↓

ADMIN:

New order notification

ADMIN:

Marks shipped

↓

MYSQL

↓

CUSTOMER:

Tracking page changes to Shipped

---

## REAL-TIME OR NEAR-REAL-TIME UPDATES

Where appropriate, implement:

Polling

Server events

WebSockets

or cache invalidation

so that admin and customer data do not remain stale.

---

## ADMIN API STRUCTURE

Create dedicated protected admin endpoints.

Examples:

/api/admin/dashboard

/api/admin/products

/api/admin/products/[id]

/api/admin/categories

/api/admin/brands

/api/admin/inventory

/api/admin/orders

/api/admin/orders/[id]

/api/admin/customers

/api/admin/payments

/api/admin/invoices

/api/admin/returns

/api/admin/refunds

/api/admin/coupons

/api/admin/reviews

/api/admin/support

/api/admin/banners

/api/admin/analytics

/api/admin/admin-users

/api/admin/roles

/api/admin/permissions

/api/admin/audit-logs

/api/admin/settings

Every admin endpoint must perform authentication and authorization.

---

## ADMIN PAGES

Create:

/admin/login

/admin

/admin/products

/admin/products/add

/admin/products/[id]

/admin/categories

/admin/brands

/admin/inventory

/admin/orders

/admin/orders/[id]

/admin/customers

/admin/customers/[id]

/admin/payments

/admin/invoices

/admin/returns

/admin/refunds

/admin/coupons

/admin/offers

/admin/reviews

/admin/questions

/admin/support

/admin/banners

/admin/homepage

/admin/blog

/admin/notifications

/admin/reports

/admin/analytics

/admin/admin-users

/admin/roles

/admin/permissions

/admin/audit-logs

/admin/security

/admin/settings

---

## ADMIN LOGOUT

Logout must:

Destroy admin session

Invalidate server token/session

Clear secure authentication cookie

Redirect to:

/admin/login

---

## TEST ADMIN ACCESS

Create a secure development seed admin only for local/testing environments.

Example:

Role:

SUPER\_ADMIN

Do NOT use fixed public default credentials in production.

Production owner account should be created securely during setup.

---

## FINAL SECURITY TEST

Before considering the admin system complete, test:

Normal customer logs in.

Customer visits:

/admin

EXPECTED:

ACCESS DENIED.

Customer manually calls:

/api/admin/products

EXPECTED:

403 FORBIDDEN.

Customer changes frontend code to show admin button.

EXPECTED:

ADMIN API STILL DENIES ACCESS.

Unauthenticated visitor opens:

/admin/orders

EXPECTED:

Redirect to admin login.

PRODUCT\_MANAGER attempts to create refund.

EXPECTED:

403 unless refunds.create permission exists.

SUPER\_ADMIN performs same action.

EXPECTED:

Allowed.

---

## FUNCTIONAL TEST

Test complete workflow:

1. Admin logs in.
2. Dashboard loads real MySQL data.
3. Admin creates product.
4. Product appears on customer website.
5. Admin changes price.
6. Customer sees updated price.
7. Admin changes stock.
8. Customer sees updated stock.
9. Customer places order.
10. Admin sees order.
11. Admin confirms order.
12. Customer sees confirmation.
13. Admin marks packed.
14. Customer sees Packed.
15. Admin enters tracking ID.
16. Customer sees tracking ID.
17. Admin marks Shipped.
18. Customer sees Shipped.
19. Admin marks Delivered.
20. Customer sees Delivered.
21. Customer requests return.
22. Admin sees return.
23. Admin approves return.
24. Admin processes refund.
25. Refund is stored correctly.
26. Customer sees refund status.
27. Admin downloads invoice.
28. Admin creates coupon.
29. Coupon works on customer checkout.
30. Admin changes homepage banner.
31. Customer sees new banner.
32. Super Admin creates staff account.
33. Staff login respects assigned permissions.
34. Audit log records administrative actions.

---

## FINAL DEVELOPMENT REQUIREMENT

This admin panel must function as the private operating system for the existing e-commerce business.

DO NOT:

- Rebuild the customer website.
- Create a second product database.
- Create duplicate customer records.
- Create duplicate order records.
- Use PostgreSQL.
- Use Firebase.
- Use MongoDB.
- Reset the existing MySQL database.
- Expose admin URLs in normal customer navigation.
- Depend on hidden URLs for security.
- Create fake buttons.
- Create frontend-only admin controls.
- Hardcode dashboard data.
- Store passwords in plain text.
- Allow customers to access admin APIs.

USE:

THE SAME EXISTING MYSQL DATABASE.

THE SAME EXISTING PRODUCTS.

THE SAME EXISTING CUSTOMERS.

THE SAME EXISTING ORDERS.

THE SAME EXISTING PAYMENTS.

THE SAME EXISTING INVENTORY.

The customer-facing website and private admin dashboard must operate as two separate interfaces connected securely to the same backend and MySQL database.

CUSTOMER SIDE = SHOPPING EXPERIENCE.

ADMIN SIDE = BUSINESS MANAGEMENT SYSTEM.

NORMAL USERS MUST NEVER RECEIVE ADMIN ACCESS.

AUTHORIZED STAFF MUST ONLY ACCESS THE MODULES PERMITTED BY THEIR ROLE.

SUPER\_ADMIN MUST HAVE COMPLETE CONTROL OVER THE WEBSITE FROM THE ADMIN DASHBOARD WITHOUT NEEDING TO EDIT SOURCE CODE OR MODIFY THE DATABASE MANUALLY.
