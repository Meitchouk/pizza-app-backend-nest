import * as argon2 from 'argon2';
import { PrismaClient } from 'generated/prisma';

const prisma = new PrismaClient();

async function main() {
  // 1) Branch (unique: code)
  const branch = await prisma.branch.upsert({
    where: { code: 'DIR' },
    update: {},
    create: {
      code: 'DIR',
      name: 'Diriamba Centro',
      city: 'Diriamba',
      address: 'Frente al parque central',
    },
  });

  // 2) Roles (unique: name)
  const [roleAdmin, roleCashier, roleWaiter] = await Promise.all([
    prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Administrador completo' },
    }),
    prisma.role.upsert({
      where: { name: 'CASHIER' },
      update: {},
      create: { name: 'CASHIER', description: 'Caja y cobros' },
    }),
    prisma.role.upsert({
      where: { name: 'WAITER' },
      update: {},
      create: { name: 'WAITER', description: 'Mesero' },
    }),
  ]);

  // 3) Usuario admin (unique: username / email)
  const passwordHash = await argon2.hash('admin123', { type: argon2.argon2id });

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      branchId: branch.id,
      username: 'admin',
      fullName: 'Administrador General',
      email: 'admin@pizzeria.com',
      passwordHash,
      userRoles: {
        create: { roleId: roleAdmin.id },
      },
    },
    include: { userRoles: true },
  });

  // 4) Categorías (unique compuesto: [parentId, name])
  // Nota: Actualmente CategoryWhereUniqueInput exige id; se reemplaza upsert por findFirst + create.
  let pizzasCat = await prisma.category.findFirst({ where: { name: 'Pizzas' } });
  if (!pizzasCat) {
    pizzasCat = await prisma.category.create({ data: { name: 'Pizzas' } });
  }

  let drinksCat = await prisma.category.findFirst({ where: { name: 'Bebidas' } });
  if (!drinksCat) {
    drinksCat = await prisma.category.create({ data: { name: 'Bebidas' } });
  }

  // 5) Productos (unique: sku)
  const pizzaMargarita = await prisma.product.upsert({
    where: { sku: 'PZ-MARG' },
    update: {},
    create: {
      sku: 'PZ-MARG',
      name: 'Pizza Margarita',
      basePrice: 220.0,
      taxPercent: 15.0,
      categoryId: pizzasCat.id,
    },
  });

  const soda355 = await prisma.product.upsert({
    where: { sku: 'DR-355' },
    update: {},
    create: {
      sku: 'DR-355',
      name: 'Refresco 355ml',
      basePrice: 35.0,
      taxPercent: 15.0,
      categoryId: drinksCat.id,
    },
  });

  // 6) Modificador y opciones
  // ProductModifier (name not unique in current schema: use findFirst + create)
  let sizeModifier = await prisma.productModifier.findFirst({
    where: { name: 'Tamaño' },
  });
  if (!sizeModifier) {
    sizeModifier = await prisma.productModifier.create({
      data: {
        name: 'Tamaño',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
      },
    });
  }

  // ProductModifierOption (unique compuesto: [modifierId, name])
  // Reemplazo de upsert por findFirst + create porque no existe clave única compuesta (modifierId, name)
  let medianaOption = await prisma.productModifierOption.findFirst({
    where: { modifierId: sizeModifier.id, name: 'Mediana' },
  });
  if (!medianaOption) {
    medianaOption = await prisma.productModifierOption.create({
      data: {
        modifierId: sizeModifier.id,
        name: 'Mediana',
        priceDelta: 0,
        position: 1,
      },
    });
  }

  let grandeOption = await prisma.productModifierOption.findFirst({
    where: { modifierId: sizeModifier.id, name: 'Grande' },
  });
  if (!grandeOption) {
    grandeOption = await prisma.productModifierOption.create({
      data: {
        modifierId: sizeModifier.id,
        name: 'Grande',
        priceDelta: 40,
        position: 2,
      },
    });
  }

  // Vincular modificador a la pizza (PK compuesta en ProductModifierLink)
  await prisma.productModifierLink.upsert({
    where: {
      productId_modifierId: { productId: pizzaMargarita.id, modifierId: sizeModifier.id },
    },
    update: {},
    create: {
      productId: pizzaMargarita.id,
      modifierId: sizeModifier.id,
      position: 1,
    },
  });

  // 7) Cliente (unique: id)
  // First, try to find the customer by phone or email, then upsert by id
  let customer = await prisma.customer.findFirst({
    where: { OR: [{ phone: '555-1234' }, { email: 'juan@example.com' }] },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        fullName: 'Juan Pérez',
        phone: '555-1234',
        email: 'juan@example.com',
        addresses: {
          create: {
            label: 'Casa',
            addressLine: 'Barrio Centro #123',
            city: 'Diriamba',
            isDefault: true,
          },
        },
      },
      include: { addresses: true },
    });
  } else {
    customer = await prisma.customer.upsert({
      where: { id: customer.id },
      update: {},
      create: {
        fullName: 'Juan Pérez',
        phone: '555-1234',
        email: 'juan@example.com',
        addresses: {
          create: {
            label: 'Casa',
            addressLine: 'Barrio Centro #123',
            city: 'Diriamba',
            isDefault: true,
          },
        },
      },
      include: { addresses: true },
    });
  }

  // (Opcional) 8) Precio vigente por sucursal para productos (unique: [productId, branchId, startsAt])
  // Útil si quieres tener pricing explícito por sucursal además de basePrice.
  await prisma.productPrice.upsert({
    where: {
      productId_branchId_startsAt: {
        productId: pizzaMargarita.id,
        branchId: branch.id,
        startsAt: new Date(0), // ancla antigua para que siempre exista una fila
      },
    },
    update: {},
    create: {
      productId: pizzaMargarita.id,
      branchId: branch.id,
      price: 220.0,
      startsAt: new Date(0),
    },
  });

  await prisma.productPrice.upsert({
    where: {
      productId_branchId_startsAt: {
        productId: soda355.id,
        branchId: branch.id,
        startsAt: new Date(0),
      },
    },
    update: {},
    create: {
      productId: soda355.id,
      branchId: branch.id,
      price: 35.0,
      startsAt: new Date(0),
    },
  });

  console.log('Seed resumen:', {
    branch: branch.code,
    roles: [roleAdmin.name, roleCashier.name, roleWaiter.name],
    adminUser: adminUser.username,
    categories: [pizzasCat.name, drinksCat.name],
    products: [pizzaMargarita.sku, soda355.sku],
    modifier: sizeModifier.name,
    customer: customer.fullName,
  });
}

main()
  .then(() => console.log('✅ Seed ejecutado con éxito'))
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
