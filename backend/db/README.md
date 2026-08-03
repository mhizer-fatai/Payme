# PayMe Database Schema

This folder breaks the PayMe database into small SQL files by responsibility.

Run order:

1. `00_reset.sql`
2. `01_extensions_and_functions.sql`
3. `02_accounts_and_wallets.sql`
4. `03_profiles.sql`
5. `04_payments_and_links.sql`
6. `05_payment_pin_security.sql`
7. `06_email_login_codes.sql`
8. `07_indexes.sql`
9. `08_row_level_security.sql`

For Supabase SQL editor, use the combined script:

`backend/scripts/payme_database.sql`

The combined script contains the same SQL as these files, in the same order.
