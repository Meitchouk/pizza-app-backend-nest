/*
  Warnings:

  - A unique constraint covering the columns `[parent_id,name]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,name]` on the table `couriers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[customer_id,label]` on the table `customer_addresses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[modifier_id,name]` on the table `product_modifier_options` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `product_modifiers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "categories_parent_id_name_key" ON "public"."categories"("parent_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "couriers_branch_id_name_key" ON "public"."couriers"("branch_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_addresses_customer_id_label_key" ON "public"."customer_addresses"("customer_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "public"."customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "public"."customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "product_modifier_options_modifier_id_name_key" ON "public"."product_modifier_options"("modifier_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_modifiers_name_key" ON "public"."product_modifiers"("name");
