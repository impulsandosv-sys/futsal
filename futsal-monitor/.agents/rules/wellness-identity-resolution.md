# Wellness Identity Resolution Rules

**Context**: When importing Wellness CSVs (e.g., from Google Forms), we must securely identify players to avoid corrupting the database.

## The Rules of Resolution
When mapping an incoming player identifier (ID, Alias, or Name):

1. **ID Interno**: Strict exact match (case-insensitive).
   - If `jugadora.id_jugadora.toUpperCase() === valorLimpiado.toUpperCase()`

2. **Alias Activo**: Strict exact match (case-insensitive).
   - Look up in `alias_jugadora` where `activo === true`.
   - If `alias.valor.trim().toLowerCase() === valorLimpiado.toLowerCase()`

3. **Nombre Normalizado**: Complete equality after normalization.
   - **No partial matches**: Do NOT use `includes`, `startsWith`, `endsWith`, or matching by individual words.
   - Normalize both the target string and the player's name (trim whitespace, remove accents/diacritics, convert to lowercase).
   - Compare them: `normalizar(valorOrigen) === normalizar(nombreJugadora)`.
   - **Ambiguity Check**: You MUST use `.filter()` to find ALL matching players.
     - If `matches.length === 0` -> "Jugadora no registrada"
     - If `matches.length === 1` -> Success
     - If `matches.length > 1` -> Throw an explicit Ambiguity error. Never use `.find()` for names, as it will silently map to the first match and corrupt data.

## Transactions
- Import operations must be strictly **atomic**.
- Pre-validate all rows first (identity, dates, ranges).
- Open a transaction that covers **all** affected tables (`wellness`, `historial_importaciones`, `alertas`, `lesiones`, etc.).
- Never perform partial writes.
