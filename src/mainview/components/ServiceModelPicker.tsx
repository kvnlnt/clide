import { useEffect, useState } from "react";
import { api } from "../rpc";
import { DEFAULT_MODEL_FOR_KIND } from "../types/forms";
import type { AIService } from "../types/forms";

export interface ServiceModelValue {
  serviceId: string;
  model: string;
}

interface Props {
  value: ServiceModelValue;
  onChange: (value: ServiceModelValue) => void;
  disabled?: boolean;
}

/**
 * Explicit AI service + model picker (tickets 53/54/59) — every AI-assisted
 * step shows and lets the user override both. The model is a select fed by
 * `listServiceModels` (live-queried for Ollama/OpenAI-compatible, curated
 * for hosted kinds); it degrades to the service's configured model as the
 * lone option when the query fails.
 */
export default function ServiceModelPicker({ value, onChange, disabled }: Props) {
  const [services, setServices] = useState<AIService[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    void api.listAIServices().then((list) => {
      setServices(list);
      if (!value.serviceId && list.length > 0) {
        const preferred = list.find((s) => s.isDefault) ?? list[0]!;
        onChange({ serviceId: preferred.id, model: preferred.model?.trim() || DEFAULT_MODEL_FOR_KIND[preferred.kind] });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = services.find((s) => s.id === value.serviceId);

  // Refresh the model options whenever the service changes. The current
  // value is always kept as an option so a slow/failed query can't blank it.
  useEffect(() => {
    if (!value.serviceId) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    void api.listServiceModels(value.serviceId).then((res) => {
      if (cancelled) return;
      setModelsLoading(false);
      setModels(res.ok && res.models ? res.models : []);
    });
    return () => {
      cancelled = true;
    };
  }, [value.serviceId]);

  const selectService = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    onChange({
      serviceId,
      model: service ? service.model?.trim() || DEFAULT_MODEL_FOR_KIND[service.kind] : "",
    });
  };

  const options = value.model && !models.includes(value.model) ? [value.model, ...models] : models;

  const inputBase =
    "rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  return (
    <div className="flex items-center gap-2">
      <select
        className={`${inputBase} min-w-0 flex-1 appearance-none`}
        value={value.serviceId}
        onChange={(e) => selectService(e.target.value)}
        disabled={disabled || services.length === 0}
      >
        {services.length === 0 && <option value="">No AI service configured</option>}
        {services.map((s) => (
          <option key={s.id} value={s.id} className="bg-clide-panel">
            {s.name}
          </option>
        ))}
      </select>
      <select
        className={`${inputBase} w-48 shrink-0 appearance-none`}
        value={value.model}
        onChange={(e) => onChange({ ...value, model: e.target.value })}
        disabled={disabled || !selected || modelsLoading}
        title={modelsLoading ? "Loading models…" : "Model"}
      >
        {options.length === 0 && <option value="">{modelsLoading ? "Loading models…" : "model"}</option>}
        {options.map((m) => (
          <option key={m} value={m} className="bg-clide-panel">
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
