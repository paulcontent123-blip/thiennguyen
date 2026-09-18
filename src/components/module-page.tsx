import Link from "next/link";
import { SiteHeader } from "./site-header";

type ModulePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: readonly string[];
};

export function ModulePage({ eyebrow, title, description, items }: ModulePageProps) {
  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-chamDeep">{title}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-inkMid">{description}</p>
        <div className="panel mt-8">
          <h2 className="font-serif text-xl font-semibold">Phạm vi skeleton</h2>
          <ul className="mt-4 grid gap-3">
            {items.map((item) => <li key={item} className="rounded-xl bg-paper px-4 py-3 text-sm">{item}</li>)}
          </ul>
        </div>
        <Link href="/" className="mt-6 inline-block text-sm font-bold text-son">← Về trang chủ</Link>
      </section>
    </main>
  );
}
