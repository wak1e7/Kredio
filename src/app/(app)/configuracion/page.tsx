import { PageHeading } from "@/components/ui/page-heading";
import { Panel } from "@/components/ui/panel";

export default function ConfiguracionPage() {
  return (
    <div className="space-y-4">
      <PageHeading
        overline="Configuracion"
        title="Configuracion"
        description="Este modulo quedara disponible para preferencias y ajustes generales del sistema."
      />

      <Panel delay={180}>
        <h2 className="text-lg font-semibold">Proximamente</h2>
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">
          Aqui agregaremos configuraciones del sistema, preferencias operativas y parametros del negocio.
        </p>
      </Panel>
    </div>
  );
}
