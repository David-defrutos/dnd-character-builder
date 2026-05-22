/**
 * UX helper for ASI/feat slot locking (bug #72).
 *
 * Un slot ASI/feat queda bloqueado cuando el personaje YA ha subido al
 * siguiente nivel después de ese checkpoint. Mientras el personaje esté
 * exactamente en el nivel del checkpoint (o por debajo, si por error la
 * data está rota) el slot es editable.
 *
 * Razón: si el feat de nivel 4 sirvió como prerequisito de algo en niveles
 * 5+ (otro feat, una subclase, una habilidad), permitir cambiarlo dejaría
 * el árbol del personaje en estado inválido. Bloqueamos al subir de nivel
 * para forzar consistencia.
 */

export function isAsiSlotLocked(slotLevel: number, characterLevel: number): boolean {
  return characterLevel > slotLevel
}
