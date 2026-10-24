-- Explicit trip-length classification, editable by suppliers in the tour
-- form's "Destinations & categories" section, driving the storefront's
-- /day-trips and /multi-day-trips pages.
ALTER TABLE "Product" ADD COLUMN "tripLength" TEXT NOT NULL DEFAULT 'DAY';

-- Backfill existing tours from their duration (24h or more spans a night).
UPDATE "Product" SET "tripLength" = 'MULTIDAY' WHERE "durationHours" >= 24;

-- Trip-length browsing lives on the homepage body, not the navigation:
-- drop the header menu rows added by 20261024090000 (footer rows stay).
DELETE FROM "Menu" WHERE "location" = 'HEADER' AND "url" IN ('/day-trips', '/multi-day-trips');
