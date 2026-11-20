// zod para la app: se importa de aquí, no de "zod" (lo exige ESLint). Con `jitless`, zod no prueba `new Function` la
// primera vez que valida: la CSP de la app no permite `eval`, y esa prueba dejaría una violación en cada arranque
// (e2e/csp.spec.ts falla ante cualquiera). Sin JIT, la validación es la misma; solo no compila los esquemas.
import { z } from "zod";

z.config({ jitless: true });

export { z };
