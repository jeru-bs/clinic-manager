import Link from "next/link";

export function PrimaryActionButton(): React.ReactElement {
  return (
    <Link
      aria-label="פעולות מהירות"
      className="floating-action"
      href="/patients"
      title="הוספת מטופל"
    >
      +
    </Link>
  );
}
