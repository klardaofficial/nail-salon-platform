export function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="m-0 text-[26px] tracking-[-0.025em]">{title}</h1>
      <p className="text-admin-muted mt-[7px]">{description}</p>
    </div>
  );
}
