export function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-page-heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
