interface AudioOutputProps {
  src: string | null;
}

export default function AudioOutput({ src }: AudioOutputProps) {
  if (!src) {
    return <div className="px-3 py-2 text-[13px] text-white/30">No audio.</div>;
  }
  return (
    <div className="p-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio src={src} controls className="w-full" />
    </div>
  );
}
