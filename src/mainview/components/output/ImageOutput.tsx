import { useState } from "react";

interface ImageOutputProps {
  src: string | null;
}

export default function ImageOutput({ src }: ImageOutputProps) {
  const [full, setFull] = useState(false);
  if (!src) {
    return <div className="px-3 py-2 text-[13px] text-white/30">No image.</div>;
  }
  return (
    <div className="flex justify-center p-3">
      <img
        src={src}
        alt="output"
        onClick={() => setFull((f) => !f)}
        className="cursor-pointer rounded"
        style={full ? { maxWidth: "100%" } : { maxWidth: "100%", maxHeight: 400, objectFit: "contain" }}
      />
    </div>
  );
}
