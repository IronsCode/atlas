/**
 * db.js
 * Postgres connection pool.
 * Single import for all DB access. Never import pg directly elsewhere.
 */

import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Postgres pool error:', err)
})

/**
 * query(sql, params)
 * Single query from the pool.
 */
export async function query(sql, params = []) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } finally {
    client.release()
  }
}

/**
 * transaction(fn)
 * Run multiple queries in a transaction.
 * fn receives the client. Rolls back on throw.
 *
 * Usage:
 *   const result = await transaction(async (client) => {
 *     await client.query('INSERT ...')
 *     await client.query('INSERT ...')
 *     return someValue
 *   })
 */
export async function transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * withReadOnly(fn)
 * Runs fn inside a READ ONLY transaction and passes it a bound query function.
 * Any accidental write throws ("cannot execute ... in a read-only transaction"),
 * so support/diagnostic CLIs cannot mutate tenant data even by mistake — a
 * code-level substitute for a dedicated read-only DB role (no ops setup).
 *
 * Usage: await withReadOnly((q) => gather(email, q))
 */
export async function withReadOnly(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    const result = await fn((sql, params) => client.query(sql, params))
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/**
 * healthCheck()
 * Returns true if DB is reachable.
 */
export async function healthCheck() {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export default pool
