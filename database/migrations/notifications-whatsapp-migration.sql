-- ============================================
-- Migration: Notifications / WhatsApp configuration
-- ============================================
-- Tables for WhatsApp notifications: recipients, config, templates, queue.
-- Assumes update_updated_at_column() and is_admin() exist.

-- notification_recipients: who receives notifications (e.g. production team)
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_is_active ON notification_recipients(is_active);

DROP TRIGGER IF EXISTS update_notification_recipients_updated_at ON notification_recipients;
CREATE TRIGGER update_notification_recipients_updated_at
  BEFORE UPDATE ON notification_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view notification recipients" ON notification_recipients;
CREATE POLICY "Admins can view notification recipients"
  ON notification_recipients FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert notification recipients" ON notification_recipients;
CREATE POLICY "Admins can insert notification recipients"
  ON notification_recipients FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can update notification recipients" ON notification_recipients;
CREATE POLICY "Admins can update notification recipients"
  ON notification_recipients FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "Admins can delete notification recipients" ON notification_recipients;
CREATE POLICY "Admins can delete notification recipients"
  ON notification_recipients FOR DELETE USING (is_admin());

-- whatsapp_config: single-row configuration for WhatsApp provider
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT,
  user_id TEXT,
  password TEXT,
  api_key TEXT,
  api_endpoint_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_whatsapp_config_updated_at ON whatsapp_config;
CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view whatsapp config" ON whatsapp_config;
CREATE POLICY "Admins can view whatsapp config"
  ON whatsapp_config FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert whatsapp config" ON whatsapp_config;
CREATE POLICY "Admins can insert whatsapp config"
  ON whatsapp_config FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can update whatsapp config" ON whatsapp_config;
CREATE POLICY "Admins can update whatsapp config"
  ON whatsapp_config FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "Admins can delete whatsapp config" ON whatsapp_config;
CREATE POLICY "Admins can delete whatsapp config"
  ON whatsapp_config FOR DELETE USING (is_admin());

-- notification_templates: message templates per event type (placeholders: {{order_number}}, etc.)
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL UNIQUE,
  name TEXT,
  template_body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON notification_templates(event_type);

DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view notification templates" ON notification_templates;
CREATE POLICY "Admins can view notification templates"
  ON notification_templates FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert notification templates" ON notification_templates;
CREATE POLICY "Admins can insert notification templates"
  ON notification_templates FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can update notification templates" ON notification_templates;
CREATE POLICY "Admins can update notification templates"
  ON notification_templates FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "Admins can delete notification templates" ON notification_templates;
CREATE POLICY "Admins can delete notification templates"
  ON notification_templates FOR DELETE USING (is_admin());

-- notification_queue: pending events for messenger auto sender (sent_at NULL = pending)
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_sent_at ON notification_queue(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON notification_queue(created_at);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view notification queue" ON notification_queue;
CREATE POLICY "Admins can view notification queue"
  ON notification_queue FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert notification queue" ON notification_queue;
CREATE POLICY "Admins can insert notification queue"
  ON notification_queue FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can update notification queue" ON notification_queue;
CREATE POLICY "Admins can update notification queue"
  ON notification_queue FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "Admins can delete notification queue" ON notification_queue;
CREATE POLICY "Admins can delete notification queue"
  ON notification_queue FOR DELETE USING (is_admin());
