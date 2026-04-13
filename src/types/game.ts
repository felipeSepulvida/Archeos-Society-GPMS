// =============================================================================
// Tipos do Domínio - Archeos Society
// =============================================================================

/**
 * As 6 profissões base implementadas (cenário Chichén Itzá do livro).
 */
export type Role =
    | "BOTANIST"     // Botânico
    | "LINGUIST"     // Linguista
    | "CARTOGRAPHER" // Cartógrafo
    | "CURATOR"      // Curador
    | "PHOTOGRAPHER" // Fotógrafo
    | "STUDENT";     // Estudante

/**
 * As 6 cores de regiões / trilhas correspondentes aos sítios arqueológicos.
 */
export type Color =
    | "RED"     // North America - Chichén Itzá
    | "GREEN"   // South America - Machu Picchu (genérico)
    | "BLUE"    // Europe         - Tantallon Castle (genérico)
    | "YELLOW"  // Africa         - Great Zimbabwe (genérico)
    | "PINK"    // Asia           - Sigirîya (genérico)
    | "PURPLE"; // Oceania        - Rapa Nui (genérico)
