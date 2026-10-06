export function StatusBadge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" }) {
  return <span className={`status ${tone === "default" ? "" : tone}`}>{children}</span>;
}
