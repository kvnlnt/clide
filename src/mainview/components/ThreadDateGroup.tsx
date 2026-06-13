interface ThreadDateGroupProps {
  label: string;
}

export default function ThreadDateGroup({ label }: ThreadDateGroupProps) {
  return <div className="mt-4 px-2 text-[12px] font-bold uppercase tracking-wide text-clide-muted">{label}</div>;
}
