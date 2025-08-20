# infrastructure.md

> Guía rápida para entender **cómo funciona** la arquitectura DDD de la Pizzería API (NestJS + Prisma + Pino).

---

## 0) Objetivo

- Estandarizar una **arquitectura por dominios (DDD)**.
- Separar **reglas de negocio** del **framework** y la **infraestructura**.
- Facilitar pruebas, mantenibilidad y escalamiento por **bounded contexts** (Catalog, Ordering, Payments, etc.).

---

## 1) Layout del proyecto (dentro de `src/`)

```cmd
src/
  main.ts
  app.module.ts

  platform/                      # Infra transversal (health, swagger, etc.)
    platform.module.ts
    health.controller.ts

  shared/                        # Shared Kernel: base común
    domain/
      entity.ts
      value-object.ts
      result.ts
      domain-event.ts
      unique-entity-id.ts
    application/
      use-case.ts
    infrastructure/
      prisma/
        prisma.module.ts
        prisma.service.ts
      uow/
        unit-of-work.ts

  modules/
    catalog/                     # Bounded Context: Catalog
      catalog.module.ts
      domain/
        entities/
          product.ts
        value-objects/
          price.vo.ts
        events/
          product-created.event.ts
        repositories/
          product.repository.ts   # interfaz (puerto de dominio)
      application/
        dto/
          create-product.dto.ts
          product.view.ts
        use-cases/
          create-product.usecase.ts
          get-product.usecase.ts
        ports/
          index.ts                # tokens DI (ej. PRODUCT_REPOSITORY)
      infrastructure/
        http/
          catalog.controller.ts   # adaptador HTTP
        persistence/
          mappers/
            product.mapper.ts     # domain <-> persistence
          prisma/
            product.repository.prisma.ts  # adaptador a Prisma (repo real)
```

---

## 2) Capas y responsabilidades

### Domain (`modules/<context>/domain`)

- **Qué contiene**: Entidades, Value Objects, Agregados, Eventos de Dominio, **interfaces** de repositorios.
- **No depende** de Nest, Prisma ni librerías externas. Solo de `shared/domain` (kernel).
- **Ejemplo**: `Product` (entidad), `Price` (VO), `ProductRepository` (interfaz).

### Application (`modules/<context>/application`)

- **Qué contiene**: Casos de uso (commands/queries), DTOs de entrada/salida, puertos (tokens DI).
- Orquesta reglas del dominio y coordina repos. **No** contiene lógica de controladores ni SQL.
- **Ejemplo**: `CreateProductUseCase`, que recibe `CreateProductDto`, usa el repo y retorna `ProductView`.

### Infrastructure (`modules/<context>/infrastructure`)

- **Qué contiene**: Adaptadores concretos: controladores HTTP, repos con Prisma, mappers, suscriptores, colas, etc.
- **Conoce** el framework (Nest) y las librerías (Prisma, Pino).
- **Ejemplo**: `PrismaProductRepository` implementa `ProductRepository`, `CatalogController` expone rutas.

### Platform (`platform/`)

- Infraestructura **cross-cutting**: health endpoints, docs Swagger, inicialización global, middlewares, etc.

### Shared (`shared/`)

- **Kernel común** sin dependencias del framework:
  - Base para entidades/VOs (`entity.ts`, `value-object.ts`)
  - `Result`/`Either` para flujos controlados
  - Conectores de infraestructura compartida (Prisma, UnitOfWork)

---

## 3) Ciclo de una petición HTTP

1. **Cliente** envía `POST /catalog/products`.
2. **Controller** (`CatalogController`) recibe el body validado por `ValidationPipe`.
3. El controller **invoca** el **Use Case** (application).
4. El Use Case **usa** repos (interfaces de dominio) — Nest resuelve la implementación concreta (Prisma).
5. El Repositorio Prisma **lee/escribe** en DB, usando mappers para convertir a dominio/persistencia.
6. El Use Case retorna un **`Result<ProductView>`** al controller.
7. El Controller **serializa** y responde `{ ok: true, data: ... }`.
8. **Logger (Pino)** escribe detalles de la petición/respuesta en consola y archivo rotativo.

---

## 4) Inyección de dependencias (DI)

- Se definen **tokens** (símbolos) en `application/ports/index.ts`:

  ```ts
  export const PRODUCT_REPOSITORY = Symbol("PRODUCT_REPOSITORY");
  ```

- En el `catalog.module.ts` se enlaza el token con la implementación:

  ```ts
  providers: [{ provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository }, CreateProductUseCase, GetProductUseCase];
  ```

- Los **Use Cases** reciben el repo por constructor (Nest lo resuelve via token).

---

## 5) Repositorios, Mappers y Prisma

- **Repositorio (Dominio)**: interfaz “qué” se necesita (no “cómo”).
- **Repositorio (Infra)**: implementación concreta con Prisma. Solo aquí se usa SQL/ORM.
- **Mappers**: convierten entre:
  - **Dominio** ←→ **Persistencia** (model Prisma)
  - **Dominio** ←→ **DTOs** (a veces desde el Use Case/Controller)

**Beneficio**: si cambia la base de datos o estructura, solo tocas infraestructura/mappers.

---

## 6) Unit of Work (UoW) y transacciones

- En `shared/infrastructure/uow/unit-of-work.ts` define una interfaz para envolver **transacciones**.
- Con Prisma, usa `prisma.$transaction(async (tx) => { ... })` y pasa `tx` a los repos.
- Los casos de uso que modifican múltiples agregados deberían ejecutarse dentro de UoW.

> **Regla**: si un caso de uso toca **varias tablas** que deben ser atómicas, usa UoW.
> Si es un simple **read** o un **upsert** aislado, puede ser directo.

---

## 7) Validación y DTOs

- **Entrada**: los DTOs de entrada viven en `application/dto`, y se validan vía `class-validator` por `ValidationPipe` global (`main.ts`).
- **Salida**: los DTOs de salida (`*View`) son planos, listos para serializar (sin lógica).
- **Dominio** **no** usa `class-validator`. Las reglas **de negocio** van en las entidades/VOs.

---

## 8) Manejo de errores

- Los use cases devuelven `Result<T>`:
  - `Result.ok(data)` → éxito
  - `Result.fail('message')` → error controlado de negocio

- Los errores técnicos (excepciones) se capturan en infraestructura y se loguean (Pino).
- **Opcional**: usar filtros globales para mapear excepciones a HTTP estándar.

---

## 9) Logging

- `nestjs-pino` con `pino.multistream`:
  - **Consola**: pretty en desarrollo.
  - **Archivo**: JSON rotativo diario (`logs/app-YYYY-MM-DD.log` y symlink `app-current.log`).

- Redacción (`redact`) de secretos (`authorization`, `password`, `token`).
- `customLogLevel` eleva log level según status code (4xx=warn, 5xx=error).
- Endpoints de health y tail de logs:
  - `GET /health` (JSON con uptime, memoria)
  - `GET /health/ping` (ping simple)
  - `GET /health/logs?lines=200` (cola del archivo actual)

---

## 10) Seguridad y performance

- `helmet` (CSP desactivable en dev si interfiere con Swagger).
- `compression` para respuestas.
- `CORS` habilitado desde `main.ts` (`app.enableCors({ origin: true, credentials: true })`).
- **Rate limiting** con `ThrottlerModule` (p. ej. 120 req/min).
- **DTOs** con `whitelist`, `forbidNonWhitelisted`, `transform` en `ValidationPipe`.

---

## 11) Documentación (Swagger)

- Se configura en `main.ts` con `DocumentBuilder`.
- `SwaggerModule.setup('docs', app, doc)` expone UI en `/docs`.
- Los controladores (infra) pueden anotar DTOs con `@ApiProperty` si quieres esquema enriquecido.

---

## 12) Versionado y rutas

- Recomendado: `app.setGlobalPrefix('api')`.
- Puedes aplicar **versioning** (`setVersioning`) si necesitas `/v1`, `/v2`.
- Agrupa por bounded context: `catalog/products`, `ordering/orders`, etc.

---

## 13) Testing

- **Domain**: tests puros (rápidos) de entidades/VOs y reglas.
- **Application**: tests de use cases con repos **dobles** (mocks/fakes).
- **Infrastructure**: e2e con Nest Testing + **DB real o testcontainers**.
- Evita testear lógica de dominio a través de HTTP (hazlo directo donde vive la lógica).

---

## 14) Cómo agregar una nueva funcionalidad (checklist)

1. **Domain**
   - Define Entidad/VO/Evento si aplica.
   - Extiende o crea **interfaz** de repositorio.

2. **Application**
   - Crea DTO(s) de entrada/salida.
   - Implementa **Use Case** (orquesta repos, valida reglas).

3. **Infrastructure**
   - Implementa repo con Prisma.
   - Crea/actualiza mapper(s).
   - Expón endpoints en un **Controller**.

4. **Module wiring**
   - Enlaza el token → implementación en `*.module.ts`.

5. **Pruebas**
   - Domain (unit), Application (unit con mocks), Infrastructure (e2e).

6. **Docs y seguridad**
   - Anota Swagger si aplica.
   - Ajusta permisos si ya tienes auth/roles.

---

## 15) Convenciones y buenas prácticas

- **Dominio** en **inglés** (convención común), endpoints y mensajes pueden ser en español si lo prefieres.
- **VOs** para conceptos con invariantes (ej. dinero → `Price` en centavos).
- **No** uses entidades anémicas: las reglas **viven** en las Entidades/VOs.
- **Repos** devuelven **dominio**, no objetos del ORM.
- **DTOs** viven en **application**, no en dominio.
- **Mappers** son la frontera: dominio ↔ persistencia, dominio ↔ DTO.
- Un **Use Case = un propósito** (single-responsibility).
- **No** usar decorators/`@Injectable()` en dominio.

---

## 16) Prisma y migraciones

- `shared/infrastructure/prisma/prisma.module.ts` expone `PrismaService` (global).
- Repos de infraestructura reciben `PrismaService`.
- Migraciones:
  - `npx prisma migrate dev --name init`
  - `npx prisma generate`

- Semillas: crea un script `prisma/seed.ts` y ejecútalo con `ts-node` o usando `prisma db seed`.

---

## 17) Roadmap sugerido

1. Logger estable (ya listo) y health endpoints.
2. Shared Kernel (`Entity`, `ValueObject`, `Result`).
3. Prisma Module + modelo `Product`.
4. Catalog: repos interfaz + use cases básicos + repo Prisma + controller.
5. Unit of Work (para casos multi-agregado).
6. Ordering (ticket + items + totales con VO `Money` + impuestos).
7. Domain Events + Outbox (si hay integración asíncrona).
8. Autorización/roles y versionado de API si hace falta.

---

## 18) Ejemplo de flujo (Create Product)

1. **POST** `/catalog/products` con `{ name, sku, priceAmount, currency }`
2. `CatalogController.create()` → `CreateProductUseCase.execute(dto)`
3. Use Case:
   - Verifica `sku` único (`repo.findBySku`)
   - Crea `Price` VO y `Product` entidad
   - `repo.save(product)`
   - Devuelve `Result.ok(ProductView)`

4. Controller responde `{ ok: true, data: ... }`
5. Pino registra request y respuesta. Archivo rotativo se actualiza.

---

## 19) Errores comunes (y cómo evitarlos)

- **Poner `stream` dentro de `pinoHttp`**: no funciona. Debe ir **al nivel raíz** de `LoggerModule.forRoot`.
- **Meter Prisma/HTTP en dominio**: rompe DDD. Usa **interfaces** en dominio y **adaptadores** en infra.
- **DTOs dentro del dominio**: evítalo; DTOs son de aplicación.
- **No mapear** dominio ↔ persistencia: evita exponer modelos Prisma fuera de infraestructura.

---

## 20) Scripts útiles (ejemplos)

- **Dev**: `nest start --watch`
- **Lint**: `eslint . --ext .ts`
- **Test**: `jest --watch`
- **Prisma**:
  - `npx prisma migrate dev --name <name>`
  - `npx prisma studio`
  - `npx prisma generate`

---

### Fin

Con esta guía puedes entender **qué hace cada carpeta**, **cómo viaja una petición**, y **dónde va cada pieza** cuando agregas una funcionalidad. Si quieres, te preparo una **versión con diagramas** (flujo HTTP, capas, y transacciones) para agregar a este documento.
