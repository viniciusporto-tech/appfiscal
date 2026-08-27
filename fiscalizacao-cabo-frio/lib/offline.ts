// Nome do banco local criado pelo navegador do agente.
const DATABASE_NAME = "fiscalizacao-cabo-frio";

// Nome da coleção onde ficam fiscalizações aguardando sincronização.
const STORE_NAME = "pending-inspections";

// Versão do banco local. Aumente quando mudar a estrutura do IndexedDB.
const DATABASE_VERSION = 1;

// Estrutura mínima de uma fiscalização salva localmente.
export type PendingInspection = {
  localId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

// Abre (ou cria) o IndexedDB do navegador.
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Inicia a abertura do banco local.
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    // Este evento roda na primeira criação ou quando a versão do banco muda.
    request.onupgradeneeded = () => {
      const db = request.result;

      // Cria a coleção apenas se ela ainda não existir.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "localId" });
      }
    };

    // Entrega o banco pronto quando a abertura termina corretamente.
    request.onsuccess = () => resolve(request.result);

    // Repassa o erro quando o navegador não consegue abrir o banco.
    request.onerror = () => reject(request.error);
  });
}

// Salva uma fiscalização localmente para sincronizar depois.
export async function savePendingInspection(item: PendingInspection): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(item);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}
