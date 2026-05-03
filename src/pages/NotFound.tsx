import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="eyebrow text-muted-foreground">404</div>
        <h1 className="text-3xl mt-2">Page not found</h1>
        <Link to="/" className="mt-4 inline-block text-accent hover:underline">Back to workspace</Link>
      </div>
    </div>
  );
}
