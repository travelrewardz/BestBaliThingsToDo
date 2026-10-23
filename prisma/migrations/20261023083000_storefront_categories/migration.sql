-- Align the catalog with the storefront "Explore by category" tiles: make the
-- ten categories shown on the homepage available to the admin Destinations
-- page and the supplier tour form (both list Category rows).
-- Idempotent: existing rows (matched by the unique slug) are updated, never
-- duplicated, so product links keep their category ids.

-- Push every other category below the storefront set.
UPDATE "Category"
SET "sortOrder" = "sortOrder" + 100
WHERE "slug" NOT IN (
  'adventure', 'atv', 'rafting', 'water-sports', 'ubud', 'nusa-penida',
  'cultural', 'temple', 'sunrise', 'private'
);

INSERT INTO "Category" ("id", "name", "slug", "kind", "description", "icon", "sortOrder", "active")
VALUES
  ('cat_storefront_adventure',    'Adventure',      'adventure',    'CATEGORY', 'Adrenaline-pumping experiences across Bali',        '🪂', 0, true),
  ('cat_storefront_atv',          'ATV',            'atv',          'CATEGORY', 'Quad biking through jungle, river and rice fields',  '🏍️', 1, true),
  ('cat_storefront_rafting',      'Rafting',        'rafting',      'CATEGORY', 'White-water rafting on Bali''s wildest rivers',      '🛶', 2, true),
  ('cat_storefront_watersports',  'Water Sports',   'water-sports', 'CATEGORY', 'Snorkeling, diving and ocean adventures',           '🌊', 3, true),
  ('cat_storefront_ubud',         'Ubud Tours',     'ubud',         'CATEGORY', 'Tours and experiences around Ubud',                 '🎑', 4, true),
  ('cat_storefront_nusapenida',   'Nusa Penida',    'nusa-penida',  'CATEGORY', 'Island day trips and snorkel safaris',              '🏝️', 5, true),
  ('cat_storefront_cultural',     'Cultural Tours', 'cultural',     'CATEGORY', 'Temples, dances and Balinese traditions',           '🛕', 6, true),
  ('cat_storefront_temple',       'Temple Tours',   'temple',       'CATEGORY', 'Sacred sites and spiritual journeys',               '⛩️', 7, true),
  ('cat_storefront_sunrise',      'Sunrise Tours',  'sunrise',      'CATEGORY', 'Early climbs and golden-hour magic',                '🌄', 8, true),
  ('cat_storefront_private',      'Private Tours',  'private',      'CATEGORY', 'Your group, your schedule, your guide',             '🚗', 9, true)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "kind" = EXCLUDED."kind",
  "icon" = EXCLUDED."icon",
  "sortOrder" = EXCLUDED."sortOrder",
  "active" = true;
