function Comment({
  timestamp,
  name,
  content,
}: {
  timestamp: string;
  name: string;
  content: string;
}) {
  return (
    <div className="flex w-full flex-col gap-1 px-4">
      <div className="flex items-center">
        <p className="text-foreground w-12 text-xs">{timestamp}</p>
        <p className="font-medium">{name}</p>
      </div>
      <p className="ml-12">{content}</p>
    </div>
  );
}

export default Comment;
