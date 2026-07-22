import { useEffect, useState } from "react";
import { api } from "../rpc";
import { DEFAULT_MODEL_FOR_KIND } from "../types/tasks";
import type { AIService, AIServiceKind } from "../types/tasks";

export interface ServiceModelValue {
  serviceId: string;
  model: string;
}

/**
 * Inline service config for the not-yet-saved case (ticket 135) — the
 * registration form passes kind/base URL/credential directly since there's
 * no serviceId to query yet.
 */
export interface ServiceOverride {
  kind: AIServiceKind;
  baseUrl?: string;
  credential?: string;
  /** Falls back to this service's saved credential when `credential` is left blank (editing, key field untouched). */
  existingServiceId?: string;
}

interface Props {
  value: ServiceModelValue;
  onChange: (value: ServiceModelValue) => void;
  disabled?: boolean;
  /** Skips the service selector and lists models for this inline config instead of a saved service (AIServiceEditor, ticket 135). */
  serviceOverride?: ServiceOverride;
}

/**
 * Explicit AI service + model picker (tickets 53/54/59) — every AI-assisted
 * step shows and lets the user override both. The model is a select fed by
 * `listServiceModels` (live-queried for Ollama/OpenAI-compatible, curated
 * for hosted kinds); it degrades to the service's configured model as the
 * lone option when the query fails.
 *
 * With `serviceOverride` set (ticket 135), the service selector is skipped
 * and the model field becomes a free-text input with fetched models offered
 * as suggestions — the field is never blocked on reachability.
 */
export default function ServiceModelPicker({ value, onChange, disabled, serviceOverride }: Props) {
  const [services, setServices] = useState<AIService[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (serviceOverride) return;
    void api.listAIServices().then((list) => {
      setServices(list);
      if (!value.serviceId && list.length > 0) {
        const preferred = list.find((s) => s.isDefault) ?? list[0]!;
        onChange({ serviceId: preferred.id, model: preferred.model?.trim() || DEFAULT_MODEL_FOR_KIND[preferred.kind] });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!serviceOverride]);

  const selected = services.find((s) => s.id === value.serviceId);

  // Curated kinds (anthropic/openai) cost nothing to list, so fetch eagerly;
  // network-dependent kinds (ollama/openai-compatible) wait for the explicit
  // "Load models" action so typing a base URL/key doesn't spam requests.
  const networkDependent =
    !!serviceOverride && (serviceOverride.kind === "ollama" || serviceOverride.kind === "openai-compatible");

  const loadOverrideModels = () => {
    if (!serviceOverride) return;
    setModelsLoading(true);
    void api
      .previewServiceModels({
        kind: serviceOverride.kind,
        baseUrl: serviceOverride.baseUrl,
        credential: serviceOverride.credential,
        existingServiceId: serviceOverride.existingServiceId,
        preferredModel: value.model,
      })
      .then((res) => {
        setModelsLoading(false);
        setModels(res.ok && res.models ? res.models : []);
      });
  };

  useEffect(() => {
    if (!serviceOverride || networkDependent) return;
    loadOverrideModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceOverride?.kind]);

  // Refresh the model options whenever the service changes (saved-service
  // mode only). The current value is always kept as an option so a
  // slow/failed query can't blank it.
  useEffect(() => {
    if (serviceOverride) return;
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
  }, [serviceOverride, value.serviceId]);

  const selectService = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    onChange({
      serviceId,
      model: service ? service.model?.trim() || DEFAULT_MODEL_FOR_KIND[service.kind] : "",
    });
  };

  const inputBase =
    "rounded-md border border-clide-border bg-clide-surface px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/30";

  if (serviceOverride) {
    return (
      <div className="flex items-center gap-2">
        <input
          className={`${inputBase} min-w-0 flex-1`}
          list="service-model-picker-options"
          placeholder="Uses a sensible default when blank"
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value })}
          disabled={disabled}
        />
        <datalist id="service-model-picker-options">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {networkDependent && (
          <button
            type="button"
            onClick={loadOverrideModels}
            disabled={disabled || modelsLoading}
            className="shrink-0 whitespace-nowrap rounded-md border border-clide-border px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            {modelsLoading ? "Loading…" : "Load models"}
          </button>
        )}
      </div>
    );
  }

  const options = value.model && !models.includes(value.model) ? [value.model, ...models] : models;

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
