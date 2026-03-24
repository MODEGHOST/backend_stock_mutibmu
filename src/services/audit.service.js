import { pool } from "../config/db.js";

/**
 * Inserts a new audit log record.
 * @param {object} params
 * @param {number|null} params.companyId - The company ID (null for system-wide).
 * @param {number} params.userId - The user who performed the action.
 * @param {string} params.action - The action performed (CREATE, UPDATE, DELETE, LOGIN).
 * @param {string} params.entityType - The type of entity (PRODUCT, VENDOR, INVOICE, USER).
 * @param {string|number} params.entityId - The ID of the modified entity.
 * @param {object|null} params.oldValues - JSON snapshot of the old state.
 * @param {object|null} params.newValues - JSON snapshot of the new state.
 * @param {string|null} params.ipAddress - The IP address of the request.
 * @param {object|null} [conn] - Optional active transaction connection.
 */
export async function logAudit(
  {
    companyId = null,
    userId,
    action,
    entityType,
    entityId,
    oldValues = null,
    newValues = null,
    ipAddress = null,
  },
  conn = null
) {
  const query = `
    INSERT INTO audit_logs (
      company_id, user_id, action, entity_type, entity_id,
      old_values, new_values, ip_address
    ) VALUES (
      :companyId, :userId, :action, :entityType, :entityId,
      :oldValues, :newValues, :ipAddress
    )
  `;

  const values = {
    companyId,
    userId,
    action,
    entityType,
    entityId: String(entityId),
    oldValues: oldValues ? JSON.stringify(oldValues) : null,
    newValues: newValues ? JSON.stringify(newValues) : null,
    ipAddress,
  };

  const dbConnection = conn || pool;
  await dbConnection.query(query, values);
}
