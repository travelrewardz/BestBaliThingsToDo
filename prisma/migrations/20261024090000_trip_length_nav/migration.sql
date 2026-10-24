-- Surface the duration-based trip-length classification in the site navigation.
-- Classification itself is derived from durationHours (<24h = 1 Day, >=24h =
-- Multiday) so these links always match what the pages show.
-- Idempotent: guarded on (location, url) so re-running never duplicates rows.

INSERT INTO "Menu" ("id", "location", "title", "url", "sortOrder", "active")
SELECT 'menutrip_header_day', 'HEADER', '1 Day Trips', '/day-trips', 6, true
WHERE NOT EXISTS (
  SELECT 1 FROM "Menu" WHERE "location" = 'HEADER' AND "url" = '/day-trips'
);

INSERT INTO "Menu" ("id", "location", "title", "url", "sortOrder", "active")
SELECT 'menutrip_header_multi', 'HEADER', 'Multi-day Trips', '/multi-day-trips', 7, true
WHERE NOT EXISTS (
  SELECT 1 FROM "Menu" WHERE "location" = 'HEADER' AND "url" = '/multi-day-trips'
);

INSERT INTO "Menu" ("id", "location", "title", "url", "sortOrder", "active")
SELECT 'menutrip_footer_day', 'FOOTER', '1 Day Trips', '/day-trips', 8, true
WHERE NOT EXISTS (
  SELECT 1 FROM "Menu" WHERE "location" = 'FOOTER' AND "url" = '/day-trips'
);

INSERT INTO "Menu" ("id", "location", "title", "url", "sortOrder", "active")
SELECT 'menutrip_footer_multi', 'FOOTER', 'Multi-day Trips', '/multi-day-trips', 9, true
WHERE NOT EXISTS (
  SELECT 1 FROM "Menu" WHERE "location" = 'FOOTER' AND "url" = '/multi-day-trips'
);
