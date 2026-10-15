from django.db import migrations

CREATE = """
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_auditlog is append-only: rows cannot be deleted';
    END IF;
    -- The one permitted change: user_id / record_id being cleared when that user or record is erased.
    IF (NEW.id, NEW.action, NEW.user_email, NEW.user_name, NEW.record_reference, NEW.ip_address,
        NEW.user_agent, NEW.extra, NEW."timestamp", NEW.seq, NEW.prev_hash, NEW.hash)
       IS NOT DISTINCT FROM
       (OLD.id, OLD.action, OLD.user_email, OLD.user_name, OLD.record_reference, OLD.ip_address,
        OLD.user_agent, OLD.extra, OLD."timestamp", OLD.seq, OLD.prev_hash, OLD.hash)
       AND (NEW.user_id IS NULL OR NEW.user_id IS NOT DISTINCT FROM OLD.user_id)
       AND (NEW.record_id IS NULL OR NEW.record_id IS NOT DISTINCT FROM OLD.record_id)
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'audit_auditlog is append-only: rows cannot be changed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_auditlog;
CREATE TRIGGER audit_log_append_only
    BEFORE UPDATE OR DELETE ON audit_auditlog
    FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
"""

DROP = """
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_auditlog;
DROP FUNCTION IF EXISTS audit_log_append_only();
"""


class Migration(migrations.Migration):

    dependencies = [('audit', '0004_hash_chain')]

    operations = [migrations.RunSQL(CREATE, DROP)]
