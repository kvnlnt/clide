interface VideoOutputProps {
  src: string | null;
}

export default function VideoOutput({ src }: VideoOutputProps) {
  if (!src) {
    return <div className="px-3 py-2 text-[13px] text-white/30">No video.</div>;
  }
  return (
    <div className="flex justify-center p-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={src} controls className="max-h-[400px] w-full rounded" />
    </div>
  );
}
