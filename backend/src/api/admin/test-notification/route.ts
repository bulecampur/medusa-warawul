import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { EmailService } from "../../../services/email";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger");
  const { email, type = "order_confirmation" } = req.body;

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    logger.info(`Testing email service - ${type} to ${email}`);
    
    const emailService = new EmailService(logger);
    let success = false;

    // Mock order data for testing
    const mockOrder = {
      id: "test_order_123",
      display_id: 1001,
      email: email,
      currency_code: "eur",
      total: 2550, // €25.50
      item_total: 2350,
      shipping_total: 200,
      tax_total: 0,
      customer: {
        first_name: "Test",
        last_name: "Customer",
        email: email,
      },
      shipping_address: {
        first_name: "Test",
        last_name: "Customer",
        address_1: "123 Test Street",
        city: "Test City",
        postal_code: "12345",
        country_code: "de",
      },
      items: [{
        id: "item_123",
        product_title: "Warawul Premium Roast",
        variant_title: "250g Whole Beans",
        quantity: 1,
        total: 1800,
      }, {
        id: "item_124",
        product_title: "Ethiopian Single Origin",
        variant_title: "500g Ground",
        quantity: 1,
        total: 550,
      }],
      shipping_methods: [{
        id: "sm_123",
        name: "Standard Shipping",
        total: 200,
      }],
    };

    if (type === "order_confirmation") {
      success = await emailService.sendOrderConfirmation(mockOrder);
    } else if (type === "order_shipped") {
      success = await emailService.sendOrderShipped(mockOrder, {
        tracking_number: "1Z999AA1234567890",
        tracking_url: "https://www.ups.com/track?tracknum=1Z999AA1234567890"
      });
    }

    if (success) {
      logger.info(`✅ Test email sent successfully: ${type} to ${email}`);
      res.json({
        success: true,
        message: `Test ${type} email sent successfully`,
        email: email,
        type: type,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error("Email service returned false");
    }

  } catch (error) {
    logger.error(`❌ Failed to send test email: ${type} to ${email}`, error);
    
    res.status(500).json({
      success: false,
      error: "Failed to send test email",
      message: error.message,
      email: email,
      type: type
    });
  }
};