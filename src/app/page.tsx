import dynamic from "next/dynamic";

const SpecCheckApp = dynamic(() => import("@/components/spec-check-app"), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Загрузка…
    </main>
  ),
});

export default function Page() {
  return <SpecCheckApp />;
}
