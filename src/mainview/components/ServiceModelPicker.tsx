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
 * Explicit AI service + model picker (ticket 53/54) — every AI-assisted step
 * in the CLI-first flow (tool inspection, the wizard) shows and lets the user
 * override both, rather than silently using a service's stored default.
 */
export default function ServiceModelPicker({ value, onChange, disabled }: Props) {
  const [services, setServices] = useState<AIService[]>([]);

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

  const selectService = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    onChange({
      serviceId,
      model: service ? service.model?.trim() || DEFAULT_MODEL_FOR_KIND[service.kind] : "",
    });
  };

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
      <input
        className={`${inputBase} w-40 shrink-0`}
        placeholder={selected ? DEFAULT_MODEL_FOR_KIND[selected.kind] : "model"}
        value={value.model}
        onChange={(e) => onChange({ ...value, model: e.target.value })}
        disabled={disabled || !selected}
      />
    </div>
  );
}
