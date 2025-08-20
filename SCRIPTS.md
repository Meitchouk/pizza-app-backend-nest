# Scripts Prisma / Nest

## Por qué y cómo usarlos

Estos scripts automatizan pasos clave: generar cliente Prisma, aplicar migraciones, sembrar datos, ejecutar y probar la app. Reducen errores manuales y mantienen coherencia entre código y base de datos.

## Resumen rápido (package.json)

```powershell
build | prebuild | format | start | start:dev | start:debug | start:prod
lint | test | test:watch | test:cov | test:debug | test:e2e
prisma:generate | prisma:format | prisma:studio
prisma:migrate:dev | db:reset
prisma:migrate:deploy
prisma:seed
postinstall
```

---

## NEST / General

### build

Compila el proyecto Nest a dist (TypeScript -> JavaScript). Requiere prebuild para tener el cliente Prisma listo.

### prebuild

prisma generate. Antes de compilar para asegurar types y cliente actualizados.

### format

Prettier sobre src y test. Uniformiza estilo antes de commits.

### start

Inicia la app compilada (usa dist). Requiere haber corrido build.

### start:dev

Levanta Nest en modo watch (recarga al guardar). Uso diario en desarrollo.

### start:debug

Igual a start:dev pero abre puerto de inspector (debugging en VSCode/Chrome).

### start:prod

Ejecuta dist/main directamente (entorno productivo ya compilado).

### lint

ESLint con --fix para corregir problemas comunes de estilo y algunos errores.

### test

Ejecuta Jest (unit + integración según configuración por defecto).

### test:watch

Modo interactivo de Jest para feedback rápido mientras cambias código.

### test:cov

Genera reporte de cobertura. Útil en CI o control de calidad.

### test:debug

Arranca Jest con inspector activo y sin paralelismo (--runInBand) para depurar tests.

### test:e2e

Usa configuración específica (test/jest-e2e.json) para pruebas de extremo a extremo.

---

## Prisma (Desarrollo)

### prisma:generate

Genera el cliente Prisma según schema.prisma. Útil si cambiaste el schema sin reconstruir.

### prisma:format

Formatea schema.prisma (quitar inconsistencias de estilo).

### prisma:studio

Abre Prisma Studio (UI para explorar y editar datos manualmente en desarrollo).

### prisma:migrate:dev

Crea (si corresponde) y aplica migraciones en la DB de desarrollo:

- Usa DATABASE_URL
- Usa SHADOW_DATABASE_URL para calcular diffs
  Tras crear migración puedes (opcional) sembrar: npm run prisma:seed

### db:reset

Resetea completamente la base de desarrollo:

- Elimina datos
- Reaplica todas las migraciones
  No corre generate ni seed (se omitieron con flags). Después puedes:
- npm run prisma:generate (si hace falta)
- npm run prisma:seed (si necesitas datos iniciales)

---

## Prisma (Producción / CI)

### prisma:migrate:deploy

Aplica migraciones ya existentes SIN crear nuevas y SIN shadow DB.
Úsalo:

1. En pipelines CI antes de arrancar la app
2. En despliegues productivos
   Asegura que la base está sincronizada con las migraciones versionadas.

---

## Seed

### prisma:seed

Ejecuta prisma/seed.ts vía ts-node (sin type-check completo por --transpile-only para rapidez).
Casos:

- Poblar datos de prueba tras migraciones en desarrollo
- Poblar datos iniciales en primer despliegue (rol admin, catálogos, etc.)

(Alternativa estándar: definir en package.json { "prisma": { "seed": "ts-node prisma/seed.ts" } } y usar npx prisma db seed)

---

## Hooks

### postinstall

prisma generate después de instalar dependencias (npm install / CI / platforms). Garantiza cliente listo sin pasos manuales.

---

## Flujos recomendados

### Desarrollo

1. Editas schema.prisma (o código)
2. npm run prisma:migrate:dev
3. (Opcional) npm run prisma:seed
4. npm run start:dev
5. Tests cuando necesites: npm run test:watch / test

### Reiniciar datos locales

1. npm run db:reset
2. (Opcional) npm run prisma:seed
3. npm run start:dev

### Preparar build

1. npm run build (dispara prebuild -> prisma generate)
2. npm run start:prod (o empaquetar imagen Docker)

### CI / Producción

1. Instalar dependencias (postinstall genera cliente)
2. (Opcional si el build ocurre aquí) npm run build
3. npm run prisma:migrate:deploy
4. (Solo primer despliegue) npm run prisma:seed
5. Arrancar la app (npm run start:prod)

---

## Buenas prácticas

- Versiona todas las migraciones; no edites migraciones aplicadas: crea nuevas.
- Cambiaste schema pero no compilas aún: npm run prisma:generate.
- Antes de abrir PR asegúrate de: npm run lint && npm run test && npm run build.
- Usa test:debug para investigar casos complejos.
- Nunca uses db:reset en producción.

Fin. Mantén este documento actualizado si agregas o renombrás scripts.
