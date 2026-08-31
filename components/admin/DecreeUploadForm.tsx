"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

// Formulário simples: nome amigável + arquivo PDF.
export function DecreeUploadForm() {
  const router = useRouter();

  // Controla o texto digitado no nome do documento.
  const [name, setName] = useState("");

  // Guarda mensagens de sucesso ou erro para o administrador.
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Evita vários envios enquanto o upload ainda está acontecendo.
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  // Guarda a referência do formulário antes de qualquer await.
  const form = event.currentTarget;

  setSubmitting(true);
  setMessage("");
  setIsError(false);

  const formData = new FormData(form);
  formData.set("name", name);

  try {
    const response = await fetch("/api/admin/decrees", {
      method: "POST",
      body: formData,
    });

    const text = await response.text();

    let result: {
      message?: string;
      error?: string;
    } = {};

    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        result = {};
      }
    }

    if (!response.ok) {
      setIsError(true);
      setMessage(
        result.error ??
          `Não foi possível cadastrar o decreto. Código ${response.status}.`,
      );
      return;
    }

    form.reset();
    setName("");
    setIsError(false);
    setMessage(
      result.message ?? "Decreto cadastrado com sucesso.",
    );

    router.refresh();
  } catch (error) {
    console.error("Erro no formulário de decreto:", error);

    setIsError(true);
    setMessage("Falha de comunicação com o servidor.");
  } finally {
    setSubmitting(false);
  }
}

      // Limpa o formulário depois do sucesso.
      event.currentTarget.reset();
      setName("");
      setMessage("Decreto cadastrado com sucesso.");

      // Atualiza a página para a nova linha aparecer na lista.
      router.refresh();
    } catch {
      setIsError(true);
      setMessage("Falha de comunicação com o servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card decree-form" onSubmit={handleSubmit}>
      <div className="form-section-title">Adicionar PDF</div>

      <div className="field">
        <label className="label" htmlFor="decree-name">Nome que aparecerá para o agente</label>
        <input
          className="input"
          id="decree-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Decreto Trenzinho"
          maxLength={120}
          required
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="decree-file">Arquivo PDF</label>
        <input
          className="input"
          id="decree-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
        />
        <span className="field-help">Somente PDF, com até 20 MB.</span>
      </div>

      {message ? (
        <div className={`notice ${isError ? "notice-error" : "notice-success"}`}>
          {message}
        </div>
      ) : null}

      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Enviando..." : "Salvar decreto"}
      </button>
    </form>
  );
}
