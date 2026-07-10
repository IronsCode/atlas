/**
 * testServer.js
 * Starts the real Express app (imported from api/server.js, which guards
 * its own app.listen() behind an entry-module check) on an ephemeral
 * port for HTTP-level route tests. Not a *.test.js file itself — the
 * `npm test` glob (src/tests/*.test.js) won't pick this up.
 */

import { app } from '../../api/server.js'

export function startTestServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      resolve({
        baseUrl: `http://localhost:${port}`,
        close: () => new Promise((res) => server.close(res))
      })
    })
  })
}
