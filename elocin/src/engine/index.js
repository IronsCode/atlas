/**
 * engine/index.js
 *
 * Single orchestration entry point. Routes events to the appropriate
 * core rule/workflow and returns their result — holds no business logic
 * of its own.
 *
 * Real decision logic (skill/method detection, negation handling,
 * confidence scoring) lives in core/rules/parseObservation.js — see that
 * file for the STUB warning and the locked output shape.
 */

export { parseObservation } from '../core/rules/parseObservation.js'
