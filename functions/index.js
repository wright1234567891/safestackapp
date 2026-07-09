const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

exports.shopifyOrderWebhook = functions.https.onRequest(async (req, res) => {
  try {
    console.log("WEBHOOK HIT - STOCK DEDUCTION");

    const order = req.body;
    console.log("Shopify order received:", order.id);

    for (const item of order.line_items || []) {
      const productId = String(item.product_id || "");
      const variantId = String(item.variant_id || "");
      const soldQty = Number(item.quantity || 1);

      const pickupProperty = (item.properties || []).find(

  (p) => p.name === "Pickup" || p.name === "pickup"

);

if (pickupProperty && pickupProperty.value) {

  await db.collection("preOrders").add({

    site: "micklegate",

    shopifyOrderId: order.id || null,

    orderName: order.name || "",

    customerName: order.customer
      ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
      : "",

    pickup: pickupProperty.value,

    items: [
      {
        title: item.title || "",
        productTitle: item.title || "",
        variantTitle: item.variant_title || "",
        quantity: soldQty,
        shopifyProductId: productId,
        shopifyVariantId: variantId,
      },
    ],

    status: "new",

    source: "shopify-preorder",

    createdAt: admin.firestore.FieldValue.serverTimestamp(),

  });

  console.log("Pre-order saved:", {

    product: item.title,

    quantity: soldQty,

    pickup: pickupProperty.value,

  });

}

      console.log("Line item:", {
        title: item.title,
        product_id: productId,
        variant_id: variantId,
        quantity: soldQty,
      });

const dishSnap = await db

  .collection("dishes")

  .where("shopifyVariantId", "==", variantId)

  .get();

      if (dishSnap.empty) {
        console.log("No dish matched variant ID:", variantId);
        continue;
      }

      for (const dishDoc of dishSnap.docs) {
        const dish = dishDoc.data();

        console.log("Matched dish:", dish.name);

        for (const ing of dish.ingredients || []) {
          const stockItemId = ing.stockItemId;
          const qtyPerDish = Number(ing.qty || 0);
          const totalQty = qtyPerDish * soldQty;

          if (!stockItemId || totalQty <= 0) continue;

          const stockRef = db.collection("stockItems").doc(stockItemId);

          await stockRef.update({
            quantity: admin.firestore.FieldValue.increment(-totalQty),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

const batchesSnap = await db
  .collection("stockBatches")
  .where("stockItemId", "==", stockItemId)
  .where("status", "==", "active")
  .get();

const batches = batchesSnap.docs
  .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
  .filter((b) => Number(b.quantityRemaining || 0) > 0)
  .sort((a, b) => {
    const aDate = new Date(a.useByDate || a.dateReceived || "9999-12-31");
    const bDate = new Date(b.useByDate || b.dateReceived || "9999-12-31");
    return aDate - bDate;
  });

let remainingToDeduct = totalQty;

for (const batch of batches) {
  if (remainingToDeduct <= 0) break;

  const batchQty = Number(batch.quantityRemaining || 0);
  const deductNow = Math.min(batchQty, remainingToDeduct);
  const newBatchQty = batchQty - deductNow;

  await batch.ref.update({
    quantityRemaining: newBatchQty,
    status: newBatchQty <= 0 ? "closed" : "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  remainingToDeduct -= deductNow;
}

          await db.collection("stockMovements").add({
            site: dish.site || "micklegate",
            stockItemId,
            stockItemName: ing.stockItemName || "",
            type: "usage",
            quantity: totalQty,
            measurement: ing.unit || "unit",
            source: "shopify-pos-sale",
            shopifyOrderId: order.id || null,
            shopifyProductId: productId,
            shopifyVariantId: variantId,
            dishId: dishDoc.id,
            dishName: dish.name || item.title || "",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log("Stock deducted:", {
            stockItemId,
            quantity: totalQty,
            unit: ing.unit || "unit",
          });
        }
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Webhook error");
  }
});