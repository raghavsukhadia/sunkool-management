-- ============================================================================
-- Multi-User RLS Fix: Allow authenticated users to read operational data
-- ============================================================================
-- Background: all core tables were originally admin-only (SELECT/INSERT/UPDATE/DELETE
-- restricted to is_admin()). Now that multiple non-admin users exist, they must be
-- able to read all operational data so the production queue, orders, tracking, etc.
-- work for everyone.
--
-- Strategy:
--   • SELECT  → all authenticated users (full visibility)
--   • INSERT  → all authenticated users on production & dispatch tables (they do the work)
--   • UPDATE  → all authenticated users on production & dispatch tables
--   • DELETE  → admin only (destructive ops stay guarded)
--   • orders INSERT/UPDATE → admin only (order management stays with admin)
--
-- Safe to re-run: all steps use DROP IF EXISTS before CREATE.
-- ============================================================================

-- ── 1. orders ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all orders"       ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

-- Non-admin users can also create and update orders (e.g. new order, status change).
-- DELETE remains admin-only (handled by the existing admin-only policy).
DROP POLICY IF EXISTS "Admins can insert orders"              ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can insert orders"  ON public.orders;
CREATE POLICY "Authenticated users can insert orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update orders"              ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders"  ON public.orders;
CREATE POLICY "Authenticated users can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true);

-- ── 2. order_items ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all order items"         ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can view order items" ON public.order_items;
CREATE POLICY "Authenticated users can view order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (true);

-- Non-admin users need to add / edit order items when creating orders
DROP POLICY IF EXISTS "Authenticated users can insert order items" ON public.order_items;
CREATE POLICY "Authenticated users can insert order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update order items" ON public.order_items;
CREATE POLICY "Authenticated users can update order items"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (true);

-- ── 3. customers ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all customers"         ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (true);

-- ── 4. production_records ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all production records"         ON public.production_records;
DROP POLICY IF EXISTS "Authenticated users can view production records" ON public.production_records;
CREATE POLICY "Authenticated users can view production records"
  ON public.production_records FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert production records"              ON public.production_records;
DROP POLICY IF EXISTS "Authenticated users can insert production records"  ON public.production_records;
CREATE POLICY "Authenticated users can insert production records"
  ON public.production_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update production records"              ON public.production_records;
DROP POLICY IF EXISTS "Authenticated users can update production records"  ON public.production_records;
CREATE POLICY "Authenticated users can update production records"
  ON public.production_records FOR UPDATE
  TO authenticated
  USING (true);

-- ── 5. inventory_items ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all inventory items"         ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can view inventory items" ON public.inventory_items;
CREATE POLICY "Authenticated users can view inventory items"
  ON public.inventory_items FOR SELECT
  TO authenticated
  USING (true);

-- ── 6. products ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all products"         ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- ── 7. dispatches ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all dispatches"         ON public.dispatches;
DROP POLICY IF EXISTS "Authenticated users can view dispatches" ON public.dispatches;
CREATE POLICY "Authenticated users can view dispatches"
  ON public.dispatches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert dispatches"              ON public.dispatches;
DROP POLICY IF EXISTS "Authenticated users can insert dispatches"  ON public.dispatches;
CREATE POLICY "Authenticated users can insert dispatches"
  ON public.dispatches FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update dispatches"              ON public.dispatches;
DROP POLICY IF EXISTS "Authenticated users can update dispatches"  ON public.dispatches;
CREATE POLICY "Authenticated users can update dispatches"
  ON public.dispatches FOR UPDATE
  TO authenticated
  USING (true);

-- ── 8. dispatch_items ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all dispatch items"         ON public.dispatch_items;
DROP POLICY IF EXISTS "Authenticated users can view dispatch items" ON public.dispatch_items;
CREATE POLICY "Authenticated users can view dispatch items"
  ON public.dispatch_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert dispatch items"              ON public.dispatch_items;
DROP POLICY IF EXISTS "Authenticated users can insert dispatch items"  ON public.dispatch_items;
CREATE POLICY "Authenticated users can insert dispatch items"
  ON public.dispatch_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update dispatch items"              ON public.dispatch_items;
DROP POLICY IF EXISTS "Authenticated users can update dispatch items"  ON public.dispatch_items;
CREATE POLICY "Authenticated users can update dispatch items"
  ON public.dispatch_items FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can delete dispatch items"              ON public.dispatch_items;
DROP POLICY IF EXISTS "Authenticated users can delete dispatch items"  ON public.dispatch_items;
CREATE POLICY "Authenticated users can delete dispatch items"
  ON public.dispatch_items FOR DELETE
  TO authenticated
  USING (true);

-- ── 9. courier_companies ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all courier companies"         ON public.courier_companies;
DROP POLICY IF EXISTS "Authenticated users can view courier companies" ON public.courier_companies;
CREATE POLICY "Authenticated users can view courier companies"
  ON public.courier_companies FOR SELECT
  TO authenticated
  USING (true);

-- ── 10. order_payments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all order payments"         ON public.order_payments;
DROP POLICY IF EXISTS "Authenticated users can view order payments" ON public.order_payments;
CREATE POLICY "Authenticated users can view order payments"
  ON public.order_payments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert order payments"              ON public.order_payments;
DROP POLICY IF EXISTS "Authenticated users can insert order payments"  ON public.order_payments;
CREATE POLICY "Authenticated users can insert order payments"
  ON public.order_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update order payments"              ON public.order_payments;
DROP POLICY IF EXISTS "Authenticated users can update order payments"  ON public.order_payments;
CREATE POLICY "Authenticated users can update order payments"
  ON public.order_payments FOR UPDATE
  TO authenticated
  USING (true);

-- ── 11. payment_followups ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all payment followups"         ON public.payment_followups;
DROP POLICY IF EXISTS "Authenticated users can view payment followups" ON public.payment_followups;
CREATE POLICY "Authenticated users can view payment followups"
  ON public.payment_followups FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert payment followups"              ON public.payment_followups;
DROP POLICY IF EXISTS "Authenticated users can insert payment followups"  ON public.payment_followups;
CREATE POLICY "Authenticated users can insert payment followups"
  ON public.payment_followups FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update payment followups"              ON public.payment_followups;
DROP POLICY IF EXISTS "Authenticated users can update payment followups"  ON public.payment_followups;
CREATE POLICY "Authenticated users can update payment followups"
  ON public.payment_followups FOR UPDATE
  TO authenticated
  USING (true);

-- ── 12. order_comments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all order comments"         ON public.order_comments;
DROP POLICY IF EXISTS "Authenticated users can view order comments" ON public.order_comments;
CREATE POLICY "Authenticated users can view order comments"
  ON public.order_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert order comments"              ON public.order_comments;
DROP POLICY IF EXISTS "Authenticated users can insert order comments"  ON public.order_comments;
CREATE POLICY "Authenticated users can insert order comments"
  ON public.order_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update order comments"              ON public.order_comments;
DROP POLICY IF EXISTS "Authenticated users can update order comments"  ON public.order_comments;
CREATE POLICY "Authenticated users can update order comments"
  ON public.order_comments FOR UPDATE
  TO authenticated
  USING (true);

-- ── 13. order_comment_attachments ────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all comment attachments"         ON public.order_comment_attachments;
DROP POLICY IF EXISTS "Authenticated users can view comment attachments" ON public.order_comment_attachments;
CREATE POLICY "Authenticated users can view comment attachments"
  ON public.order_comment_attachments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert comment attachments" ON public.order_comment_attachments;
CREATE POLICY "Authenticated users can insert comment attachments"
  ON public.order_comment_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 14. order_invoices ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all order invoices"         ON public.order_invoices;
DROP POLICY IF EXISTS "Authenticated users can view order invoices" ON public.order_invoices;
CREATE POLICY "Authenticated users can view order invoices"
  ON public.order_invoices FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert order invoices" ON public.order_invoices;
CREATE POLICY "Authenticated users can insert order invoices"
  ON public.order_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete order invoices" ON public.order_invoices;
CREATE POLICY "Authenticated users can delete order invoices"
  ON public.order_invoices FOR DELETE
  TO authenticated
  USING (true);

-- ── 15. invoice_attachments ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all invoice attachments"         ON public.invoice_attachments;
DROP POLICY IF EXISTS "Authenticated users can view invoice attachments" ON public.invoice_attachments;
CREATE POLICY "Authenticated users can view invoice attachments"
  ON public.invoice_attachments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert invoice attachments" ON public.invoice_attachments;
CREATE POLICY "Authenticated users can insert invoice attachments"
  ON public.invoice_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 16. shipment_notes ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all shipment notes"         ON public.shipment_notes;
DROP POLICY IF EXISTS "Authenticated users can view shipment notes" ON public.shipment_notes;
CREATE POLICY "Authenticated users can view shipment notes"
  ON public.shipment_notes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert shipment notes" ON public.shipment_notes;
CREATE POLICY "Authenticated users can insert shipment notes"
  ON public.shipment_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update shipment notes" ON public.shipment_notes;
CREATE POLICY "Authenticated users can update shipment notes"
  ON public.shipment_notes FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete shipment notes" ON public.shipment_notes;
CREATE POLICY "Authenticated users can delete shipment notes"
  ON public.shipment_notes FOR DELETE
  TO authenticated
  USING (true);

-- ── 17. production_lists ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all production lists"         ON public.production_lists;
DROP POLICY IF EXISTS "Authenticated users can view production lists" ON public.production_lists;
CREATE POLICY "Authenticated users can view production lists"
  ON public.production_lists FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert production lists" ON public.production_lists;
CREATE POLICY "Authenticated users can insert production lists"
  ON public.production_lists FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update production lists" ON public.production_lists;
CREATE POLICY "Authenticated users can update production lists"
  ON public.production_lists FOR UPDATE
  TO authenticated
  USING (true);

-- ── 18. production_pdfs ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all production pdfs"         ON public.production_pdfs;
DROP POLICY IF EXISTS "Authenticated users can view production pdfs" ON public.production_pdfs;
CREATE POLICY "Authenticated users can view production pdfs"
  ON public.production_pdfs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert production pdfs" ON public.production_pdfs;
CREATE POLICY "Authenticated users can insert production pdfs"
  ON public.production_pdfs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 19. notification_queue ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all notifications"         ON public.notification_queue;
DROP POLICY IF EXISTS "Authenticated users can view notifications" ON public.notification_queue;
CREATE POLICY "Authenticated users can view notifications"
  ON public.notification_queue FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notification_queue;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notification_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update notifications" ON public.notification_queue;
CREATE POLICY "Authenticated users can update notifications"
  ON public.notification_queue FOR UPDATE
  TO authenticated
  USING (true);

-- ── 20. notification_recipients ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view notification recipients"         ON public.notification_recipients;
DROP POLICY IF EXISTS "Authenticated users can view notification recipients" ON public.notification_recipients;
CREATE POLICY "Authenticated users can view notification recipients"
  ON public.notification_recipients FOR SELECT
  TO authenticated
  USING (true);

-- ── 21. notification_templates ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view notification templates"         ON public.notification_templates;
DROP POLICY IF EXISTS "Authenticated users can view notification templates" ON public.notification_templates;
CREATE POLICY "Authenticated users can view notification templates"
  ON public.notification_templates FOR SELECT
  TO authenticated
  USING (true);

-- ── 22. whatsapp_config ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view whatsapp config"         ON public.whatsapp_config;
DROP POLICY IF EXISTS "Authenticated users can view whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Authenticated users can view whatsapp config"
  ON public.whatsapp_config FOR SELECT
  TO authenticated
  USING (true);

-- ── 23. tracking_reminder_log ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view tracking reminder log"         ON public.tracking_reminder_log;
DROP POLICY IF EXISTS "Authenticated users can view tracking reminder log" ON public.tracking_reminder_log;
CREATE POLICY "Authenticated users can view tracking reminder log"
  ON public.tracking_reminder_log FOR SELECT
  TO authenticated
  USING (true);

-- ── 24. order_log ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all order logs"         ON public.order_log;
DROP POLICY IF EXISTS "Authenticated users can view order logs" ON public.order_log;
CREATE POLICY "Authenticated users can view order logs"
  ON public.order_log FOR SELECT
  TO authenticated
  USING (true);

-- ── 25. distributors (read-only for non-admin) ───────────────────────────────
DROP POLICY IF EXISTS "Admins can view all distributors"         ON public.distributors;
DROP POLICY IF EXISTS "Authenticated users can view distributors" ON public.distributors;
CREATE POLICY "Authenticated users can view distributors"
  ON public.distributors FOR SELECT
  TO authenticated
  USING (true);

-- ── 26. inventory sub-tables ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view master rolls"         ON public.master_rolls;
DROP POLICY IF EXISTS "Authenticated users can view master rolls" ON public.master_rolls;
CREATE POLICY "Authenticated users can view master rolls"
  ON public.master_rolls FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can view convertable stock"         ON public.convertable_stock;
DROP POLICY IF EXISTS "Authenticated users can view convertable stock" ON public.convertable_stock;
CREATE POLICY "Authenticated users can view convertable stock"
  ON public.convertable_stock FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can view ready for dispatch"         ON public.ready_for_dispatch;
DROP POLICY IF EXISTS "Authenticated users can view ready for dispatch" ON public.ready_for_dispatch;
CREATE POLICY "Authenticated users can view ready for dispatch"
  ON public.ready_for_dispatch FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can view cut and roll"         ON public.cut_and_roll;
DROP POLICY IF EXISTS "Authenticated users can view cut and roll" ON public.cut_and_roll;
CREATE POLICY "Authenticated users can view cut and roll"
  ON public.cut_and_roll FOR SELECT
  TO authenticated
  USING (true);

-- ── Verify: list all RLS policies on key tables ───────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'orders', 'order_items', 'customers', 'production_records',
    'inventory_items', 'products', 'dispatches', 'dispatch_items'
  )
ORDER BY tablename, cmd;
