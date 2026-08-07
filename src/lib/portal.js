export function generatePortalUserCode() {
  const words = [
    "oak",
    "elm",
    "pine",
    "sage",
    "fern",
    "rose",
    "iris",
    "clay",
    "reed",
    "moss",
    "dune",
    "bay",
    "rain",
    "mesa",
    "peak",
    "vale",
    "glen",
    "ridge",
    "cove",
    "wave",
  ];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}`;
}
