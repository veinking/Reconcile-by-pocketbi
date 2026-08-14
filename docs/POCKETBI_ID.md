# PocketBI ID integration contract

PocketBI products should feel like one ecosystem without collapsing all product data into one database.

## User promise

**One PocketBI account. Separate product data.**

A user who creates a PocketBI ID should be able to use the same identity across PocketBI, PocketClean, Reconcile, Talent, bIDE, and future products. A shared account does not give one product automatic access to another product's private content.

## Architecture rule

Centralize only what genuinely needs to be shared:

- global user ID and profile basics
- product catalog
- entitlements
- subscriptions
- credit balance / credit ledger
- usage events needed for billing and limits
- organizations and organization membership

Keep product-domain data in the product that owns it. Reconcile uploads, matching templates, and reports should remain Reconcile data unless the user explicitly sends a result to another PocketBI product.

## Minimum central model

```text
profiles
  user_id (global auth subject)
  email
  display_name

products
  code
  name

entitlements
  user_id / organization_id
  product_code
  feature_code
  status
  limit_value
  valid_until

subscriptions
  owner_id
  provider
  provider_customer_id
  provider_subscription_id
  status

credit_ledger
  owner_id
  amount
  reason
  product_code
  created_at

usage_events
  owner_id
  product_code
  feature_code
  quantity
  idempotency_key

organizations
organization_members
```

## Authorization rule

Products should check **entitlements/features**, not strings such as `if plan === "pro"`. That lets PocketBI sell individual tools, an all-access bundle, team plans, promotional access, or credits without rewriting every product.

Examples:

```text
reconcile.basic            true
reconcile.max_rows         50000
reconcile.saved_templates  true
reconcile.batch            false
credits.monthly            500
```

## Guest-first rule

A product may provide a useful guest experience before login. When a guest signs in, the product can attach eligible non-sensitive state to the global PocketBI user only after clear user action.

## Privacy boundary

PocketBI ID should expose the minimum identity/entitlement information each product needs. Cross-product data transfer must be explicit, e.g. a user choosing **Send cleaned file to Reconcile** or **Open discrepancy report in PocketBI**.

## Reconcile rollout

1. Prove the no-account reconciliation flow.
2. Add PocketBI ID sign-in.
3. Gate large files, saved mappings, batch jobs, and automation through central entitlements.
4. Add shared PocketBI credits only to features with meaningful compute/storage cost.
5. Add organization/team ownership after the individual workflow is stable.
