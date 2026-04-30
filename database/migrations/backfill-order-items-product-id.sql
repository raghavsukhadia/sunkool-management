-- Backfill order_items.product_id from inventory-linked rows
-- Strategy:
-- 1) Normalize names and map inventory_items.item_name -> products.name
-- 2) Only update rows where the normalized name maps to exactly one product
-- 3) Clear inventory_item_id for successfully backfilled rows to satisfy XOR constraint

WITH normalized_products AS (
  SELECT
    p.id AS product_id,
    lower(regexp_replace(trim(p.name), '\s+', ' ', 'g')) AS normalized_name
  FROM products p
),
normalized_inventory AS (
  SELECT
    i.id AS inventory_item_id,
    lower(regexp_replace(trim(i.item_name), '\s+', ' ', 'g')) AS normalized_name
  FROM inventory_items i
),
unique_name_map AS (
  SELECT
    np.normalized_name,
    (array_agg(np.product_id ORDER BY np.product_id::text))[1] AS product_id,
    count(*) AS match_count
  FROM normalized_products np
  GROUP BY np.normalized_name
  HAVING count(*) = 1
),
candidate_rows AS (
  SELECT
    oi.id AS order_item_id,
    unm.product_id
  FROM order_items oi
  JOIN normalized_inventory ni ON ni.inventory_item_id = oi.inventory_item_id
  JOIN unique_name_map unm ON unm.normalized_name = ni.normalized_name
  WHERE oi.product_id IS NULL
    AND oi.inventory_item_id IS NOT NULL
)
UPDATE order_items oi
SET
  product_id = c.product_id,
  inventory_item_id = NULL
FROM candidate_rows c
WHERE oi.id = c.order_item_id;

-- Verification Queries (run manually after migration)
-- 1) Remaining rows that are still inventory-backed:
-- SELECT count(*) AS remaining_inventory_backed
-- FROM order_items
-- WHERE product_id IS NULL AND inventory_item_id IS NOT NULL;
--
-- 2) Rows now product-backed:
-- SELECT count(*) AS product_backed_rows
-- FROM order_items
-- WHERE product_id IS NOT NULL;
--
-- 3) Unmatched rows for manual review:
-- WITH normalized_products AS (
--   SELECT lower(regexp_replace(trim(name), '\s+', ' ', 'g')) AS normalized_name
--   FROM products
-- ),
-- normalized_inventory AS (
--   SELECT id, item_name, lower(regexp_replace(trim(item_name), '\s+', ' ', 'g')) AS normalized_name
--   FROM inventory_items
-- )
-- SELECT oi.id, oi.order_id, ni.item_name
-- FROM order_items oi
-- JOIN normalized_inventory ni ON ni.id = oi.inventory_item_id
-- LEFT JOIN normalized_products np ON np.normalized_name = ni.normalized_name
-- WHERE oi.product_id IS NULL
--   AND oi.inventory_item_id IS NOT NULL
--   AND np.normalized_name IS NULL
-- ORDER BY oi.created_at DESC;
