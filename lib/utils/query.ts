// Escapa caracteres que podem atrapalhar filtros simples de busca do PostgREST.
export function safeSearchTerm(value: string) {
  return value.replace(/[,%()]/g, "").trim();
}
