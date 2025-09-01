import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const notificationModuleService = req.scope.resolve("notification");
  const logger = req.scope.resolve("logger");

  const { email, template } = req.body;

  if (!email || !template) {
    return res.status(400).json({
      error: "Missing required fields: email and template",
    });
  }

  // Mock data for different templates
  const getMockData = (template: string) => {
    const mockOrder = {
      id: "order_test_123",
      display_id: 1001,
      email: email,
      currency_code: "eur",
      total: 2550,
      item_total: 2350,
      shipping_total: 200,
      tax_total: 0,
      customer: {
        id: "cus_test_123",
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
      items: [
        {
          id: "item_test_123",
          product_title: "Warawul Premium Roast",
          variant_title: "250g Whole Beans",
          quantity: 1,
          total: 1800,
          thumbnail:
            "https://via.placeholder.com/200x200/8B4513/FFFFFF?text=Coffee",
        },
      ],
      shipping_methods: [
        {
          id: "sm_test_123",
          name: "Standard Shipping",
          total: 200,
        },
      ],
    };

    const mockCustomer = {
      first_name: "Test",
      last_name: "Customer",
      email: email,
    };

    switch (template) {
      case "order.placed":
        return { order: mockOrder };

      case "order.shipped":
        return {
          order: mockOrder,
          fulfillment: {
            tracking_number: "1Z999AA1234567890",
            tracking_url:
              "https://www.ups.com/track?tracknum=1Z999AA1234567890",
          },
        };

      case "order.delivered":
        return {
          order: mockOrder,
          delivery_date: new Date(),
        };

      case "order.ready_for_pickup":
        return {
          order: mockOrder,
          pickup_location: {
            name: "Warawul Coffee Store",
            address: "123 Coffee Street, Berlin, Germany",
            phone: "+49 30 12345678",
            hours: "Monday-Friday: 7AM-7PM, Weekend: 8AM-6PM",
          },
        };

      case "order.canceled":
        return {
          order: mockOrder,
          cancellation_reason: "Customer request",
        };

      case "customer.signup_verification":
        return {
          customer: mockCustomer,
          verification_url: `https://warawulcoffee.com/verify?token=test_${Date.now()}`,
          verification_code: "ABC123XY",
        };

      case "customer.password_reset":
        return {
          customer: mockCustomer,
          reset_url: `https://warawulcoffee.com/reset?token=test_${Date.now()}`,
          reset_code: "DEF456ZA",
        };

      case "admin.signup_verification":
        return {
          admin: {
            ...mockCustomer,
            first_name: "Admin",
            last_name: "User",
          },
          verification_url: `https://admin.warawulcoffee.com/verify?token=admin_${Date.now()}`,
          verification_code: "ADM789BC",
          inviter: {
            first_name: "Super",
            last_name: "Admin",
            email: "superadmin@warawulcoffee.com",
          },
        };

      case "admin.password_reset":
        return {
          admin: {
            ...mockCustomer,
            first_name: "Admin",
            last_name: "User",
          },
          reset_url: `https://admin.warawulcoffee.com/reset?token=admin_${Date.now()}`,
          reset_code: "RST321XZ",
          ip_address: req.ip || "192.168.1.100",
        };

      default:
        return {};
    }
  };

  try {
    const mockData = getMockData(template);

    const result = await notificationModuleService.createNotifications({
      to: email,
      channel: "email",
      template: template,
      data: mockData,
    });

    logger.info(`Test email sent: ${template} to ${email}`);

    res.json({
      success: true,
      message: `Test email sent successfully`,
      template: template,
      email: email,
      notification_id: result?.id,
    });
  } catch (error) {
    logger.error(`Failed to send test email: ${template} to ${email}`, error);

    res.status(500).json({
      success: false,
      error: error.message,
      template: template,
      email: email,
    });
  }
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const availableTemplates = [
    "order.placed",
    "order.shipped",
    "order.delivered",
    "order.ready_for_pickup",
    "order.canceled",
    "customer.signup_verification",
    "customer.password_reset",
    "admin.signup_verification",
    "admin.password_reset",
  ];

  res.json({
    available_templates: availableTemplates,
    usage: "POST to this endpoint with { email, template } to send test email",
  });
};
