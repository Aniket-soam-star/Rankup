// Shared audit logging helper
export async function logAction(db, { userId, username, action, targetType, targetId, details, ip, userAgent }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId ?? null, username ?? null, action, targetType ?? null, targetId ?? null,
       JSON.stringify(details || {}), ip ?? null, userAgent ?? null]
    )
  } catch (err) {
    console.error('Audit log error:', err.message)
  }
}
