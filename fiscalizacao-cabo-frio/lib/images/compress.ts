"use client";

// Reduz fotos antes do upload para economizar Storage/egress sem perder legibilidade da placa.
export async function compressInspectionPhoto(
  file: File,
  maxDimension = 1600,
  quality = 0.78,
): Promise<File> {
  // Arquivos pequenos já estão dentro de um tamanho razoável.
  if (file.size <= 650 * 1024 && file.type === "image/jpeg") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (!blob) return file;

    // Não aumenta o arquivo: caso a conversão não compense, mantém o original.
    if (blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "fiscalizacao";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Alguns formatos/celulares podem não ser decodificados pelo browser; nesse caso o upload continua normalmente.
    return file;
  }
}
